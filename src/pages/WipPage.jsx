import { useState, useEffect } from 'react'
import { FileText, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calcJobMetrics, formatCurrency, formatPercent } from '../lib/calculations'

export default function WipPage() {
  const [jobs, setJobs] = useState([])
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [variations, setVariations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [jobsRes, schedRes, varRes] = await Promise.all([
        supabase.from('jobs').select('*').in('status', ['in_progress', 'confirmed']).order('job_no'),
        supabase.from('schedule_entries').select('*').eq('entry_type', 'job'),
        supabase.from('variations').select('*'),
      ])
      setJobs(jobsRes.data || [])
      setScheduleEntries(schedRes.data || [])
      setVariations(varRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const rows = jobs.map(job => {
    const jobVariations = variations.filter(v => v.job_id === job.id)
    const jobEntries = scheduleEntries.filter(e => e.job_id === job.id)
    const metrics = calcJobMetrics(job, jobEntries, jobVariations)
    return { job, metrics }
  })

  const totalWip = rows.reduce((s, r) => s + r.metrics.wipValue, 0)
  const totalEarned = rows.reduce((s, r) => s + r.metrics.earnedRevenue, 0)

  function exportCsv() {
    const headers = ['Job No', 'Job Name', 'Total Value', 'Total GP', 'Labour %', 'Earned Revenue', 'Invoiced', 'WIP Value', 'Total Costs', 'Actual GP']
    const csvRows = rows.map(({ job, metrics }) => [
      job.job_no || '',
      `"${job.job_name}"`,
      metrics.totalValue.toFixed(2),
      metrics.totalGp.toFixed(2),
      (metrics.labourPercent * 100).toFixed(1) + '%',
      metrics.earnedRevenue.toFixed(2),
      Number(job.invoiced_to_date || 0).toFixed(2),
      metrics.wipValue.toFixed(2),
      metrics.totalCosts.toFixed(2),
      metrics.actualGpToDate.toFixed(2),
    ])
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wip-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={24} className="text-navy" />
          <h2 className="text-xl font-bold text-navy">WIP Report</h2>
        </div>
        <button
          onClick={exportCsv}
          disabled={loading || rows.length === 0}
          className="flex items-center gap-1.5 bg-navy hover:bg-navy-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <SummaryCard label="Active Jobs" value={rows.length} />
        <SummaryCard label="Total Earned Revenue" value={formatCurrency(totalEarned)} />
        <SummaryCard label="Total WIP" value={formatCurrency(totalWip)} />
        <SummaryCard label="Total Invoiced" value={formatCurrency(rows.reduce((s, r) => s + Number(r.job.invoiced_to_date || 0), 0))} />
      </div>

      {/* WIP table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading WIP data...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No active jobs to report on.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-3 font-semibold text-navy">Job</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Value</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">GP</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Labour %</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Earned Rev</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Invoiced</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">WIP</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Costs</th>
                  <th className="text-right px-3 py-3 font-semibold text-navy">Actual GP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ job, metrics }) => (
                  <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{job.job_name}</div>
                      {job.job_no && <div className="text-xs text-gray-400 font-mono">#{job.job_no}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.totalValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.totalGp)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${metrics.labourPercent > 1 ? 'text-red-600 font-bold' : ''}`}>
                      {formatPercent(metrics.labourPercent)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.earnedRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(job.invoiced_to_date)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${metrics.wipValue < 0 ? 'text-red-600' : 'text-navy'}`}>
                      {formatCurrency(metrics.wipValue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.totalCosts)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${metrics.actualGpToDate < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(metrics.actualGpToDate)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-navy/5 font-bold">
                  <td className="px-3 py-3 text-navy">Totals</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(rows.reduce((s, r) => s + r.metrics.totalValue, 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(rows.reduce((s, r) => s + r.metrics.totalGp, 0))}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(totalEarned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(rows.reduce((s, r) => s + Number(r.job.invoiced_to_date || 0), 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-navy">{formatCurrency(totalWip)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(rows.reduce((s, r) => s + r.metrics.totalCosts, 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(rows.reduce((s, r) => s + r.metrics.actualGpToDate, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-navy tabular-nums">{value}</div>
    </div>
  )
}
