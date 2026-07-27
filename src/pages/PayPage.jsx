import { useState, useEffect } from 'react'
import { Wallet, ChevronLeft, ChevronRight, Check, StickyNote, ToggleLeft, ToggleRight } from 'lucide-react'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from 'date-fns'
import { useTeam } from '../hooks/useTeam'
import { useSchedule } from '../hooks/useSchedule'
import { useWeeklyPay } from '../hooks/useWeeklyPay'
import { usePaySettings } from '../hooks/usePaySettings'
import { formatCurrency } from '../lib/calculations'

export default function PayPage() {
  const { activeTeam } = useTeam()
  const { entries: scheduleEntries, fetchEntries } = useSchedule()
  const { entries: payEntries, fetchWeek, upsertEntry, toggleChecked } = useWeeklyPay()
  const { settings: paySettings, setPayForHolidays } = usePaySettings()
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [drafts, setDrafts] = useState({}) // unsaved input text, keyed "memberId:field"

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 }) // Sunday
  const weekStartIso = format(weekStart, 'yyyy-MM-dd')
  const weekEndIso = format(weekEnd, 'yyyy-MM-dd')

  useEffect(() => {
    fetchEntries(weekStartIso, weekEndIso)
    fetchWeek(weekStartIso)
  }, [weekStartIso, weekEndIso, fetchEntries, fetchWeek])

  function payEntryFor(memberId) {
    return payEntries.find(e => e.team_member_id === memberId)
  }

  // Distinct calendar days this person has a paid entry in the week.
  // Holiday days are excluded unless the "Pay for holidays" setting is on
  // (defaults off — matches subcontractor-style pay; flip it on for a
  // business whose crew are employees on paid holiday).
  function daysScheduledFor(memberId) {
    const payForHolidays = paySettings?.pay_for_holidays ?? false
    const dates = new Set(
      scheduleEntries
        .filter(e => e.team_member_id === memberId)
        .filter(e => payForHolidays || e.entry_type !== 'holiday')
        .map(e => e.date)
    )
    return dates.size
  }

  function fieldValue(memberId, field, fallback) {
    const key = `${memberId}:${field}`
    return drafts[key] !== undefined ? drafts[key] : String(fallback)
  }

  function setFieldDraft(memberId, field, value) {
    setDrafts(prev => ({ ...prev, [`${memberId}:${field}`]: value }))
  }

  async function saveField(member, field, rawValue) {
    const existing = payEntryFor(member.id)
    const numeric = Number(rawValue) || 0
    try {
      await upsertEntry(member.id, weekStartIso, {
        mileage: field === 'mileage' ? numeric : (existing?.mileage || 0),
        bonus: field === 'bonus' ? numeric : (existing?.bonus || 0),
        checked: existing?.checked || false,
        checked_at: existing?.checked_at || null,
      })
    } catch (err) {
      alert('Could not save: ' + err.message)
    }
  }

  async function handleToggleChecked(member) {
    try {
      await toggleChecked(member.id, weekStartIso, payEntryFor(member.id))
    } catch (err) {
      alert('Could not save: ' + err.message)
    }
  }

  const rows = activeTeam.map(member => {
    const days = daysScheduledFor(member.id)
    const dayRate = Number(member.day_rate || 0)
    const basePay = days * dayRate
    const payEntry = payEntryFor(member.id)
    const mileageRaw = fieldValue(member.id, 'mileage', payEntry?.mileage ?? 0)
    const bonusRaw = fieldValue(member.id, 'bonus', payEntry?.bonus ?? 0)
    const mileage = Number(mileageRaw) || 0
    const bonus = Number(bonusRaw) || 0
    const total = basePay + mileage + bonus
    return {
      member, days, dayRate, basePay, mileageRaw, bonusRaw, total,
      checked: payEntry?.checked || false,
    }
  })

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={24} className="text-navy" />
          <h2 className="text-xl font-bold text-navy">Pay</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPayForHolidays(!(paySettings?.pay_for_holidays ?? false))}
            className="flex items-center gap-1.5 text-sm text-gray-600"
            title="Whether holiday days count toward pay"
          >
            Pay for holidays
            {paySettings?.pay_for_holidays
              ? <ToggleRight size={22} className="text-green-600" />
              : <ToggleLeft size={22} className="text-gray-400" />
            }
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setWeekAnchor(w => subWeeks(w, 1)); setDrafts({}) }}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
              title="Previous week"
            >
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
            <div className="text-sm font-medium text-navy min-w-[170px] text-center">
              {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
            </div>
            <button
              onClick={() => { setWeekAnchor(w => addWeeks(w, 1)); setDrafts({}) }}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
              title="Next week"
            >
              <ChevronRight size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-navy">Name</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Days</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Day Rate</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Base Pay</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Mileage</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Bonus</th>
                <th className="text-right px-3 py-3 font-semibold text-navy">Total</th>
                <th className="text-center px-3 py-3 font-semibold text-navy">Checked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, days, dayRate, basePay, mileageRaw, bonusRaw, total, checked }) => (
                <tr
                  key={member.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${checked ? 'bg-green-50/40' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium flex items-center gap-1">
                      {member.name}
                      {member.pay_notes && (
                        <span title={member.pay_notes}>
                          <StickyNote size={13} className="text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{days}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(dayRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(basePay)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={mileageRaw}
                      onChange={e => setFieldDraft(member.id, 'mileage', e.target.value)}
                      onBlur={e => saveField(member, 'mileage', e.target.value)}
                      className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={bonusRaw}
                      onChange={e => setFieldDraft(member.id, 'bonus', e.target.value)}
                      onBlur={e => saveField(member, 'bonus', e.target.value)}
                      className="w-20 text-right border border-gray-200 rounded px-1.5 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-orange"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-navy">{formatCurrency(total)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleToggleChecked(member)} className="p-1 hover:bg-gray-100 rounded" title="Mark checked">
                      <Check size={18} className={checked ? 'text-green-600' : 'text-gray-300'} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">No active team members.</td>
                </tr>
              )}
              <tr className="bg-navy/5 font-bold">
                <td className="px-3 py-3 text-navy" colSpan={6}>Total</td>
                <td className="px-3 py-3 text-right tabular-nums text-navy">{formatCurrency(grandTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
