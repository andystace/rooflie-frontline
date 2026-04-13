import { useState, useRef, useEffect } from 'react'
import { X, UserPlus, Clock, Search, CalendarRange } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ENTRY_TYPES } from '../lib/constants'
import { eachDayOfInterval, isWeekend, format, parseISO, addDays } from 'date-fns'

const NON_PRODUCTIVE = ENTRY_TYPES.filter(t => t.value !== 'job')

export default function QuickEntryPopup({ memberId, dateStr, team, jobs, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hours, setHours] = useState(8)
  const [addPartner, setAddPartner] = useState(false)
  const [mode, setMode] = useState('job') // 'job' | 'non-productive'
  const [endDate, setEndDate] = useState(dateStr)
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [member, setMember] = useState(null)
  const [partner, setPartner] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  // Fetch member and partner directly from Supabase — bypasses any hook/state issues
  useEffect(() => {
    if (!memberId) return
    async function loadMemberAndPartner() {
      const { data: memberData, error: memberErr } = await supabase
        .from('team_members')
        .select('*')
        .eq('id', memberId)
        .single()
      if (memberErr || !memberData) {
        console.error('[QuickEntry] Failed to load member:', memberErr)
        return
      }
      setMember(memberData)

      if (memberData.default_partner_id) {
        const { data: partnerData } = await supabase
          .from('team_members')
          .select('*')
          .eq('id', memberData.default_partner_id)
          .eq('active', true)
          .single()
        if (partnerData) {
          setPartner(partnerData)
        }
      }
    }
    loadMemberAndPartner()
  }, [memberId])

  // Format the date nicely
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const d = new Date(dateStr + 'T12:00:00')
  const dateLabel = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`

  // Compute how many days are in the range
  const dayCount = (() => {
    const start = parseISO(dateStr)
    const end = parseISO(endDate)
    if (end < start) return 1
    const days = eachDayOfInterval({ start, end })
    return includeWeekends ? days.length : days.filter(d => !isWeekend(d)).length
  })()

  const isMultiDay = endDate > dateStr

  // Filter jobs by search
  const activeJobs = jobs.filter(j => j.status !== 'complete')
  const filtered = search.trim() === ''
    ? activeJobs.slice(0, 8)
    : activeJobs.filter(j => {
        const q = search.toLowerCase()
        return (
          j.job_name?.toLowerCase().includes(q) ||
          String(j.job_no).includes(q) ||
          j.customer?.toLowerCase().includes(q)
        )
      }).slice(0, 8)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0)
  }, [search])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIdx]) {
        handleSelectJob(filtered[selectedIdx])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  function handleSelectJob(job) {
    onAdd(job.id, 'job', hours, addPartner, partner, { startDate: dateStr, endDate, includeWeekends })
  }

  function selectNonProductive(type) {
    onAdd(null, type, hours, false, null, { startDate: dateStr, endDate: dateStr, includeWeekends: false })
  }

  // Default end date to Friday of the same week
  function setEndToFriday() {
    const start = parseISO(dateStr)
    const day = start.getDay()
    const daysToFri = day <= 5 ? 5 - day : 6
    if (daysToFri > 0) {
      setEndDate(format(addDays(start, daysToFri), 'yyyy-MM-dd'))
    }
  }

  // Total entries to be created
  const entryCount = dayCount * (addPartner && partner ? 2 : 1)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-navy text-white flex items-center justify-between">
          <div className="text-sm">
            <span className="font-bold">{member?.name || 'Team member'}</span>
            <span className="ml-2 opacity-70">{dateLabel}</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-white/20 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle + hours */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setMode('job')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${mode === 'job' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
            >
              Job
            </button>
            <button
              onClick={() => setMode('non-productive')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${mode === 'non-productive' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
            >
              Non-productive
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            <input
              type="number"
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              min="0.5"
              max="24"
              step="0.5"
              className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center tabular-nums"
            />
            <span className="text-xs text-gray-400">hrs</span>
          </div>
        </div>

        {/* Partner prompt — shown immediately when partner exists */}
        {partner && mode === 'job' && (
          <div className="px-4 py-2.5 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
            <div className="text-sm flex items-center gap-1.5">
              <UserPlus size={14} className="text-blue-600" />
              Also schedule <strong>{partner.name}</strong>?
            </div>
            <button
              onClick={() => setAddPartner(!addPartner)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                addPartner ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-300'
              }`}
            >
              {addPartner ? 'Yes' : 'No'}
            </button>
          </div>
        )}

        {/* Multi-day date range (job mode only) */}
        {mode === 'job' && (
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarRange size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-600">Date range</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-gray-500">From</span>
                <input
                  type="date"
                  value={dateStr}
                  disabled
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-gray-100 text-gray-600 tabular-nums"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-gray-500">To</span>
                <input
                  type="date"
                  value={endDate}
                  min={dateStr}
                  onChange={e => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                />
              </div>
              <button
                onClick={setEndToFriday}
                className="text-xs text-orange hover:text-orange-dark font-medium whitespace-nowrap"
                title="Set end date to Friday"
              >
                &rarr; Fri
              </button>
            </div>
            {isMultiDay && (
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWeekends}
                    onChange={e => setIncludeWeekends(e.target.checked)}
                    className="rounded border-gray-300 text-orange focus:ring-orange"
                  />
                  Include weekends
                </label>
                <span className="text-xs text-gray-500 tabular-nums">
                  {dayCount} day{dayCount !== 1 ? 's' : ''}
                  {addPartner && partner ? ` \u00D7 2 people = ${entryCount} entries` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {mode === 'job' ? (
          <>
            {/* Search input */}
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type job name, number or customer..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Job results */}
            <div className="max-h-[240px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No matching jobs
                </div>
              ) : (
                filtered.map((job, i) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      i === selectedIdx ? 'bg-orange/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-gray-400 flex-shrink-0">{job.job_no || '\u2014'}</span>
                      <span className="text-gray-400 flex-shrink-0">\u2014</span>
                      <span className="font-medium truncate">{job.job_name}</span>
                      {job.customer && (
                        <>
                          <span className="text-gray-300 flex-shrink-0">\u2014</span>
                          <span className="text-gray-500 truncate">{job.customer}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* Non-productive options */
          <div className="py-1">
            {NON_PRODUCTIVE.map(t => (
              <button
                key={t.value}
                onClick={() => selectNonProductive(t.value)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.colour }} />
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
