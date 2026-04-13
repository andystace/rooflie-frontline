import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, eachDayOfInterval, isWeekend, parseISO } from 'date-fns'
import { useTeam } from '../hooks/useTeam'
import { useJobs } from '../hooks/useJobs'
import { useSchedule } from '../hooks/useSchedule'
import { useTargets } from '../hooks/useTargets'
import { supabase } from '../lib/supabase'
import { ENTRY_TYPES, JOB_COLOURS } from '../lib/constants'
import { calcMonthGpForecast, calcUtilisation, calcMonthTurnover, calcJobOverrunMap, getOverrunStatus } from '../lib/calculations'
import SummaryStrip from '../components/SummaryStrip'
import QuickEntryPopup from '../components/QuickEntryPopup'
import ScheduleEntryModal from '../components/ScheduleEntryModal'

export default function SchedulePage() {
  const calendarRef = useRef(null)
  const { activeTeam, sortedActiveTeam, team } = useTeam()
  const { jobs } = useJobs()
  const { entries, fetchEntries, createEntry, createEntries, updateEntry, deleteEntry } = useSchedule()
  const { getTarget } = useTargets()

  const [viewType, setViewType] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [quickEntry, setQuickEntry] = useState(null)   // fast add popup
  const [editEntry, setEditEntry] = useState(null)      // edit existing
  const [allJobEntries, setAllJobEntries] = useState([])

  // Compute date range based on view
  const dateRange = useMemo(() => {
    if (viewType === 'week') {
      return {
        start: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    }
    return {
      start: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
      end: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
    }
  }, [currentDate, viewType])

  useEffect(() => {
    fetchEntries(dateRange.start, dateRange.end)
  }, [dateRange.start, dateRange.end, fetchEntries])

  // Fetch ALL job-type schedule entries for overrun detection
  useEffect(() => {
    async function loadAllJobEntries() {
      const { data } = await supabase
        .from('schedule_entries')
        .select('job_id, hours, entry_type')
        .eq('entry_type', 'job')
      setAllJobEntries(data || [])
    }
    loadAllJobEntries()
  }, [entries]) // re-fetch when visible entries change (i.e. user added/moved something)

  const overrunMap = useMemo(() => calcJobOverrunMap(allJobEntries, jobs), [allJobEntries, jobs])

  // Sync FullCalendar view when our state changes
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.gotoDate(currentDate)
  }, [currentDate])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    const fcView = viewType === 'week' ? 'resourceTimelineWeek' : 'resourceTimelineMonth'
    if (api.view.type !== fcView) api.changeView(fcView)
  }, [viewType])

  // Map team to FullCalendar resources — sorted by activity + role
  const resources = useMemo(() => {
    return sortedActiveTeam.map(m => ({
      id: m.id,
      title: m.name,
      role: m.role,
      group: m.role === 'subcontractor' ? 'Subcontractors' : 'Team',
    }))
  }, [sortedActiveTeam])

  // Build a stable colour map for jobs
  const jobColourMap = useMemo(() => {
    const map = {}
    jobs.forEach((j, i) => {
      map[j.id] = JOB_COLOURS[i % JOB_COLOURS.length]
    })
    return map
  }, [jobs])

  // Map entries to FullCalendar events
  const events = useMemo(() =>
    entries.map(e => {
      let colour
      let title
      let overrunStatus = 'ok'
      if (e.entry_type === 'job') {
        colour = e.job_id ? (jobColourMap[e.job_id] || '#6B7280') : '#6B7280'
        const jobName = e.jobs?.job_name || 'Unassigned'
        const jobNo = e.jobs?.job_no
        title = jobNo ? `${jobNo} — ${jobName}` : jobName
        // Override colour for overrun/warning
        if (e.job_id && overrunMap[e.job_id]) {
          overrunStatus = getOverrunStatus(overrunMap[e.job_id].ratio)
          if (overrunStatus === 'overrun') colour = '#EF4444'
          else if (overrunStatus === 'warning') colour = '#F59E0B'
        }
      } else {
        const et = ENTRY_TYPES.find(t => t.value === e.entry_type)
        colour = et?.colour || '#6B7280'
        title = et?.label || e.entry_type
      }

      return {
        id: e.id,
        resourceId: e.team_member_id,
        start: e.date,
        end: e.date,
        allDay: true,
        title,
        backgroundColor: colour,
        borderColor: colour,
        textColor: '#fff',
        extendedProps: { ...e, overrunStatus },
      }
    }),
  [entries, jobColourMap, overrunMap])

  // Summary strip calculations
  const monthKey = format(currentDate, 'yyyy-MM')
  const target = getTarget(monthKey)
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEntries = entries.filter(e => e.date >= monthStart && e.date <= monthEnd)
  const gpForecast = calcMonthGpForecast(monthEntries, jobs)
  const monthTurnover = calcMonthTurnover(monthEntries, jobs)
  const utilisation = calcUtilisation(monthEntries, activeTeam.length, 22)

  // Navigation
  function navigate(direction) {
    setCurrentDate(prev => {
      if (viewType === 'week') return addWeeks(prev, direction)
      return addMonths(prev, direction)
    })
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  // Click on empty cell -> open quick-add popup
  function handleDateSelect(info) {
    const memberId = info.resource?.id
    const dateStr = info.startStr
    if (!memberId) return
    setQuickEntry({ memberId, dateStr })
  }

  // Tap on date cell (touch devices) — dateClick fires on single tap
  // whereas select requires a long press on touch
  function handleDateClick(info) {
    const memberId = info.resource?.id
    if (!memberId) return
    const dateStr = info.dateStr
    setQuickEntry({ memberId, dateStr })
  }

  // Click existing event -> edit modal
  function handleEventClick(info) {
    const e = info.event.extendedProps
    const member = team.find(m => m.id === e.team_member_id)
    setEditEntry({ entry: e, teamMember: member })
  }

  // Drag and drop
  function handleEventDrop(info) {
    const entryId = info.event.id
    const newDate = format(info.event.start, 'yyyy-MM-dd')
    const newResource = info.newResource?.id || info.event.getResources()[0]?.id
    const payload = { date: newDate }
    if (newResource) payload.team_member_id = newResource
    updateEntry(entryId, payload)
  }

  // Quick-add handler: create entries across date range + optional partner
  const handleQuickAdd = useCallback(async (jobId, entryType, hours, withPartner, partner, dateRange) => {
    const q = quickEntry
    if (!q) return

    const { startDate, endDate, includeWeekends } = dateRange
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    const dates = eachDayOfInterval({ start, end })
      .filter(d => includeWeekends || !isWeekend(d))
      .map(d => format(d, 'yyyy-MM-dd'))

    const payloads = []
    for (const date of dates) {
      payloads.push({
        team_member_id: q.memberId,
        date,
        entry_type: entryType || 'job',
        job_id: entryType === 'job' ? jobId : null,
        hours,
      })
      if (withPartner && partner) {
        payloads.push({
          team_member_id: partner.id,
          date,
          entry_type: entryType || 'job',
          job_id: entryType === 'job' ? jobId : null,
          hours,
        })
      }
    }

    if (payloads.length === 1) {
      await createEntry(payloads[0])
    } else if (payloads.length > 1) {
      await createEntries(payloads)
    }

    setQuickEntry(null)
  }, [quickEntry, createEntry, createEntries])

  // Edit-save handler
  const handleEditSave = useCallback(async (formData) => {
    if (formData.id) {
      const { id, team_members, jobs: _j, ...rest } = formData
      await updateEntry(id, rest)
    }
  }, [updateEntry])

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-3">
      <SummaryStrip
        gpForecast={gpForecast}
        gpTarget={target?.gp_target}
        breakeven={target?.breakeven}
        utilisation={utilisation}
        monthTurnover={monthTurnover}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-navy" />
          <h2 className="text-lg font-bold text-navy">Schedule</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {['week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setViewType(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewType === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-md">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-100 rounded-md">
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded-md">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
          <span className="text-sm font-semibold text-navy min-w-[140px] text-center">
            {viewType === 'week'
              ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM')} — ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView={viewType === 'week' ? 'resourceTimelineWeek' : 'resourceTimelineMonth'}
          initialDate={currentDate}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          resources={resources}
          resourceGroupField="group"
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          selectOverlap={true}
          eventOverlap={true}
          longPressDelay={200}
          selectLongPressDelay={300}
          eventLongPressDelay={200}
          slotDuration={{ days: 1 }}
          slotLabelInterval={{ days: 1 }}
          slotLabelFormat={{ weekday: 'short', day: 'numeric' }}
          resourceAreaWidth="180px"
          resourceAreaHeaderContent="Team"
          slotMinWidth={viewType === 'week' ? 110 : 40}
          height="auto"
          headerToolbar={false}
          firstDay={1}
          weekends={true}
          nowIndicator={true}
          dateClick={handleDateClick}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          resourceLabelContent={(arg) => (
            <div className="flex items-center gap-2 py-1">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeTeam.find(m => m.id === arg.resource.id)?.colour || '#6B7280' }}
              />
              <span className="text-sm font-medium truncate">{arg.resource.title}</span>
            </div>
          )}
          eventContent={(arg) => {
            const hours = arg.event.extendedProps.hours ?? 8
            const status = arg.event.extendedProps.overrunStatus
            return (
              <div className="px-1.5 py-0.5 text-xs font-medium truncate leading-tight flex items-center gap-0.5">
                {(status === 'warning' || status === 'overrun') && (
                  <AlertTriangle size={12} className="flex-shrink-0" />
                )}
                {arg.event.title} <span className="opacity-75">({hours}h)</span>
              </div>
            )
          }}
        />
      </div>

      {/* Quick-add popup */}
      {quickEntry && (
        <QuickEntryPopup
          memberId={quickEntry.memberId}
          dateStr={quickEntry.dateStr}
          team={team}
          jobs={jobs}
          onAdd={handleQuickAdd}
          onClose={() => setQuickEntry(null)}
        />
      )}

      {/* Edit existing entry modal */}
      {editEntry && (
        <ScheduleEntryModal
          entry={editEntry.entry}
          jobs={jobs}
          teamMember={editEntry.teamMember}
          partner={null}
          onSave={handleEditSave}
          onDelete={deleteEntry}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  )
}
