import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCosts(jobId) {
  const [costs, setCosts] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchCosts = useCallback(async (id) => {
    const targetId = id || jobId
    if (!targetId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('cost_entries')
      .select('*')
      .eq('job_id', targetId)
      .order('date', { ascending: false })
    if (error) console.error('Error fetching costs:', error)
    else setCosts(data || [])
    setLoading(false)
  }, [jobId])

  async function createCost(payload) {
    const { data, error } = await supabase
      .from('cost_entries')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    setCosts(prev => [data, ...prev])
    return data
  }

  async function deleteCost(id) {
    const { error } = await supabase.from('cost_entries').delete().eq('id', id)
    if (error) throw error
    setCosts(prev => prev.filter(c => c.id !== id))
  }

  return { costs, loading, fetchCosts, createCost, deleteCost }
}
