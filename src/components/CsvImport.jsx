import { useState, useRef } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

function parseSimproCsv(text) {
  // Parse CSV handling quoted fields with commas
  const lines = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  function splitCsvLine(line) {
    const fields = []
    let field = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQ = !inQ
      } else if (ch === ',' && !inQ) {
        fields.push(field.trim())
        field = ''
      } else {
        field += ch
      }
    }
    fields.push(field.trim())
    return fields
  }

  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0])
  const colIdx = (name) => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase())

  const jobCol = colIdx('Job')
  const statusCol = colIdx('Status')
  const customerCol = colIdx('Customer')
  const siteCol = colIdx('Site')
  const sellCol = colIdx('Sell Price')
  const hoursCol = colIdx('Est. Hours')
  const gpCol = colIdx('Est. Gross Profit')

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const fields = splitCsvLine(line)

    // Parse "Job" column: "1107 - leak call out - £250 + VAT"
    const jobRaw = fields[jobCol] || ''
    const firstDash = jobRaw.indexOf(' - ')
    let jobNo = null
    let jobName = jobRaw
    if (firstDash > 0) {
      const numPart = jobRaw.substring(0, firstDash).trim()
      if (/^\d+$/.test(numPart)) {
        jobNo = parseInt(numPart, 10)
        jobName = jobRaw.substring(firstDash + 3).trim()
      }
    }

    // Rows with no leading job number aren't real jobs — this is how SimPRO's
    // own "Total" summary row at the bottom of an export shows up. Skip it.
    if (jobNo === null) continue

    // If jobName is empty, use the full raw value
    if (!jobName) jobName = jobRaw

    // Parse sell price: strip £, commas
    const sellRaw = (fields[sellCol] || '').replace(/[£,]/g, '').trim()
    const soldValue = parseFloat(sellRaw) || 0

    // Parse GP: strip £, commas, handle negatives
    const gpRaw = (fields[gpCol] || '').replace(/[£,]/g, '').trim()
    const soldGp = parseFloat(gpRaw) || 0

    // Parse hours
    const hoursRaw = (fields[hoursCol] || '').trim()
    const hoursAllowed = parseFloat(hoursRaw) || 0

    // Status mapping. Checked in this order because a couple of SimPRO's own
    // "complete" phrasings (including a typo'd "Completedon site" with no
    // space) need to be caught before anything else, or they'd fall through
    // to the "confirmed" default and look like they're still live.
    const statusRaw = (fields[statusCol] || '').toLowerCase()
    let status = 'confirmed'
    if (statusRaw.includes('complete')) status = 'complete'
    else if (statusRaw.includes('job review')) status = 'pipeline'
    else if (statusRaw.includes('on hold')) status = 'on_hold'
    else if (statusRaw.includes('in progress')) status = 'in_progress'

    // Customer -> dedicated field, Site -> notes
    const customer = (fields[customerCol] || '').trim()
    const site = (fields[siteCol] || '').trim()
    const notes = site ? `Site: ${site}` : null

    rows.push({
      job_no: jobNo,
      job_name: jobName,
      status,
      sold_value: soldValue,
      sold_gp: soldGp,
      hours_allowed: hoursAllowed,
      customer: customer || null,
      notes,
    })
  }

  return rows
}

export default function CsvImport({ onDone }) {
  const fileRef = useRef(null)
  const [newRows, setNewRows] = useState(null) // rows not yet in Frontline
  const [skippedRows, setSkippedRows] = useState([]) // rows whose job_no already exists
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target.result
      const parsed = parseSimproCsv(text)

      // This app is a short-lived bridge from SimPRO — once a job number is
      // in Frontline, SimPRO re-imports never touch it again. Any real
      // changes (variations etc.) are made directly in Frontline from then
      // on. So the only question importing needs to answer is: is this job
      // number already here, yes or no.
      const { data: existing, error } = await supabase.from('jobs').select('job_no')
      if (error) {
        setResult({ success: false, message: error.message })
        return
      }
      const existingNos = new Set((existing || []).map(j => j.job_no))

      setNewRows(parsed.filter(r => !existingNos.has(r.job_no)))
      setSkippedRows(parsed.filter(r => existingNos.has(r.job_no)))
      setResult(null)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!newRows || newRows.length === 0) return
    setImporting(true)
    setResult(null)

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('jobs')
      .insert(newRows.map(r => ({ ...r, updated_at: now })))
      .select()

    if (error) {
      setResult({ success: false, message: error.message })
    } else {
      const skippedNote = skippedRows.length > 0 ? ` (${skippedRows.length} already in Frontline, skipped)` : ''
      setResult({ success: true, message: `${data.length} new jobs imported.${skippedNote}` })
      setNewRows(null)
      setSkippedRows([])
      onDone?.()
    }
    setImporting(false)
  }

  function handleClose() {
    setNewRows(null)
    setSkippedRows([])
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasPreview = newRows !== null

  return (
    <div>
      {/* Trigger button */}
      {!hasPreview && !result && (
        <label className="flex items-center gap-1.5 bg-navy hover:bg-navy-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
          <Upload size={16} />
          Import from simPRO
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      )}

      {/* Preview / result modal */}
      {(hasPreview || result) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                <FileText size={20} />
                simPRO CSV Import
              </h3>
              <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-md">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {result && (
              <div className={`px-6 py-4 flex items-center gap-2 ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {result.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                <span className="text-sm font-medium">{result.message}</span>
              </div>
            )}

            {hasPreview && (
              <>
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                  <strong>{newRows.length}</strong> new job{newRows.length === 1 ? '' : 's'} to import.
                  {skippedRows.length > 0 && (
                    <> <strong>{skippedRows.length}</strong> already in Frontline — will be skipped.</>
                  )}
                </div>

                {/* Column header — a real row sitting above the scroll area, not
                    "sticky" inside it, so it can never scroll away. */}
                <div
                  className="grid gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-navy"
                  style={{ gridTemplateColumns: JOB_GRID_COLUMNS }}
                >
                  <div>No</div>
                  <div>Name</div>
                  <div>Customer</div>
                  <div>Status</div>
                  <div className="text-right">Value</div>
                  <div className="text-right">GP</div>
                  <div className="text-right">Hours</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {newRows.map((row, i) => (
                    <JobPreviewRow key={i} row={row} />
                  ))}
                  {skippedRows.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-amber-50 text-xs font-semibold text-amber-800 border-y border-gray-200">
                        Already in Frontline — not touched
                      </div>
                      {skippedRows.map((row, i) => (
                        <JobPreviewRow key={i} row={row} muted />
                      ))}
                    </>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || newRows.length === 0}
                    className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <Upload size={14} />
                    {importing ? 'Importing...' : `Import ${newRows.length} New Job${newRows.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Shared column widths so the header row and each data row line up exactly.
const JOB_GRID_COLUMNS = '70px 2fr 1.3fr 110px 90px 90px 70px'

function JobPreviewRow({ row, muted }) {
  return (
    <div
      className={`grid gap-2 px-4 py-1.5 text-sm border-b border-gray-100 ${muted ? 'opacity-50' : ''}`}
      style={{ gridTemplateColumns: JOB_GRID_COLUMNS }}
    >
      <div className="font-mono text-gray-500">{row.job_no || '—'}</div>
      <div className="truncate">{row.job_name}</div>
      <div className="truncate text-gray-600">{row.customer || '—'}</div>
      <div className="capitalize text-xs self-center">{row.status.replace('_', ' ')}</div>
      <div className="text-right tabular-nums">£{row.sold_value.toLocaleString()}</div>
      <div className="text-right tabular-nums">£{row.sold_gp.toLocaleString()}</div>
      <div className="text-right tabular-nums">{row.hours_allowed}</div>
    </div>
  )
}
