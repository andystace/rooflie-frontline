import { useState, useEffect, useMemo } from 'react'
import { Briefcase, Plus, Search, Filter, ChevronRight, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useJobs } from '../hooks/useJobs'
import { JOB_STATUSES } from '../lib/constants'
import { formatCurrency, calcJobOverrunMap, getOverrunStatus } from '../lib/calculations'
import JobModal from '../components/JobModal'
import JobDetail from '../components/JobDetail'
import CsvImport from '../components/CsvImport'

export default function JobsPage() {
  const { jobs, loading, fetchJobs, createJob, updateJob, deleteJob } = useJobs()
  const [allJobEntries, setAllJobEntries] = useState([])
  const [allVariations, setAllVariations] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [detailJob, setDetailJob] = useState(null)

  // Fetch all job-type entries for overrun detection
  useEffect(() => {
    async function loadAllJobEntries() {
      const { data } = await supabase
        .from('schedule_entries')
        .select('job_id, hours, entry_type')
        .eq('entry_type', 'job')
      setAllJobEntries(data || [])
    }
    loadAllJobEntries()
  }, [jobs])

  // Fetch all variations for totals rollup
  useEffect(() => {
    async function loadAllVariations() {
      const { data } = await supabase
        .from('variations')
        .select('job_id, variation_value, variation_gp, additional_hours, material_allowance')
      setAllVariations(data || [])
    }
    loadAllVariations()
  }, [jobs])

  const overrunMap = useMemo(() => calcJobOverrunMap(allJobEntries, jobs, allVariations), [allJobEntries, jobs, allVariations])

  // Compute per-job variation totals
  const variationTotals = useMemo(() => {
    const map = {}
    for (const v of allVariations) {
      if (!v.job_id) continue
      if (!map[v.job_id]) map[v.job_id] = { value: 0, gp: 0, hours: 0, materials: 0 }
      map[v.job_id].value += Number(v.variation_value || 0)
      map[v.job_id].gp += Number(v.variation_gp || 0)
      map[v.job_id].hours += Number(v.additional_hours || 0)
      map[v.job_id].materials += Number(v.material_allowance || 0)
    }
    return map
  }, [allVariations])

  const filtered = jobs.filter((job) => {
    const q = search.toLowerCase()
    const matchesSearch =
      search === '' ||
      job.job_name?.toLowerCase().includes(q) ||
      String(job.job_no).includes(search) ||
      job.customer?.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts = JOB_STATUSES.reduce((acc, s) => {
    acc[s.value] = jobs.filter(j => j.status === s.value).length
    return acc
  }, {})

  function handleEdit(job) {
    setEditingJob(job)
    setShowModal(true)
  }

  function handleAdd() {
    setEditingJob(null)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditingJob(null)
  }

  // When editing from detail panel, close detail and open edit modal
  function handleEditFromDetail(job) {
    setDetailJob(null)
    setEditingJob(job)
    setShowModal(true)
  }

  const statusBadge = (status) => {
    const s = JOB_STATUSES.find((s) => s.value === status)
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: s?.colour || '#6B7280' }}
      >
        {s?.label || status}
      </span>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase size={24} className="text-navy" />
          <h2 className="text-xl font-bold text-navy">Jobs</h2>
          <span className="text-sm text-gray-400 ml-2">{jobs.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <CsvImport onDone={fetchJobs} />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Job
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            statusFilter === 'all' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({jobs.length})
        </button>
        {JOB_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s.value ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={statusFilter === s.value ? { backgroundColor: s.colour } : {}}
          >
            {s.label} ({counts[s.value] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search jobs by name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
        />
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading jobs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {jobs.length === 0 ? 'No jobs yet. Click "Add Job" to get started.' : 'No jobs match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-navy">Job No</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy">Job Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">Total Value</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">Total GP</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">Total Hours</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">2-Man Days</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">Hours Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const vt = variationTotals[job.id] || { value: 0, gp: 0, hours: 0 }
                  const totalValue = Number(job.sold_value || 0) + vt.value
                  const totalGp = Number(job.sold_gp || 0) + vt.gp
                  const totalHours = Number(job.hours_allowed || 0) + vt.hours
                  const twoManDays = totalHours > 0 ? (totalHours / 16).toFixed(1) : '—'

                  const ov = overrunMap[job.id]
                  const status = ov ? getOverrunStatus(ov.ratio) : 'ok'
                  const rowClass = status === 'overrun'
                    ? 'bg-red-50 border-b border-red-200 hover:bg-red-100 cursor-pointer transition-colors'
                    : status === 'warning'
                    ? 'bg-amber-50 border-b border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors'
                    : 'border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors'
                  return (
                  <tr key={job.id} className={rowClass} onClick={() => setDetailJob(job)}>
                    <td className="px-4 py-3 font-mono text-gray-700">{job.job_no || '—'}</td>
                    <td className="px-4 py-3 font-medium">{job.job_name}</td>
                    <td className="px-4 py-3 text-gray-600">{job.customer || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(totalValue)}
                      {vt.value > 0 && <span className="text-xs text-green-600 ml-1">(+{formatCurrency(vt.value)})</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(totalGp)}
                      {vt.gp > 0 && <span className="text-xs text-green-600 ml-1">(+{formatCurrency(vt.gp)})</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totalHours || '—'}
                      {vt.hours > 0 && <span className="text-xs text-green-600 ml-1">(+{vt.hours})</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {twoManDays}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ov && ov.hoursAllowed > 0 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs tabular-nums text-gray-600">
                            {ov.hoursUsed.toFixed(0)}/{ov.hoursAllowed}h
                          </span>
                          {status === 'overrun' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              <AlertTriangle size={10} /> OVERRUN
                            </span>
                          )}
                          {status === 'warning' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              <AlertTriangle size={10} /> 90%+
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailJob(job) }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-navy"
                        title="View details"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <JobModal
          job={editingJob}
          onClose={handleModalClose}
          onSave={editingJob ? (p) => updateJob(editingJob.id, p) : createJob}
          onDelete={editingJob ? () => deleteJob(editingJob.id) : null}
        />
      )}

      {detailJob && (
        <JobDetail
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onEdit={handleEditFromDetail}
        />
      )}
    </div>
  )
}
