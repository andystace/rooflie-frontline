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

    // Status mapping
    const statusRaw = (fields[statusCol] || '').toLowerCase()
    let status = 'confirmed'
    if (statusRaw.includes('job review')) status = 'pipeline'
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
  const [preview, setPreview] = useState(null) // parsed rows
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const rows = parseSimproCsv(text)
      setPreview(rows)
      setResult(null)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return
    setImporting(true)
    setResult(null)

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('jobs')
      .upsert(
        preview.map(r => ({ ...r, updated_at: now })),
        { onConflict: 'job_no' }
      )
      .select()

    if (error) {
      setResult({ success: false, message: error.message })
    } else {
      setResult({ success: true, message: `${data.length} jobs imported successfully.` })
      setPreview(null)
      onDone?.()
    }
    setImporting(false)
  }

  function handleClose() {
    setPreview(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      {/* Trigger button */}
      {!preview && !result && (
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
      {(preview || result) && (
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

            {preview && (
              <>
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                  Found <strong>{preview.length}</strong> jobs to import. Review below, then click Import.
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-2 font-semibold text-navy">No</th>
                        <th className="text-left px-4 py-2 font-semibold text-navy">Name</th>
                        <th className="text-left px-4 py-2 font-semibold text-navy">Customer</th>
                        <th className="text-left px-4 py-2 font-semibold text-navy">Status</th>
                        <th className="text-right px-4 py-2 font-semibold text-navy">Value</th>
                        <th className="text-right px-4 py-2 font-semibold text-navy">GP</th>
                        <th className="text-right px-4 py-2 font-semibold text-navy">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-4 py-1.5 font-mono text-gray-500">{row.job_no || '—'}</td>
                          <td className="px-4 py-1.5 max-w-[200px] truncate">{row.job_name}</td>
                          <td className="px-4 py-1.5 max-w-[150px] truncate text-gray-600">{row.customer || '—'}</td>
                          <td className="px-4 py-1.5 capitalize text-xs">{row.status.replace('_', ' ')}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">£{row.sold_value.toLocaleString()}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">£{row.sold_gp.toLocaleString()}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{row.hours_allowed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    disabled={importing}
                    className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <Upload size={14} />
                    {importing ? 'Importing...' : `Import ${preview.length} Jobs`}
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
