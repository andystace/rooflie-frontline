import { useState, useEffect, useMemo } from 'react'
import { BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react'
import { format, startOfWeek, addWeeks, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns'
import { supabase } from '../lib/supabase'
import { calcEntryGp, formatCurrency, formatPercent, calcJobMetrics, calcMonthTurnover, calcJobOverrunMap, getOverrunStatus } from '../lib/calculations'
import { useTargets } from '../hooks/useTargets'

export default function DashboardPage() {
  const [jobs, setJobs] = useState([])
  const [team, setTeam] = useState([])
  const [entries, setEntries] = useState([])
  const [variations, setVariations] = useState([])
  const [loading, setLoading] = useState(true)
  const { getTarget } = useTargets()

  const currentMonth = format(new Date(), 'yyyy-MM')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [jobsRes, teamRes, entriesRes, varRes] = await Promise.all([
        supabase.from('jobs').select('*'),
        supabase.from('team_members').select('*').eq('active', true).order('display_order'),
        supabase.from('schedule_entries').select('*, jobs(job_name, job_no, sold_gp, hours_allowed)'),
        supabase.from('variations').select('*'),
      ])
      setJobs(jobsRes.data || [])
      setTeam(teamRes.data || [])
      setEntries(entriesRes.data || [])
      setVariations(varRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Filter to current month for GP calculations
  const monthEntries = useMemo(
    () => entries.filter(e => e.date >= monthStart && e.date <= monthEnd),
    [entries, monthStart, monthEnd]
  )

  const target = getTarget(currentMonth)

  // GP per person this month
  const gpByPerson = useMemo(() => {
    return team.map(member => {
      const memberEntries = monthEntries.filter(e => e.team_member_id === member.id && e.entry_type === 'job')
      let gp = 0
      for (const e of memberEntries) {
        // Use stored gp_earned first, then calculate from job
        const storedGp = Number(e.gp_earned || 0)
        if (storedGp > 0) {
          gp += storedGp
        } else {
          const job = jobs.find(j => j.id === e.job_id)
          if (job) gp += calcEntryGp(e, job)
        }
      }
      const totalHours = memberEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
      return { member, gp, totalHours }
    }).sort((a, b) => b.gp - a.gp)
  }, [team, monthEntries, jobs])

  // GP per week
  const weeklyGp = useMemo(() => {
    const start = startOfMonth(new Date())
    const end = endOfMonth(new Date())
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
    return weeks.map(weekStart => {
      const ws = format(weekStart, 'yyyy-MM-dd')
      const we = format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEntries = monthEntries.filter(e => e.date >= ws && e.date <= we && e.entry_type === 'job')
      let gp = 0
      for (const e of weekEntries) {
        const storedGp = Number(e.gp_earned || 0)
        if (storedGp > 0) {
          gp += storedGp
        } else {
          const job = jobs.find(j => j.id === e.job_id)
          if (job) gp += calcEntryGp(e, job)
        }
      }
      return { weekStart: format(weekStart, 'd MMM'), gp }
    })
  }, [monthEntries, jobs])

  // Job profitability league table (uses ALL entries for accurate total hours)
  const jobProfitability = useMemo(() => {
    return jobs
      .filter(j => j.status === 'in_progress' || j.status === 'confirmed')
      .map(job => {
        const jobVars = variations.filter(v => v.job_id === job.id)
        const jobEntries = entries.filter(e => e.job_id === job.id)
        const metrics = calcJobMetrics(job, jobEntries, jobVars)
        return { job, metrics }
      })
      .sort((a, b) => b.metrics.gpPerHour - a.metrics.gpPerHour)
  }, [jobs, entries, variations])

  // Overrun map and alerts
  const overrunMap = useMemo(() => calcJobOverrunMap(entries, jobs), [entries, jobs])
  const overrunJobs = useMemo(() => {
    return jobProfitability
      .filter(({ metrics }) => metrics.labourPercent >= 0.9)
      .sort((a, b) => b.metrics.labourPercent - a.metrics.labourPercent)
  }, [jobProfitability])

  // Month turnover
  const monthTurnover = useMemo(() => calcMonthTurnover(monthEntries, jobs), [monthEntries, jobs])

  // Totals
  const totalGp = gpByPerson.reduce((s, p) => s + p.gp, 0)
  const totalProductiveHours = monthEntries.filter(e => e.entry_type === 'job').reduce((s, e) => s + Number(e.hours || 0), 0)
  const totalAvailableHours = team.length * 22 * 8 // rough estimate
  const utilisation = totalAvailableHours > 0 ? totalProductiveHours / totalAvailableHours : 0

  // Max GP for bar scaling
  const maxGp = Math.max(...gpByPerson.map(p => p.gp), 1)

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={24} className="text-navy" />
          <h2 className="text-xl font-bold text-navy">Dashboard</h2>
        </div>
        <div className="text-center text-gray-400 p-8">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={24} className="text-navy" />
        <h2 className="text-xl font-bold text-navy">GP & Capacity Dashboard</h2>
        <span className="text-sm text-gray-400 ml-2">{format(new Date(), 'MMMM yyyy')}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <DashCard label="Month GP Forecast" value={formatCurrency(totalGp)} highlight />
        <DashCard label="Month Turnover" value={formatCurrency(monthTurnover)} />
        <DashCard label="GP Target" value={formatCurrency(target?.gp_target)} />
        <DashCard
          label="Variance"
          value={formatCurrency(Math.abs(totalGp - (target?.gp_target || 0)))}
          sub={totalGp >= (target?.gp_target || 0) ? 'Above target' : 'Below target'}
          warn={totalGp < (target?.gp_target || 0)}
        />
        <DashCard label="Breakeven" value={formatCurrency(target?.breakeven)} />
        <DashCard label="Utilisation" value={formatPercent(utilisation)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GP per person */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <Users size={16} />
            GP per Person — {format(new Date(), 'MMMM')}
          </h3>
          <div className="space-y-2">
            {gpByPerson.map(({ member, gp, totalHours }) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium truncate">{member.name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-2"
                    style={{
                      width: `${Math.max((gp / maxGp) * 100, 2)}%`,
                      backgroundColor: member.colour || '#6B7280',
                    }}
                  >
                    {gp > 0 && (
                      <span className="text-white text-xs font-bold truncate">
                        {formatCurrency(gp)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 w-12 text-right">{totalHours}h</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly GP chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            GP per Week
          </h3>
          {weeklyGp.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {weeklyGp.map((w, i) => {
                const maxWeekGp = Math.max(...weeklyGp.map(x => x.gp), 1)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-500">w/c {w.weekStart}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                      <div
                        className="h-full bg-orange rounded-full flex items-center px-2"
                        style={{ width: `${Math.max((w.gp / maxWeekGp) * 100, 2)}%` }}
                      >
                        <span className="text-white text-xs font-bold">{formatCurrency(w.gp)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Overrun Jobs */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Overrun Alerts
          </h3>
          {overrunJobs.length === 0 ? (
            <p className="text-sm text-gray-400">No overrun alerts</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Job</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Hours Used</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Hours Allowed</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">% Used</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overrunJobs.map(({ job, metrics }) => {
                    const status = getOverrunStatus(metrics.labourPercent)
                    return (
                      <tr key={job.id} className={`border-b ${status === 'overrun' ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{job.job_name}</span>
                          {job.job_no && <span className="text-xs text-gray-400 ml-1">#{job.job_no}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{metrics.hoursUsedTotal.toFixed(1)}h</td>
                        <td className="px-3 py-2 text-right tabular-nums">{metrics.totalHours}h</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${status === 'overrun' ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatPercent(metrics.labourPercent)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {status === 'overrun' ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                              <AlertTriangle size={10} /> OVERRUN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">
                              <AlertTriangle size={10} /> 90%+
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Job profitability league table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            Job Profitability (GP/Hour)
          </h3>
          {jobProfitability.length === 0 ? (
            <p className="text-sm text-gray-400">No active jobs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Job</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">GP/Hour</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Total GP</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Hours Left</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Labour %</th>
                  </tr>
                </thead>
                <tbody>
                  {jobProfitability.map(({ job, metrics }) => (
                    <tr key={job.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">
                        <span className="font-medium">{job.job_name}</span>
                        {job.job_no && <span className="text-xs text-gray-400 ml-1">#{job.job_no}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-navy">
                        {formatCurrency(metrics.gpPerHour)}/h
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.totalGp)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${metrics.hoursRemaining < 0 ? 'text-red-600 font-bold' : ''}`}>
                        {metrics.hoursRemaining.toFixed(1)}h
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${metrics.labourPercent > 1 ? 'text-red-600 font-bold' : ''}`}>
                        {formatPercent(metrics.labourPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DashCard({ label, value, sub, highlight, warn }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-orange/10 border-orange' : 'bg-white border-gray-200'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${warn ? 'text-red-600' : highlight ? 'text-orange' : 'text-navy'}`}>
        {value ?? '—'}
      </div>
      {sub && <div className={`text-xs mt-0.5 ${warn ? 'text-red-500' : 'text-green-600'}`}>{sub}</div>}
    </div>
  )
}
