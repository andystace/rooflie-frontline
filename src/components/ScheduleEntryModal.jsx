import { useState } from 'react'
import { X, Save, Trash2, UserPlus } from 'lucide-react'
import { ENTRY_TYPES } from '../lib/constants'

export default function ScheduleEntryModal({
  entry,
  jobs,
  teamMember,
  partner,
  onSave,
  onDelete,
  onClose,
}) {
  const isEditing = !!entry?.id
  const [form, setForm] = useState({
    entry_type: entry?.entry_type || 'job',
    job_id: entry?.job_id || '',
    date: entry?.date || '',
    hours: entry?.hours ?? 8,
    notes: entry?.notes || '',
  })
  const [addPartner, setAddPartner] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeJobs = jobs.filter(j => j.status !== 'complete')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...form,
        hours: Number(form.hours),
        job_id: form.entry_type === 'job' ? form.job_id || null : null,
        team_member_id: entry?.team_member_id || teamMember?.id,
      }, addPartner)
      onClose()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 sm:pt-20 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-navy">
            {isEditing ? 'Edit Entry' : 'Schedule Entry'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {teamMember && (
            <div className="text-sm font-medium text-navy">
              {teamMember.name} — {form.date}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              name="entry_type"
              value={form.entry_type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
            >
              {ENTRY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.entry_type === 'job' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job</label>
              <select
                name="job_id"
                value={form.job_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
              >
                <option value="">— Select a job —</option>
                {activeJobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.job_no ? `${j.job_no} — ` : ''}{j.job_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
              <input
                type="number"
                name="hours"
                value={form.hours}
                onChange={handleChange}
                step="0.5"
                min="0"
                max="24"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input
              type="text"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange"
            />
          </div>

          {/* Partner prompt */}
          {!isEditing && partner && form.entry_type === 'job' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <div className="text-sm">
                <UserPlus size={14} className="inline mr-1 text-blue-600" />
                Also schedule <strong>{partner.name}</strong> on the same job?
              </div>
              <button
                type="button"
                onClick={() => setAddPartner(!addPartner)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  addPartner
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 border border-blue-300'
                }`}
              >
                {addPartner ? 'Yes' : 'No'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() => { onDelete(entry.id); onClose() }}
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
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (form.entry_type === 'job' && !form.job_id)}
                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
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
