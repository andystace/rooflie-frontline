import { useState, useRef, useCallback } from 'react'
import { Settings, Users, Target, Plus, Check, ToggleLeft, ToggleRight, Pencil, Trash2, X } from 'lucide-react'
import { useTeam } from '../hooks/useTeam'
import { useTargets } from '../hooks/useTargets'
import { TEAM_ROLES } from '../lib/constants'
import { format, addMonths } from 'date-fns'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('targets')

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={24} className="text-navy" />
        <h2 className="text-xl font-bold text-navy">Settings</h2>
      </div>

      <div className="flex gap-2 mb-4">
        <TabButton active={activeTab === 'targets'} onClick={() => setActiveTab('targets')} icon={Target} label="Monthly Targets" />
        <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={Users} label="Team Members" />
      </div>

      {activeTab === 'targets' && <MonthlyTargetsSection />}
      {activeTab === 'team' && <TeamSection />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function MonthlyTargetsSection() {
  const { targets, upsertTarget } = useTargets()
  const [edits, setEdits] = useState({})
  const [savedMonths, setSavedMonths] = useState(new Set())
  const timersRef = useRef({})

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(new Date(), i)
    return format(d, 'yyyy-MM')
  })

  function getValues(yearMonth) {
    if (edits[yearMonth]) return edits[yearMonth]
    const existing = targets.find(t => t.year_month === yearMonth)
    return {
      gp_target: existing?.gp_target ?? '',
      breakeven: existing?.breakeven ?? '',
    }
  }

  const doSave = useCallback(async (yearMonth, vals) => {
    try {
      await upsertTarget(yearMonth, Number(vals.gp_target) || 0, Number(vals.breakeven) || 0)
      setEdits(prev => {
        const next = { ...prev }
        delete next[yearMonth]
        return next
      })
      setSavedMonths(prev => new Set(prev).add(yearMonth))
      setTimeout(() => {
        setSavedMonths(prev => {
          const next = new Set(prev)
          next.delete(yearMonth)
          return next
        })
      }, 2000)
    } catch (err) {
      console.error('Autosave failed:', err.message)
    }
  }, [upsertTarget])

  function handleChange(yearMonth, field, value) {
    const updated = {
      ...getValues(yearMonth),
      [field]: value,
    }
    setEdits(prev => ({ ...prev, [yearMonth]: updated }))

    // Debounce: reset timer, save after 1s of inactivity
    if (timersRef.current[yearMonth]) clearTimeout(timersRef.current[yearMonth])
    timersRef.current[yearMonth] = setTimeout(() => {
      doSave(yearMonth, updated)
      delete timersRef.current[yearMonth]
    }, 1000)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-navy">Monthly GP Targets & Breakeven</h3>
        <p className="text-xs text-gray-500 mt-0.5">Set targets for each month. Changes save automatically.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold text-navy">Month</th>
              <th className="text-left px-4 py-2 font-semibold text-navy">GP Target (&pound;)</th>
              <th className="text-left px-4 py-2 font-semibold text-navy">Breakeven (&pound;)</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {months.map(ym => {
              const vals = getValues(ym)
              const isSaved = savedMonths.has(ym)
              const hasEdit = !!edits[ym]
              return (
                <tr key={ym} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{format(new Date(ym + '-01'), 'MMMM yyyy')}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="100"
                      value={vals.gp_target}
                      onChange={e => handleChange(ym, 'gp_target', e.target.value)}
                      placeholder="0"
                      className="w-32 border border-gray-300 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="100"
                      value={vals.breakeven}
                      onChange={e => handleChange(ym, 'breakeven', e.target.value)}
                      placeholder="0"
                      className="w-32 border border-gray-300 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                    />
                  </td>
                  <td className="px-4 py-2 w-20">
                    {isSaved && (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <Check size={12} /> Saved
                      </span>
                    )}
                    {hasEdit && !isSaved && (
                      <span className="text-xs text-gray-400">Saving...</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamSection() {
  const { team, activeTeam, createMember, updateMember, deleteMember } = useTeam()
  const [showAdd, setShowAdd] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', role: 'roofer', day_rate: 250, colour: '#2563EB' })
  const [pairingSaved, setPairingSaved] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    try {
      await createMember({
        name: newMember.name,
        role: newMember.role,
        day_rate: Number(newMember.day_rate) || 0,
        colour: newMember.colour,
      })
      setNewMember({ name: '', role: 'roofer', day_rate: 250, colour: '#2563EB' })
      setShowAdd(false)
    } catch (err) {
      alert(err.message)
    }
  }

  function startEdit(member) {
    setEditingId(member.id)
    setEditForm({
      name: member.name,
      role: member.role,
      day_rate: member.day_rate,
      colour: member.colour || '#6B7280',
    })
  }

  async function saveEdit(id) {
    try {
      await updateMember(id, {
        name: editForm.name,
        role: editForm.role,
        day_rate: Number(editForm.day_rate) || 0,
        colour: editForm.colour,
      })
      setEditingId(null)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteMember(id)
      setConfirmDeleteId(null)
    } catch (err) {
      alert('Cannot delete: ' + err.message)
      setConfirmDeleteId(null)
    }
  }

  async function toggleActive(member) {
    try {
      await updateMember(member.id, { active: !member.active })
    } catch (err) {
      alert(err.message)
    }
  }

  async function handlePairingChange(member, newPartnerId) {
    try {
      const oldPartnerId = member.default_partner_id

      if (!newPartnerId) {
        if (oldPartnerId) {
          await updateMember(oldPartnerId, { default_partner_id: null })
        }
        await updateMember(member.id, { default_partner_id: null })
      } else {
        const newPartner = team.find(m => m.id === newPartnerId)
        if (newPartner?.default_partner_id && newPartner.default_partner_id !== member.id) {
          await updateMember(newPartner.default_partner_id, { default_partner_id: null })
        }
        if (oldPartnerId && oldPartnerId !== newPartnerId) {
          await updateMember(oldPartnerId, { default_partner_id: null })
        }
        await updateMember(member.id, { default_partner_id: newPartnerId })
        await updateMember(newPartnerId, { default_partner_id: member.id })
      }

      setPairingSaved(member.id)
      setTimeout(() => setPairingSaved(null), 2000)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-navy">Team Members</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage team members — edit, delete, or deactivate to preserve history.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 bg-orange text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-dark"
        >
          <Plus size={14} />
          Add Member
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-gray-200 bg-orange/5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="Name"
              value={newMember.name}
              onChange={e => setNewMember(f => ({ ...f, name: e.target.value }))}
              required
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <select
              value={newMember.role}
              onChange={e => setNewMember(f => ({ ...f, role: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input
              type="number"
              placeholder="Day rate"
              value={newMember.day_rate}
              onChange={e => setNewMember(f => ({ ...f, day_rate: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={newMember.colour}
                onChange={e => setNewMember(f => ({ ...f, colour: e.target.value }))}
                className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
              />
              <button type="submit" className="flex-1 bg-orange text-white rounded text-sm font-medium hover:bg-orange-dark">
                Save
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 text-sm text-gray-600">Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-100">
        {team.map(member => {
          const isEditing = editingId === member.id
          const isConfirmingDelete = confirmDeleteId === member.id

          if (isEditing) {
            return (
              <div key={member.id} className="px-4 py-3 bg-blue-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="Name"
                    autoFocus
                  />
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <input
                    type="number"
                    value={editForm.day_rate}
                    onChange={e => setEditForm(f => ({ ...f, day_rate: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="Day rate"
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={editForm.colour}
                      onChange={e => setEditForm(f => ({ ...f, colour: e.target.value }))}
                      className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                    />
                    <button
                      onClick={() => saveEdit(member.id)}
                      className="flex-1 bg-orange text-white rounded text-sm font-medium hover:bg-orange-dark"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={member.id} className={`flex items-center gap-3 px-4 py-3 ${!member.active ? 'opacity-50' : ''}`}>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: member.colour || '#6B7280' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{member.name}</div>
                <div className="text-xs text-gray-500 capitalize">
                  {member.role} {member.day_rate > 0 ? `\u2022 \u00A3${member.day_rate}/day` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.active && (
                  <div className="flex items-center gap-1">
                    <select
                      value={member.default_partner_id || ''}
                      onChange={e => handlePairingChange(member, e.target.value || null)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange"
                    >
                      <option value="">No partner</option>
                      {activeTeam.filter(m => m.id !== member.id).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {pairingSaved === member.id && (
                      <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium">
                        <Check size={12} /> Saved
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => startEdit(member)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Edit"
                >
                  <Pencil size={16} className="text-gray-500" />
                </button>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-medium hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-0.5 hover:bg-gray-100 rounded"
                    >
                      <X size={14} className="text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(member.id)}
                    className="p-1 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                  </button>
                )}
                <button
                  onClick={() => toggleActive(member)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={member.active ? 'Deactivate' : 'Activate'}
                >
                  {member.active
                    ? <ToggleRight size={20} className="text-green-600" />
                    : <ToggleLeft size={20} className="text-gray-400" />
                  }
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
