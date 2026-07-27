import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useWeeklyPay() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWeek = useCallback(async (weekStartDate) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('weekly_pay_entries')
      .select('*')
      .eq('week_start_date', weekStartDate)
    if (error) console.error('Error fetching weekly pay:', error)
    else setEntries(data || [])
    setLoading(false)
    return data || []
  }, [])

  // Insert-or-update the mileage/bonus/checked row for one person, one week.
  async function upsertEntry(teamMemberId, weekStartDate, payload) {
    const { data, error } = await supabase
      .from('weekly_pay_entries')
      .upsert(
        {
          team_member_id: teamMemberId,
          week_start_date: weekStartDate,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_member_id,week_start_date' }
      )
      .select()
      .single()
    if (error) throw error
    setEntries(prev => {
      const others = prev.filter(e => e.team_member_id !== teamMemberId)
      return [...others, data]
    })
    return data
  }

  async function toggleChecked(teamMemberId, weekStartDate, currentEntry) {
    return upsertEntry(teamMemberId, weekStartDate, {
      mileage: currentEntry?.mileage || 0,
      bonus: currentEntry?.bonus || 0,
      checked: !(currentEntry?.checked || false),
      checked_at: !(currentEntry?.checked || false) ? new Date().toISOString() : null,
    })
  }

  return { entries, loading, fetchWeek, upsertEntry, toggleChecked }
}
