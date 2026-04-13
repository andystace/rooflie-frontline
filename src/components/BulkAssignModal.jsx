import { useState, useMemo } from 'react'
import { X, Users, Search, CalendarRange, Check } from 'lucide-react'
import { eachDayOfInterval, isWeekend, format, parseISO, addDays } from 'date-fns'

export default function BulkAssignModal({ team, jobs, onAssign, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [selectedMembers, setSelectedMembers] = useState(new Set())
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [hours, setHours] = useState(8)
  const [saving, setSaving] = useState(false)

  const activeJobs = jobs.filter(j => j.status !== 'complete')
  const activeTeam = team.filter(m => m.active)

  // Split into employees and subcontractors
  const employees = activeTeam.filter(m => m.role !== 'subcontractor')
  const subcontractors = activeTeam.filter(m => m.role === 'subcontractor')

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return activeJobs.slice(0, 10)
    const q = search.toLowerCase()
    return activeJobs.filter(j =>
      j.job_name?.toLowerCase().includes(q) ||
      String(j.job_no).includes(q) ||
      j.customer?.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [search, activeJobs])

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  // Count working days in range
  const dayCount = useMemo(() => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    if (end < start) return 0
    const days = eachDayOfInterval({ start, end })
    return includeWeekends ? days.length : days.filter(d => !isWeekend(d)).length
  }, [startDate, endDate, includeWeekends])

  const totalEntries = dayCount * selectedMembers.size

  function toggleMember(id) {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllEmployees() {
    const allSelected = employees.every(m => selectedMembers.has(m.id))
    setSelectedMembers(prev => {
      const next = new Set(prev)
      employees.forEach(m => {
        if (allSelected) next.delete(m.id)
        else next.add(m.id)
      })
      return next
    })
  }

  function setEndToFriday() {
    const start = parseISO(startDate)
    const day = start.getDay()
    const daysToFri = day <= 5 ? 5 - day : 6
    if (daysToFri > 0) {
      setEndDate(format(addDays(start, daysToFri), 'yyyy-MM-dd'))
    }
  }

  async function handleSubmit() {
    if (!selectedJobId || selectedMembers.size === 0 || dayCount === 0) return
    setSaving(true)
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      const dates = eachDayOfInterval({ start, end })
        .filter(d => includeWeekends || !isWeekend(d))
        .map(d => format(d, 'yyyy-MM-dd'))

      const payloads = []
      for (const date of dates) {
        for (const memberId of selectedMembers) {
          payloads.push({
            team_member_id: memberId,
            date,
            entry_type: 'job',
            job_id: selectedJobId,
            hours,
          })
        }
      }

      await onAssign(payloads)
      onClose()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[6vh] px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-navy text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Users size={16} />
            Bulk Assign Crew
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-white/20 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Step 1: Select job */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">1. Select Job</div>
            {selectedJob ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="text-sm">
                  <span className="font-mono text-gray-500">{selectedJob.job_no || '\u2014'}</span>
                  <span className="mx-1.5 text-gray-300">\u2014</span>
                  <span className="font-medium">{selectedJob.job_name}</span>
                </div>
                <button
                  onClick={() => setSelectedJobId(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by job name, number or customer..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div className="max-h-[160px] overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredJobs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-gray-400">No matching jobs</div>
                  ) : (
                    filteredJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange/10 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <span className="font-mono text-gray-400">{job.job_no || '\u2014'}</span>
                        <span className="mx-1.5 text-gray-300">\u2014</span>
                        <span className="font-medium">{job.job_name}</span>
                        {job.customer && (
                          <span className="text-gray-400 ml-1.5">({job.customer})</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Step 2: Select crew */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2. Select Crew</div>
              <button
                onClick={selectAllEmployees}
                className="text-xs text-orange hover:text-orange-dark font-medium"
              >
                {employees.every(m => selectedMembers.has(m.id)) ? 'Deselect' : 'Select'} all employees
              </button>
            </div>

            {/* Employees */}
            <div className="text-xs font-medium text-gray-400 mb-1">Employees</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {employees.map(m => (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    selectedMembers.has(m.id) ? 'bg-orange/10 ring-1 ring-orange/30' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={() => toggleMember(m.id)}
                    className="rounded border-gray-300 text-orange focus:ring-orange"
                  />
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.colour || '#6B7280' }}
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>

            {/* Subcontractors */}
            {subcontractors.length > 0 && (
              <>
                <div className="text-xs font-medium text-gray-400 mb-1">Subcontractors</div>
                <div className="grid grid-cols-2 gap-1">
                  {subcontractors.map(m => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        selectedMembers.has(m.id) ? 'bg-orange/10 ring-1 ring-orange/30' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                        className="rounded border-gray-300 text-orange focus:ring-orange"
                      />
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: m.colour || '#6B7280' }}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Step 3: Date range and hours */}
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">3. Date Range & Hours</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-gray-500">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value)
                    if (e.target.value > endDate) setEndDate(e.target.value)
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-gray-500">To</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWeekends}
                  onChange={e => setIncludeWeekends(e.target.checked)}
                  className="rounded border-gray-300 text-orange focus:ring-orange"
                />
                Include weekends
              </label>
              <div className="flex items-center gap-1.5">
                <CalendarRange size={14} className="text-gray-400" />
                <input
                  type="number"
                  value={hours}
                  onChange={e => setHours(Number(e.target.value))}
                  min="0.5"
                  max="24"
                  step="0.5"
                  className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                />
                <span className="text-xs text-gray-400">hrs/day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 tabular-nums">
            {selectedMembers.size > 0 && dayCount > 0 ? (
              <>
                {selectedMembers.size} crew &times; {dayCount} day{dayCount !== 1 ? 's' : ''} = <strong className="text-navy">{totalEntries} entries</strong>
              </>
            ) : (
              'Select a job, crew, and dates'
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !selectedJobId || selectedMembers.size === 0 || dayCount === 0}
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
            >
              <Check size={14} />
              {saving ? 'Creating...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
