import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertTriangle, Trash2, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, isWeekend } from 'date-fns'

// Non-productive job names (jobs 1–6) to skip during calendar import
const SKIP_JOBS = new Set([
  'office time', 'office', 'unbilled', 'rained off', 'rain off',
  'surveys', 'survey', 'holiday', 'holidays', 'sick', 'sickness', 'training',
])

/* ---- Helpers ---- */

function excelDateToISO(val) {
  if (val instanceof Date && !isNaN(val.getTime()) && val.getFullYear() >= 2020) {
    return format(val, 'yyyy-MM-dd')
  }
  if (typeof val === 'number' && val > 30000 && val < 70000) {
    const d = new Date(Math.round((val - 25569) * 86400000))
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) return format(d, 'yyyy-MM-dd')
  }
  if (typeof val === 'string' && val.trim()) {
    const d = new Date(val)
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) return format(d, 'yyyy-MM-dd')
  }
  return null
}

function cleanNum(val) {
  if (typeof val === 'number') return val
  if (!val) return 0
  return parseFloat(String(val).replace(/[£$,%]/g, '')) || 0
}

function matchTeamMember(name, members) {
  const n = name.trim().toLowerCase()
  if (!n) return null
  let found = members.find(item => item.name.toLowerCase() === n)
  if (found) return found
  found = members.find(item => item.name.toLowerCase().split(' ')[0] === n)
  if (found) return found
  found = members.find(item => item.name.toLowerCase().includes(n))
  if (found) return found
  return null
}

function matchJob(name, jobs) {
  if (!name) return null
  const n = name.trim().toLowerCase()
  let found = jobs.find(item => item.job_name?.toLowerCase() === n)
  if (found) return found
  found = jobs.find(item => item.job_name?.toLowerCase().includes(n))
  if (found) return found
  found = jobs.find(item => item.job_name && n.includes(item.job_name.toLowerCase()))
  if (found) return found
  return null
}

/* ---- Component ---- */

export default function ImportPage() {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState([])
  const [wbRef, setWbRef] = useState(null)

  // Reference data
  const [teamMembers, setTeamMembers] = useState([])
  const [existingJobs, setExistingJobs] = useState([])

  // Job import
  const [jobRows, setJobRows] = useState([])
  const [jobStatus, setJobStatus] = useState(null)
  const [importingJobs, setImportingJobs] = useState(false)

  // Schedule import
  const [scheduleRows, setScheduleRows] = useState([])
  const [crewMapping, setCrewMapping] = useState([])
  const [schedStatus, setSchedStatus] = useState(null)
  const [importingSched, setImportingSched] = useState(false)

  // Clear data
  const [showClear, setShowClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearStatus, setClearStatus] = useState(null)

  // Load reference data
  async function loadRef() {
    const [{ data: tm }, { data: jb }] = await Promise.all([
      supabase.from('team_members').select('*').order('display_order'),
      supabase.from('jobs').select('*').order('job_no'),
    ])
    setTeamMembers(tm || [])
    setExistingJobs(jb || [])
    return { members: tm || [], jobs: jb || [] }
  }

  useEffect(() => { loadRef() }, [])

  /* ---- File upload ---- */

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setJobStatus(null)
    setSchedStatus(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target.result)
      const wb = XLSX.read(data, { cellDates: true })
      setSheets(wb.SheetNames)
      setWbRef(wb)
      parseJobMaster(wb)
      // Fetch fresh reference data to avoid stale closure
      const ref = await loadRef()
      parseCalendar(wb, ref.members, ref.jobs)
    }
    reader.readAsArrayBuffer(file)
  }

  /* ---- Job Master Table parser ---- */

  function parseJobMaster(wb) {
    const name = wb.SheetNames.find(n =>
      n.toLowerCase().includes('job master') || n.toLowerCase().includes('master table')
    )
    if (!name) { setJobRows([]); return }

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })

    // Find header row
    let hdrIdx = -1
    const cols = { no: -1, name: -1, value: -1, gp: -1, hours: -1 }

    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      const cells = raw[i].map(v => String(v).toLowerCase().trim())
      const noC = cells.findIndex(c =>
        c === 'job no' || c === 'job no.' || c === 'no' || c === 'no.' || c === '#' || c === 'job number'
      )
      const nameC = cells.findIndex(c =>
        (c === 'job name' || c === 'name' || c === 'description') && c !== 'job no'
      )

      if (noC >= 0 || nameC >= 0) {
        hdrIdx = i
        cols.no = noC >= 0 ? noC : -1
        cols.name = nameC >= 0 ? nameC : (noC >= 0 ? noC + 1 : -1)
        cols.value = cells.findIndex(c => c.includes('sold val') || c === 'value' || c === 'sell price' || c === 'sold')
        cols.gp = cells.findIndex(c =>
          (c.includes('gp') || c.includes('gross profit')) && !c.includes('/h') && !c.includes('rate')
        )
        cols.hours = cells.findIndex(c => c.includes('hour') || c === 'hrs')
        break
      }
    }

    if (hdrIdx < 0) { setJobRows([]); return }

    const parsed = []
    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i]
      const jobNo = cols.no >= 0 ? (parseInt(r[cols.no]) || null) : null
      const jobName = cols.name >= 0 ? String(r[cols.name] || '').trim() : ''
      if (!jobName) continue
      if (jobNo !== null && jobNo <= 6) continue // skip non-productive categories

      parsed.push({
        job_no: jobNo,
        job_name: jobName,
        sold_value: cols.value >= 0 ? cleanNum(r[cols.value]) : 0,
        sold_gp: cols.gp >= 0 ? cleanNum(r[cols.gp]) : 0,
        hours_allowed: cols.hours >= 0 ? cleanNum(r[cols.hours]) : 0,
        status: 'in_progress',
      })
    }
    setJobRows(parsed)
  }

  /* ---- Calendar View parser ---- */

  function parseCalendar(wb, members, jobs) {
    const name = wb.SheetNames.find(n => n.toLowerCase().includes('calendar'))
    if (!name) { setScheduleRows([]); setCrewMapping([]); return }

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null })

    // Known first names to scan for in headers
    const knownNames = [
      'george', 'callum', 'greg', 'alex', 'ross', 'patch',
      'ethan', 'kaylan', 'josh', 'andrew', 'ashley', 'gary', 'shaun',
    ]

    // Find the date column — look for a header cell that says "date" (not "day + date")
    let dateCol = 1 // default to column B
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const cells = (raw[i] || []).map(v => String(v || '').toLowerCase().trim())
      const dci = cells.findIndex(c => c === 'date')
      if (dci >= 0) { dateCol = dci; break }
    }

    // Find header row with crew names
    let hdrIdx = -1
    let crewCols = []

    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      const cells = (raw[i] || []).map(v => String(v || '').toLowerCase().trim())
      const found = []

      cells.forEach((cell, ci) => {
        if (ci <= dateCol) return // skip date column(s)
        for (const kn of knownNames) {
          if (cell === kn || cell.includes(kn)) {
            found.push({ colIdx: ci, rawName: String(raw[i][ci]).trim() })
            break
          }
        }
      })

      if (found.length >= 2) {
        hdrIdx = i
        crewCols = found
        break
      }
    }

    if (hdrIdx < 0) { setScheduleRows([]); setCrewMapping([]); return }

    // Check for sub-header row below crew names (Hours, GP/Hour, GP Earned)
    const nextRow = raw[hdrIdx + 1] || []
    const subHdrs = nextRow.map(v => String(v || '').toLowerCase().trim())
    const hasSubHeaders = subHdrs.some(v =>
      v === 'hours' || v === 'hrs' || v.includes('gp/')  || v === 'gp earned'
    )

    let dataStart = hasSubHeaders ? hdrIdx + 2 : hdrIdx + 1
    let crewConfig = []

    if (hasSubHeaders) {
      // Each crew has 3 sub-columns: Hours, GP/Hour, GP Earned
      // The crew name column itself holds the job name in data rows
      for (let c = 0; c < crewCols.length; c++) {
        const startC = crewCols[c].colIdx
        const endC = c < crewCols.length - 1 ? crewCols[c + 1].colIdx : startC + 5

        let jobCol = startC   // job name lives in the crew name column
        let hoursCol = -1
        let gpEarnedCol = -1

        for (let ci = startC; ci < endC; ci++) {
          const sh = subHdrs[ci] || ''
          // Match "hours" / "hrs" but NOT "gp/hour"
          if ((sh === 'hours' || sh === 'hrs') && !sh.includes('/')) {
            hoursCol = ci
          } else if (sh === 'gp earned' || sh === 'gp' || sh === 'earned') {
            gpEarnedCol = ci
          }
          // "gp/hour" and "gp/hr" are noted but not needed for import
        }

        crewConfig.push({
          rawName: crewCols[c].rawName,
          jobCol,
          hoursCol,
          gpEarnedCol,
          member: matchTeamMember(crewCols[c].rawName, members),
        })
      }
    } else {
      // Single column per crew — cell contains job name (possibly multi-line)
      crewConfig = crewCols.map(cc => ({
        rawName: cc.rawName,
        jobCol: cc.colIdx,
        hoursCol: -1,
        gpEarnedCol: -1,
        member: matchTeamMember(cc.rawName, members),
      }))
    }

    setCrewMapping(crewConfig.map(c => ({ rawName: c.rawName, member: c.member })))

    // Parse data rows
    const entries = []

    for (let i = dataStart; i < raw.length; i++) {
      const row = raw[i]
      if (!row) continue

      const dateStr = excelDateToISO(row[dateCol])
      if (!dateStr) continue

      // Skip weekends
      if (isWeekend(new Date(dateStr + 'T12:00:00'))) continue

      for (const cc of crewConfig) {
        if (!cc.member) continue

        const cellVal = row[cc.jobCol]
        if (cellVal === null || cellVal === undefined) continue
        const cellText = String(cellVal).trim()
        if (!cellText || cellText === '-' || cellText === '0' || cellText.toLowerCase() === 'n/a') continue

        let jobName = cellText

        // Multi-line cell: first line = job name
        if (cellText.includes('\n')) {
          const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean)
          jobName = lines[0]
        }

        if (!jobName) continue

        // Skip non-productive entries (jobs 1-6: holiday, sick, rained off, etc.)
        if (SKIP_JOBS.has(jobName.toLowerCase())) continue

        // Hours from dedicated column, default 8
        let hours = 8
        if (cc.hoursCol >= 0) {
          const h = cleanNum(row[cc.hoursCol])
          if (h > 0 && h <= 24) hours = h
        }

        // GP earned from dedicated column
        let gpEarned = 0
        if (cc.gpEarnedCol >= 0) {
          gpEarned = cleanNum(row[cc.gpEarnedCol])
        }

        // Match job name to existing jobs table
        const job = matchJob(jobName, jobs)

        entries.push({
          date: dateStr,
          team_member_id: cc.member.id,
          memberName: cc.member.name,
          jobName,
          hours,
          gpEarned,
          entry_type: 'job',
          job_id: job?.id || null,
          jobMatched: !!job,
        })
      }
    }

    setScheduleRows(entries)
  }

  /* ---- Import Jobs ---- */

  async function importJobs() {
    if (jobRows.length === 0) return
    setImportingJobs(true)
    setJobStatus(null)

    try {
      // Deduplicate by job_no (keep last occurrence)
      const byNo = new Map()
      const noJobNo = []
      for (const row of jobRows) {
        if (row.job_no) byNo.set(row.job_no, row)
        else noJobNo.push(row)
      }
      const withJobNo = [...byNo.values()]

      let total = 0
      const now = new Date().toISOString()

      // Upsert jobs that have a job_no — updates on conflict, inserts otherwise
      if (withJobNo.length > 0) {
        const { data, error } = await supabase
          .from('jobs')
          .upsert(
            withJobNo.map(r => ({ ...r, updated_at: now })),
            { onConflict: 'job_no' }
          )
          .select()
        if (error) throw error
        total += (data || []).length
      }

      // Insert jobs without a job_no (no conflict key to match on)
      if (noJobNo.length > 0) {
        const { data, error } = await supabase
          .from('jobs')
          .insert(noJobNo.map(r => ({ ...r, updated_at: now })))
          .select()
        if (error) throw error
        total += (data || []).length
      }

      setJobStatus({ success: true, message: `${total} jobs imported.` })

      // Refresh reference data and re-parse calendar with new jobs
      const ref = await loadRef()
      if (wbRef) parseCalendar(wbRef, ref.members, ref.jobs)
    } catch (err) {
      setJobStatus({ success: false, message: err.message })
    }
    setImportingJobs(false)
  }

  /* ---- Import Schedule ---- */

  async function importSchedule() {
    const valid = scheduleRows.filter(e => e.team_member_id)
    if (valid.length === 0) return
    setImportingSched(true)
    setSchedStatus(null)

    try {
      const payloads = valid.map(e => ({
        team_member_id: e.team_member_id,
        job_id: e.entry_type === 'job' ? e.job_id : null,
        entry_type: e.entry_type,
        date: e.date,
        hours: e.hours,
      }))

      let total = 0
      for (let i = 0; i < payloads.length; i += 500) {
        const batch = payloads.slice(i, i + 500)
        const { data, error } = await supabase
          .from('schedule_entries')
          .insert(batch)
          .select('id')
        if (error) throw error
        total += (data || []).length
      }

      setSchedStatus({ success: true, message: `${total} schedule entries imported.` })
    } catch (err) {
      setSchedStatus({ success: false, message: err.message })
    }
    setImportingSched(false)
  }

  /* ---- Clear Schedule ---- */

  async function clearSchedule() {
    setClearing(true)
    setClearStatus(null)

    try {
      const { count } = await supabase
        .from('schedule_entries')
        .select('*', { count: 'exact', head: true })

      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .not('id', 'is', null)

      if (error) throw error
      setClearStatus({ success: true, message: `${count || 0} entries deleted.` })
      setShowClear(false)
    } catch (err) {
      setClearStatus({ success: false, message: err.message })
    }
    setClearing(false)
  }

  /* ---- Derived values ---- */

  const unmatchedCrew = crewMapping.filter(c => !c.member)
  const unmatchedJobNames = [...new Set(scheduleRows.filter(e => !e.jobMatched).map(e => e.jobName))]

  /* ---- Render ---- */

  return (
    <div className="p-4 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={24} className="text-navy" />
        <h2 className="text-xl font-bold text-navy">Import Spreadsheet</h2>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 bg-orange text-white px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-orange-dark">
            <Upload size={16} />
            {fileName ? 'Change file' : 'Upload .xlsx file'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {fileName && (
            <span className="text-sm text-gray-600">
              <strong>{fileName}</strong>
              {sheets.length > 0 && (
                <span className="text-gray-400 ml-2">
                  Sheets: {sheets.join(', ')}
                </span>
              )}
            </span>
          )}
        </div>
        {!fileName && (
          <p className="text-xs text-gray-400 mt-3">
            Upload Greg's weekly scheduling spreadsheet. Expects sheets named "Job Master Table" and "Calendar View".
          </p>
        )}
      </div>

      {/* Job Master Table */}
      {jobRows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy">Step 1: Job Master Table</h3>
              <p className="text-xs text-gray-500">{jobRows.length} jobs found (jobs 1–6 excluded)</p>
            </div>
            {jobStatus?.success ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg text-sm font-medium">
                <CheckCircle size={16} className="text-green-600" />
                {jobStatus.message}
              </div>
            ) : (
              <button
                onClick={importJobs}
                disabled={importingJobs}
                className="flex items-center gap-1.5 bg-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-dark disabled:opacity-50"
              >
                <Upload size={14} />
                {importingJobs ? 'Importing...' : `Import ${jobRows.length} Jobs`}
              </button>
            )}
          </div>

          {jobStatus && !jobStatus.success && <StatusBanner status={jobStatus} />}

          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-navy">No</th>
                  <th className="text-left px-4 py-2 font-semibold text-navy">Job Name</th>
                  <th className="text-right px-4 py-2 font-semibold text-navy">Value</th>
                  <th className="text-right px-4 py-2 font-semibold text-navy">GP</th>
                  <th className="text-right px-4 py-2 font-semibold text-navy">Hours</th>
                </tr>
              </thead>
              <tbody>
                {jobRows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-1.5 font-mono text-gray-500">{r.job_no || '\u2014'}</td>
                    <td className="px-4 py-1.5 truncate max-w-[300px]">{r.job_name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">&pound;{r.sold_value.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">&pound;{r.sold_gp.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{r.hours_allowed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View — Schedule */}
      {(scheduleRows.length > 0 || crewMapping.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy">Step 2: Calendar View — Schedule Entries</h3>
              <p className="text-xs text-gray-500">
                {scheduleRows.length} entries parsed (non-productive rows skipped)
                {unmatchedJobNames.length > 0 && (
                  <span className="text-amber-600 ml-1">
                    ({unmatchedJobNames.length} unmatched job name{unmatchedJobNames.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>
            {scheduleRows.length > 0 && (
              <button
                onClick={importSchedule}
                disabled={importingSched}
                className="flex items-center gap-1.5 bg-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-dark disabled:opacity-50"
              >
                <Upload size={14} />
                {importingSched ? 'Importing...' : `Import ${scheduleRows.length} Entries`}
              </button>
            )}
          </div>

          <StatusBanner status={schedStatus} />

          {/* Crew matching summary */}
          {crewMapping.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 bg-blue-50/50">
              <div className="text-xs font-medium text-gray-600 mb-1">Crew mapping:</div>
              <div className="flex flex-wrap gap-1.5">
                {crewMapping.map((c, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      c.member ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {c.rawName} {c.member ? `\u2192 ${c.member.name}` : '(unmatched)'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched jobs warning */}
          {unmatchedJobNames.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 bg-amber-50">
              <div className="text-xs text-amber-800 mb-1">
                <AlertTriangle size={12} className="inline mr-1" />
                <strong>Unmatched job names</strong> — import jobs first (Step 1), then re-upload to re-match:
              </div>
              <div className="flex flex-wrap gap-1">
                {unmatchedJobNames.map((n, i) => (
                  <span key={i} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{n}</span>
                ))}
              </div>
            </div>
          )}

          {scheduleRows.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-navy">Date</th>
                    <th className="text-left px-4 py-2 font-semibold text-navy">Crew Member</th>
                    <th className="text-left px-4 py-2 font-semibold text-navy">Job</th>
                    <th className="text-right px-4 py-2 font-semibold text-navy">Hours</th>
                    <th className="text-right px-4 py-2 font-semibold text-navy">GP</th>
                    <th className="text-center px-4 py-2 font-semibold text-navy">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-1.5 text-gray-600 tabular-nums">{r.date}</td>
                      <td className="px-4 py-1.5">{r.memberName}</td>
                      <td className="px-4 py-1.5 truncate max-w-[250px]">{r.jobName}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{r.hours}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {r.gpEarned > 0 ? `\u00A3${r.gpEarned.toLocaleString()}` : '\u2014'}
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        {r.jobMatched ? (
                          <CheckCircle size={14} className="inline text-green-500" />
                        ) : (
                          <AlertTriangle size={14} className="inline text-amber-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scheduleRows.length > 200 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                  Showing first 200 of {scheduleRows.length} entries
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state after file upload */}
      {fileName && jobRows.length === 0 && scheduleRows.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>No data found.</strong> Expected sheets named "Job Master Table" and "Calendar View".
            <br />Found sheets: {sheets.join(', ') || 'none'}
          </div>
        </div>
      )}

      {/* Clear schedule data */}
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-red-700">Clear Schedule Data</h3>
            <p className="text-xs text-gray-500">Delete all schedule entries. Use before re-importing.</p>
          </div>
          {!showClear ? (
            <button
              onClick={() => setShowClear(true)}
              className="flex items-center gap-1.5 text-red-600 border border-red-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              <Trash2 size={14} />
              Clear All Entries
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-700 font-medium">Are you sure?</span>
              <button
                onClick={clearSchedule}
                disabled={clearing}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {clearing ? 'Deleting...' : 'Yes, delete all'}
              </button>
              <button
                onClick={() => setShowClear(false)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {clearStatus && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${clearStatus.success ? 'text-green-700' : 'text-red-700'}`}>
            {clearStatus.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {clearStatus.message}
          </div>
        )}
      </div>
    </div>
  )
}

/* Small reusable banner for import results */
function StatusBanner({ status }) {
  if (!status) return null
  return (
    <div className={`px-4 py-2 flex items-center gap-2 text-sm ${
      status.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
    }`}>
      {status.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {status.message}
    </div>
  )
}
