import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSchedule() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async (startDate, endDate) => {
    setLoading(true)
    let query = supabase
      .from('schedule_entries')
      .select('*, team_members(name, colour), jobs(job_name, job_no, sold_gp, hours_allowed)')
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    const { data, error } = await query.order('date')
    if (error) console.error('Error fetching schedule:', error)
    else setEntries(data || [])
    setLoading(false)
  }, [])

  async function createEntry(payload) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .insert(payload)
      .select('*, team_members(name, colour), jobs(job_name, job_no, sold_gp, hours_allowed)')
      .single()
    if (error) throw error
    setEntries(prev => [...prev, data])
    return data
  }

  async function createEntries(payloads) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .insert(payloads)
      .select('*, team_members(name, colour), jobs(job_name, job_no, sold_gp, hours_allowed)')
    if (error) throw error
    setEntries(prev => [...prev, ...(data || [])])
    return data
  }

  async function updateEntry(id, payload) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .update(payload)
      .eq('id', id)
      .select('*, team_members(name, colour), jobs(job_name, job_no, sold_gp, hours_allowed)')
      .single()
    if (error) throw error
    setEntries(prev => prev.map(e => e.id === id ? data : e))
    return data
  }

  async function deleteEntry(id) {
    const { error } = await supabase.from('schedule_entries').delete().eq('id', id)
    if (error) throw error
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return { entries, loading, fetchEntries, createEntry, createEntries, updateEntry, deleteEntry }
}
