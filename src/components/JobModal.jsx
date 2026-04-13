import { useState } from 'react'
import { JOB_STATUSES } from '../lib/constants'
import { X, Save, Trash2 } from 'lucide-react'

const emptyJob = {
  job_no: '',
  job_name: '',
  customer: '',
  status: 'pipeline',
  accepted_date: '',
  completed_date: '',
  sold_value: '',
  sold_gp: '',
  hours_allowed: '',
  hours_used_previous: '',
  material_budget: '',
  invoiced_to_date: '',
  notes: '',
}

export default function JobModal({ job, onClose, onSave, onDelete }) {
  const isEditing = !!job
  const [form, setForm] = useState(() => {
    if (job) {
      return {
        job_no: job.job_no ?? '',
        job_name: job.job_name ?? '',
        customer: job.customer ?? '',
        status: job.status ?? 'pipeline',
        accepted_date: job.accepted_date ?? '',
        completed_date: job.completed_date ?? '',
        sold_value: job.sold_value ?? '',
        sold_gp: job.sold_gp ?? '',
        hours_allowed: job.hours_allowed ?? '',
        hours_used_previous: job.hours_used_previous ?? '',
        material_budget: job.material_budget ?? '',
        invoiced_to_date: job.invoiced_to_date ?? '',
        notes: job.notes ?? '',
      }
    }
    return { ...emptyJob }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      job_no: form.job_no ? Number(form.job_no) : null,
      job_name: form.job_name,
      customer: form.customer || null,
      status: form.status,
      accepted_date: form.accepted_date || null,
      completed_date: form.completed_date || null,
      sold_value: form.sold_value ? Number(form.sold_value) : 0,
      sold_gp: form.sold_gp ? Number(form.sold_gp) : 0,
      hours_allowed: form.hours_allowed ? Number(form.hours_allowed) : 0,
      hours_used_previous: form.hours_used_previous ? Number(form.hours_used_previous) : 0,
      material_budget: form.material_budget ? Number(form.material_budget) : null,
      invoiced_to_date: form.invoiced_to_date ? Number(form.invoiced_to_date) : 0,
      notes: form.notes || null,
    }

    try {
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this job? This will also delete all variations, costs, and schedule entries for this job.')) return
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-navy">
            {isEditing ? 'Edit Job' : 'New Job'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="simPRO Job No" name="job_no" type="number" value={form.job_no} onChange={handleChange} />
            <Field label="Status" name="status" value={form.status} onChange={handleChange} select>
              {JOB_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Field>
          </div>

          <Field label="Job Name" name="job_name" value={form.job_name} onChange={handleChange} required />
          <Field label="Customer" name="customer" value={form.customer} onChange={handleChange} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Accepted Date" name="accepted_date" type="date" value={form.accepted_date} onChange={handleChange} />
            <Field label="Completed Date" name="completed_date" type="date" value={form.completed_date} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Sold Value (£)" name="sold_value" type="number" step="0.01" value={form.sold_value} onChange={handleChange} />
            <Field label="Sold GP (£)" name="sold_gp" type="number" step="0.01" value={form.sold_gp} onChange={handleChange} />
            <Field label="Hours Allowed" name="hours_allowed" type="number" step="0.5" value={form.hours_allowed} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Previous Hours" name="hours_used_previous" type="number" step="0.5" value={form.hours_used_previous} onChange={handleChange} />
            <Field label="Material Budget (£)" name="material_budget" type="number" step="0.01" value={form.material_budget} onChange={handleChange} />
            <Field label="Invoiced (£)" name="invoiced_to_date" type="number" step="0.01" value={form.invoiced_to_date} onChange={handleChange} />
          </div>

          <Field label="Notes" name="notes" value={form.notes} onChange={handleChange} textarea />

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.job_name}
                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, select, textarea, ...props }) {
  const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange'
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {select ? (
        <select className={cls} {...props}>{children}</select>
      ) : textarea ? (
        <textarea className={cls} rows={3} {...props} />
      ) : (
        <input className={cls} {...props} />
      )}
    </div>
  )
}
