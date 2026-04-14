import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertTriangle, Trash2, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, isWeekend } from 'date-fns'

// Map non-productive job names to schedule entry types (instead of skipping them)
const NON_PRODUCTIVE_MAP = {
  'holiday': 'holiday', 'holidays': 'holiday',
  'sick': 'sick', 'sickness': 'sick',
  'rained off': 'rained_off', 'rain off': 'rained_off',
  'office time': 'office', 'office': 'office',
  'surveys': 'surveys', 'survey': 'surveys',
  'unbilled': 'unbilled',
  'training': 'training',
}

function detectNonProductive(jobName) {
  const lower = jobName.toLowerCase().trim()
  if (NON_PRODUCTIVE_MAP[lower]) return NON_PRODUCTIVE_MAP[lower]
  // Strip leading number prefix like "5 - Holiday" → "holiday"
  const stripped = lower.replace(/^\d+\s*[-–—]\s*/, '').trim()
  if (NON_PRODUCTIVE_MAP[stripped]) return NON_PRODUCTIVE_MAP[stripped]
  return null
}

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
  // Exact name match
  let found = members.find(item => item.name.toLowerCase() === n)
  if (found) return found
  // First name match
  found = members.find(item => item.name.toLowerCase().split(' ')[0] === n)
  if (found) return found
  // Nickname match (exact)
  found = members.find(item => item.nickname && item.nickname.toLowerCase() === n)
  if (found) return found
  // Normalized name match — strip special chars like "/" so "Glen Strachy / Gaz Potter" matches "Glen Strachy Gaz Potter"
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const nNorm = normalize(n)
  found = members.find(item => normalize(item.name) === nNorm)
  if (found) return found
  // Partial name match
  found = members.find(item => item.name.toLowerCase().includes(n))
  if (found) return found
  // Partial nickname match
  found = members.find(item => item.nickname && item.nickname.toLowerCase().includes(n))
  if (found) return found
  return null
}

function matchJob(name, jobs) {
  if (!name) return null
  // Strip invisible characters (zero-width space, BOM) that break regex anchoring
  const n = name.replace(/[\u200B\uFEFF\u00A0]/g, ' ').trim()
  const nLower = n.toLowerCase()

  // 1. Try matching by leading job number (e.g. "1078 - Picts lane..." → job_no 1078)
  const numMatch = n.match(/^\s*(\d{3,5})\b/)
  if (numMatch) {
    const jobNo = parseInt(numMatch[1])
    // Use Number() coercion on both sides to handle string/number mismatches
    const found = jobs.find(item => item.job_no != null && Number(item.job_no) === jobNo)
    if (found) return found
  }

  // 2. Extract name part (strip leading number + separator if present)
  let namePart = nLower
  if (numMatch) {
    namePart = n.slice(numMatch[0].length).replace(/^[\s\-–—:]+/, '').trim().toLowerCase()
  }

  // 3. Exact name match on name part
  let found = jobs.find(item => item.job_name?.toLowerCase() === namePart)
  if (found) return found

  // 4. Partial name match (job name contains name part or vice versa)
  found = jobs.find(item => item.job_name?.toLowerCase().includes(namePart))
  if (found) return found
  found = jobs.find(item => item.job_name && namePart.includes(item.job_name.toLowerCase()))
  if (found) return found

  // 5. Keyword matching — extract significant words, match if 2+ hit a job name
  const SKIP_WORDS = new Set(['tbc', 'the', 'and', 'for', 'job', 'new', 'old', 'est', 'price', 'guess'])
  const keywords = namePart.split(/[\s\-–—,_]+/).filter(w => w.length >= 3 && !SKIP_WORDS.has(w))
  if (keywords.length >= 2) {
    let bestMatch = null
    let bestCount = 0
    for (const job of jobs) {
      const jn = job.job_name?.toLowerCase() || ''
      const matchCount = keywords.filter(kw => jn.includes(kw)).length
      if (matchCount >= 2 && matchCount > bestCount) {
        bestMatch = job
        bestCount = matchCount
      }
    }
    if (bestMatch) return bestMatch
  }

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

    // Build known names dynamically from team members (first names + nicknames)
    const knownNames = members.flatMap(m => {
      const names = [m.name.toLowerCase().split(' ')[0]]
      if (m.nickname) names.push(m.nickname.toLowerCase())
      return names
    })

    console.log('[Import] Team members:', members.length,
      '| With nicknames:', members.filter(m => m.nickname).map(m => `${m.name} → "${m.nickname}"`))
    console.log('[Import] Known names for header scan:', knownNames)

    // Find the date column — look for a header cell that says "date" (not "day + date")
    let dateCol = 1 // default to column B
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const cells = (raw[i] || []).map(v => String(v || '').toLowerCase().trim())
      const dci = cells.findIndex(c => c === 'date')
      if (dci >= 0) { dateCol = dci; break }
    }

    // Helper: check if cell contains known name as a whole word (not substring of longer word)
    function cellMatchesKnownName(cell, kn) {
      if (cell === kn) return true
      if (cell.length > 30) return false // skip long cells — not a crew name header
      const escaped = kn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`).test(cell)
    }

    // Scan ALL rows for crew header rows (rows with 2+ team member name matches)
    const sections = []

    for (let i = 0; i < raw.length; i++) {
      // Skip rows with a valid date in the date column — data rows aren't crew headers
      const rowDateVal = (raw[i] || [])[dateCol]
      if (rowDateVal != null && excelDateToISO(rowDateVal)) continue

      const cells = (raw[i] || []).map(v => String(v || '').toLowerCase().trim())
      const found = []

      cells.forEach((cell, ci) => {
        if (ci <= dateCol || !cell) return // skip date column(s) and empty cells
        for (const kn of knownNames) {
          if (cellMatchesKnownName(cell, kn)) {
            found.push({ colIdx: ci, rawName: String(raw[i][ci]).trim() })
            break
          }
        }
      })

      if (found.length >= 2) {
        sections.push({ hdrIdx: i, crewCols: found })
      }
    }

    // Debug: log all detected header rows
    console.log(`[Import] Found ${sections.length} crew header section(s)`)
    sections.forEach((sec, si) => {
      const headerRow = raw[sec.hdrIdx] || []
      console.log(`[Import] Section ${si + 1} — header row ${sec.hdrIdx} (${sec.crewCols.length} crew):`)
      headerRow.forEach((cell, ci) => {
        const val = String(cell ?? '').trim()
        if (!val) return
        const lower = val.toLowerCase()
        const matchedName = knownNames.find(kn => cellMatchesKnownName(lower, kn))
        const inCrew = sec.crewCols.some(c => c.colIdx === ci)
        console.log(`  Col ${ci}: "${val}" → ${matchedName ? `matched "${matchedName}"` : 'no match'}${inCrew ? ' ✓ CREW' : ''}`)
      })
    })

    if (sections.length === 0) {
      console.log('[Import] No crew header rows found in the sheet')
      setScheduleRows([]); setCrewMapping([]); return
    }

    // Build crew config for each section
    let allCrewConfig = [] // merged across all sections for UI display

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si]
      const { hdrIdx, crewCols } = sec

      // Check for sub-header row — search up to 10 rows below the header
      let subHdrRow = null
      let subHdrIdx = -1
      const firstCrewCol = crewCols[0].colIdx
      const lastCrewCol = crewCols[crewCols.length - 1].colIdx
      const nextSecHdr = si < sections.length - 1 ? sections[si + 1].hdrIdx : raw.length

      console.log(`[Import] Section ${si + 1}: searching for sub-headers below header row ${hdrIdx} (crew cols ${firstCrewCol}–${lastCrewCol}, next section at row ${nextSecHdr})`)

      // Dump raw cell values for rows near this section header
      const dumpEnd = Math.min(hdrIdx + 13, raw.length)
      for (let di = hdrIdx; di < dumpEnd; di++) {
        const dumpRow = raw[di] || []
        const vals = []
        for (let ci = 0; ci < Math.min(dumpRow.length, lastCrewCol + 6); ci++) {
          const v = dumpRow[ci]
          if (v != null && String(v).trim()) vals.push(`[${ci}]="${String(v).trim().substring(0, 30)}"`)
        }
        console.log(`[Import]   Dump row ${di}: ${vals.length > 0 ? vals.join(' ') : '(empty)'}`)
      }

      for (let offset = 1; offset <= 10; offset++) {
        const checkIdx = hdrIdx + offset
        if (checkIdx >= raw.length) break
        // Stop at next section's header — sub-headers beyond that belong to it
        if (checkIdx >= nextSecHdr) {
          console.log(`[Import]   Row ${checkIdx}: reached next section header — stopping search`)
          break
        }

        const checkRow = (raw[checkIdx] || []).map(v => String(v || '').toLowerCase().trim())

        // Log cells near crew columns
        const nearby = []
        for (let ci = firstCrewCol; ci < lastCrewCol + 6 && ci < checkRow.length; ci++) {
          if (checkRow[ci]) nearby.push(`[${ci}]="${checkRow[ci]}"`)
        }
        console.log(`[Import]   Scan row ${checkIdx}: ${nearby.length > 0 ? nearby.join(' ') : '(empty near crew cols)'}`)

        // Check for sub-header keywords near ALL crew columns (not just first 3)
        let foundSubHdr = false
        for (const cc of crewCols) {
          for (let ci = cc.colIdx; ci <= cc.colIdx + 4 && ci < checkRow.length; ci++) {
            const v = checkRow[ci] || ''
            if (v && v.length < 15 && (v.includes('hour') || v === 'hrs' || v.includes('gp'))) {
              foundSubHdr = true
              break
            }
          }
          if (foundSubHdr) break
        }

        // Fallback: check entire row for sub-header keywords
        if (!foundSubHdr) {
          foundSubHdr = checkRow.some(v =>
            v && v.length > 0 && v.length < 15 &&
            (v === 'hours' || v === 'hrs' || v === 'hour' || v.includes('gp'))
          )
        }

        if (foundSubHdr) {
          subHdrRow = checkRow
          subHdrIdx = checkIdx
          console.log(`[Import]   → Sub-headers found at row ${checkIdx}`)
          break
        }
      }

      if (!subHdrRow) {
        console.log(`[Import]   → No sub-headers found for section ${si + 1} — hours/GP will be unavailable`)
      }

      const hasSubHeaders = subHdrRow !== null

      sec.dataStart = hasSubHeaders ? subHdrIdx + 1 : hdrIdx + 1
      // Data rows end at the next section's header row, or end of sheet
      sec.dataEnd = si < sections.length - 1 ? sections[si + 1].hdrIdx : raw.length

      let crewConfig = []

      if (hasSubHeaders) {
        let blockWidth = 4
        if (crewCols.length >= 2) {
          const gap = crewCols[1].colIdx - crewCols[0].colIdx
          if (gap >= 3 && gap <= 6) blockWidth = gap
        }

        console.log(`[Import] Section ${si + 1}: sub-headers at row ${subHdrIdx}, blockWidth=${blockWidth}, data rows ${sec.dataStart}–${sec.dataEnd - 1}`)

        for (let c = 0; c < crewCols.length; c++) {
          const startC = crewCols[c].colIdx
          const endC = c < crewCols.length - 1 ? crewCols[c + 1].colIdx : startC + blockWidth

          // Scan sub-header row for actual column positions within this crew's block
          let hoursCol = startC + 1   // default
          let gpEarnedCol = startC + 3 // default
          for (let ci = startC + 1; ci < endC; ci++) {
            const sh = subHdrRow[ci] || ''
            if (sh === 'hours' || sh === 'hrs' || sh.includes('hour')) hoursCol = ci
            if (sh.includes('gp')) gpEarnedCol = ci // rightmost gp column = GP Earned
          }

          console.log(`[Import]   ${crewCols[c].rawName}: jobCol=${startC}, hoursCol=${hoursCol}, gpEarnedCol=${gpEarnedCol} (scanned cols ${startC + 1}–${endC - 1})`)

          crewConfig.push({
            rawName: crewCols[c].rawName,
            jobCol: startC,
            hoursCol,
            gpEarnedCol,
            member: matchTeamMember(crewCols[c].rawName, members),
          })
        }
      } else {
        crewConfig = crewCols.map(cc => ({
          rawName: cc.rawName,
          jobCol: cc.colIdx,
          hoursCol: -1,
          gpEarnedCol: -1,
          member: matchTeamMember(cc.rawName, members),
        }))
      }

      sec.crewConfig = crewConfig
      allCrewConfig = allCrewConfig.concat(crewConfig)
    }

    // Dedup: prevent same team member being assigned to multiple columns (across all sections)
    const seenMemberIds = new Set()
    allCrewConfig = allCrewConfig.filter(cc => {
      if (!cc.member) return true
      if (seenMemberIds.has(cc.member.id)) {
        console.log(`[Import] Removing duplicate crew column for ${cc.member.name} at col ${cc.jobCol}`)
        return false
      }
      seenMemberIds.add(cc.member.id)
      return true
    })

    // Also dedup within each section's crewConfig (for data parsing)
    const seenMemberIds2 = new Set()
    for (const sec of sections) {
      sec.crewConfig = sec.crewConfig.filter(cc => {
        if (!cc.member) return true
        if (seenMemberIds2.has(cc.member.id)) return false
        seenMemberIds2.add(cc.member.id)
        return true
      })
    }

    // Log final crew config
    console.log('[Import] Final crew config (all sections):')
    allCrewConfig.forEach(cc => {
      console.log(`  "${cc.rawName}" col ${cc.jobCol} → ${cc.member?.name || 'UNMATCHED'} (hours=${cc.hoursCol}, gpEarned=${cc.gpEarnedCol})`)
    })

    setCrewMapping(allCrewConfig.map(c => ({ rawName: c.rawName, member: c.member })))

    // Parse data rows from each section
    const entries = []

    for (const sec of sections) {
      for (let i = sec.dataStart; i < sec.dataEnd; i++) {
        const row = raw[i]
        if (!row) continue

        const dateStr = excelDateToISO(row[dateCol])
        if (!dateStr) continue

        // Skip weekends
        if (isWeekend(new Date(dateStr + 'T12:00:00'))) continue

        for (const cc of sec.crewConfig) {
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

          // Skip entries where "job name" is purely numeric (data from adjacent column)
          if (/^\d+(\.\d+)?$/.test(jobName)) continue

          // Hours from dedicated column, default 8
          let hours = 8
          if (cc.hoursCol >= 0) {
            const h = cleanNum(row[cc.hoursCol])
            if (h > 0 && h <= 24) hours = h
          }

          // Detect non-productive entries (holiday, sick, etc.) — import with correct entry_type
          const nonProdType = detectNonProductive(jobName)
          if (nonProdType) {
            entries.push({
              date: dateStr,
              team_member_id: cc.member.id,
              memberName: cc.member.name,
              jobName,
              hours,
              gpEarned: 0,
              entry_type: nonProdType,
              job_id: null,
              jobMatched: true,
            })
            continue
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
    }

    // Deduplicate: keep first entry per (date, team_member_id, jobName)
    const seen = new Set()
    const deduped = entries.filter(e => {
      const key = `${e.date}|${e.team_member_id}|${e.jobName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setScheduleRows(deduped)
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
      // Fetch existing entries for the date range to detect duplicates
      const dates = [...new Set(valid.map(e => e.date))].sort()
      const { data: existing } = await supabase
        .from('schedule_entries')
        .select('team_member_id, date, job_id')
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])

      const existingKeys = new Set(
        (existing || []).map(e => `${e.team_member_id}|${e.date}|${e.job_id || ''}`)
      )

      const payloads = valid
        .map(e => ({
          team_member_id: e.team_member_id,
          job_id: e.entry_type === 'job' ? e.job_id : null,
          entry_type: e.entry_type,
          date: e.date,
          hours: e.hours,
          gp_earned: e.gpEarned || 0,
        }))
        .filter(e => !existingKeys.has(`${e.team_member_id}|${e.date}|${e.job_id || ''}`))

      const skipped = valid.length - payloads.length

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

      const msg = `${total} schedule entries imported.` + (skipped > 0 ? ` ${skipped} duplicates skipped.` : '')
      setSchedStatus({ success: true, message: msg })
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
  const unmatchedJobNames = [...new Set(scheduleRows.filter(e => e.entry_type === 'job' && !e.jobMatched).map(e => e.jobName))]
  const nonProdCount = scheduleRows.filter(e => e.entry_type !== 'job').length

  /* ---- Render ---- */

  return (
    <div className="p-4 space-y-6">
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
                {scheduleRows.length} entries parsed
                {nonProdCount > 0 && ` (${nonProdCount} non-productive)`}
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
