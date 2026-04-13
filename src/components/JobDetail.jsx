import { useState, useEffect } from 'react'
import { X, Plus, Trash2, DollarSign, Layers, Clock, TrendingUp, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useVariations } from '../hooks/useVariations'
import { useCosts } from '../hooks/useCosts'
import { calcJobMetrics, formatCurrency, formatCurrencyDetailed, formatPercent } from '../lib/calculations'
import { COST_TYPES } from '../lib/constants'

export default function JobDetail({ job, onClose, onEdit }) {
  const { variations, fetchVariations, createVariation, deleteVariation } = useVariations(job.id)
  const { costs, fetchCosts, createCost, deleteCost } = useCosts(job.id)
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchVariations(job.id)
    fetchCosts(job.id)
    // Fetch schedule entries for this job
    supabase
      .from('schedule_entries')
      .select('*')
      .eq('job_id', job.id)
      .then(({ data }) => setScheduleEntries(data || []))
  }, [job.id, fetchVariations, fetchCosts])

  const metrics = calcJobMetrics(job, scheduleEntries, variations)

  const tabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'variations', label: 'Variations', icon: Layers },
    { key: 'costs', label: 'Costs', icon: DollarSign },
    { key: 'schedule', label: 'Schedule', icon: Clock },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-10 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-navy">
              {job.job_no ? `#${job.job_no} — ` : ''}{job.job_name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {job.status.replace('_', ' ').toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(job)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange hover:bg-orange-dark text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Profitability card */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <MetricCard label="Total Value" value={formatCurrency(metrics.totalValue)} />
          <MetricCard label="Total GP" value={formatCurrency(metrics.totalGp)} />
          <MetricCard label="GP/Hour" value={formatCurrencyDetailed(metrics.gpPerHour)} />
          <MetricCard label="Labour %" value={formatPercent(metrics.labourPercent)} warn={metrics.labourPercent > 1} />
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-orange text-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} job={job} />
          )}
          {activeTab === 'variations' && (
            <VariationsTab
              variations={variations}
              jobId={job.id}
              onCreate={createVariation}
              onDelete={deleteVariation}
            />
          )}
          {activeTab === 'costs' && (
            <CostsTab
              costs={costs}
              jobId={job.id}
              onCreate={createCost}
              onDelete={deleteCost}
            />
          )}
          {activeTab === 'schedule' && (
            <ScheduleTab entries={scheduleEntries} />
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, warn }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${warn ? 'text-red-600' : 'text-navy'}`}>{value}</div>
    </div>
  )
}

function OverviewTab({ metrics, job }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Row label="Sold Value" value={formatCurrency(job.sold_value)} />
        <Row label="+ Variation Value" value={formatCurrency(metrics.variationValue)} />
        <Row label="Total Value" value={formatCurrency(metrics.totalValue)} bold />
        <Row label="Total GP" value={formatCurrency(metrics.totalGp)} bold />
        <Row label="Hours Allowed" value={`${metrics.totalHours}h`} />
        <Row label="2-Man Days" value={metrics.twoManDays.toFixed(1)} />
        <Row label="Hours Used (Prev)" value={`${metrics.hoursUsedPrevious}h`} />
        <Row label="Hours Used (Current)" value={`${metrics.hoursUsedCurrent}h`} />
        <Row label="Hours Remaining" value={`${metrics.hoursRemaining.toFixed(1)}h`} warn={metrics.hoursRemaining < 0} />
        <Row label="Labour %" value={formatPercent(metrics.labourPercent)} warn={metrics.labourPercent > 1} />
        <Row label="Earned Revenue" value={formatCurrency(metrics.earnedRevenue)} />
        <Row label="WIP Value" value={formatCurrency(metrics.wipValue)} />
        <Row label="Total Costs" value={formatCurrency(metrics.totalCosts)} />
        <Row label="Actual GP to Date" value={formatCurrency(metrics.actualGpToDate)} />
      </div>
    </div>
  )
}

function Row({ label, value, bold, warn }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100">
      <span className={`text-gray-600 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-navy' : ''} ${warn ? 'text-red-600 font-bold' : ''}`}>{value}</span>
    </div>
  )
}

function VariationsTab({ variations, jobId, onCreate, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ detail: '', variation_value: '', variation_gp: '', additional_hours: '', material_allowance: '' })

  async function handleCreate(e) {
    e.preventDefault()
    await onCreate({
      job_id: jobId,
      detail: form.detail,
      variation_value: Number(form.variation_value) || 0,
      variation_gp: Number(form.variation_gp) || 0,
      additional_hours: Number(form.additional_hours) || 0,
      material_allowance: Number(form.material_allowance) || 0,
    })
    setForm({ detail: '', variation_value: '', variation_gp: '', additional_hours: '', material_allowance: '' })
    setShowForm(false)
  }

  const totalValue = variations.reduce((s, v) => s + Number(v.variation_value || 0), 0)
  const totalGp = variations.reduce((s, v) => s + Number(v.variation_gp || 0), 0)
  const totalHours = variations.reduce((s, v) => s + Number(v.additional_hours || 0), 0)
  const totalMaterials = variations.reduce((s, v) => s + Number(v.material_allowance || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-navy">Variations ({variations.length})</h4>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-orange hover:text-orange-dark text-sm font-medium"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {variations.length > 0 && (
        <div className="bg-navy/5 rounded-lg px-3 py-2 text-xs text-navy grid grid-cols-4 gap-2">
          <div>Value: <span className="font-bold">{formatCurrency(totalValue)}</span></div>
          <div>GP: <span className="font-bold">{formatCurrency(totalGp)}</span></div>
          <div>Hours: <span className="font-bold">{totalHours}h</span></div>
          <div>Materials: <span className="font-bold">{formatCurrency(totalMaterials)}</span></div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <input
            placeholder="Description"
            value={form.detail}
            onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" step="0.01" placeholder="Value (£)"
              value={form.variation_value}
              onChange={e => setForm(f => ({ ...f, variation_value: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="number" step="0.01" placeholder="GP (£)"
              value={form.variation_gp}
              onChange={e => setForm(f => ({ ...f, variation_gp: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" step="0.5" placeholder="Additional Hours"
              value={form.additional_hours}
              onChange={e => setForm(f => ({ ...f, additional_hours: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="number" step="0.01" placeholder="Material Allowance (£)"
              value={form.material_allowance}
              onChange={e => setForm(f => ({ ...f, material_allowance: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-3 py-1 bg-orange text-white text-sm rounded">Save</button>
          </div>
        </form>
      )}

      {variations.length === 0 ? (
        <p className="text-sm text-gray-400">No variations yet.</p>
      ) : (
        <div className="space-y-2">
          {variations.map(v => (
            <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 text-sm">
              <div>
                <div className="font-medium">V{v.variation_no}: {v.detail}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Value: {formatCurrency(v.variation_value)} | GP: {formatCurrency(v.variation_gp)} | Hours: {v.additional_hours}h
                  {Number(v.material_allowance) > 0 && ` | Materials: ${formatCurrency(v.material_allowance)}`}
                </div>
              </div>
              <button onClick={() => onDelete(v.id)} className="text-red-500 hover:text-red-700 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CostsTab({ costs, jobId, onCreate, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ cost_type: 'materials', description: '', amount: '', date: '', supplier: '' })

  async function handleCreate(e) {
    e.preventDefault()
    await onCreate({
      job_id: jobId,
      cost_type: form.cost_type,
      description: form.description,
      amount: Number(form.amount) || 0,
      date: form.date,
      supplier: form.supplier || null,
    })
    setForm({ cost_type: 'materials', description: '', amount: '', date: '', supplier: '' })
    setShowForm(false)
  }

  const total = costs.reduce((s, c) => s + Number(c.amount || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-navy">Costs ({costs.length}) — Total: {formatCurrency(total)}</h4>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-orange hover:text-orange-dark text-sm font-medium"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.cost_type}
              onChange={e => setForm(f => ({ ...f, cost_type: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <input
            placeholder="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" step="0.01" placeholder="Amount (£)" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Supplier (optional)" value={form.supplier}
              onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-3 py-1 bg-orange text-white text-sm rounded">Save</button>
          </div>
        </form>
      )}

      {costs.length === 0 ? (
        <p className="text-sm text-gray-400">No cost entries yet.</p>
      ) : (
        <div className="space-y-2">
          {costs.map(c => (
            <div key={c.id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 text-sm">
              <div>
                <div className="font-medium">{c.description}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.cost_type} | {c.date} {c.supplier ? `| ${c.supplier}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold tabular-nums">{formatCurrency(c.amount)}</span>
                <button onClick={() => onDelete(c.id)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleTab({ entries }) {
  const jobEntries = entries.filter(e => e.entry_type === 'job')
  const totalHours = jobEntries.reduce((s, e) => s + Number(e.hours || 0), 0)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-navy">
        Scheduled Entries ({jobEntries.length}) — {totalHours}h total
      </h4>
      {jobEntries.length === 0 ? (
        <p className="text-sm text-gray-400">No schedule entries for this job yet.</p>
      ) : (
        <div className="space-y-1">
          {jobEntries.map(e => (
            <div key={e.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-2 text-sm">
              <span>{e.date}</span>
              <span className="tabular-nums">{e.hours}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
