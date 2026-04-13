import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTargets() {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTargets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('monthly_targets')
      .select('*')
      .order('year_month', { ascending: false })
    if (error) console.error('Error fetching targets:', error)
    else setTargets(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  function getTarget(yearMonth) {
    return targets.find(t => t.year_month === yearMonth) || null
  }

  async function upsertTarget(yearMonth, gpTarget, breakeven) {
    const existing = targets.find(t => t.year_month === yearMonth)
    if (existing) {
      const { data, error } = await supabase
        .from('monthly_targets')
        .update({ gp_target: gpTarget, breakeven })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      setTargets(prev => prev.map(t => t.id === existing.id ? data : t))
      return data
    } else {
      const { data, error } = await supabase
        .from('monthly_targets')
        .insert({ year_month: yearMonth, gp_target: gpTarget, breakeven })
        .select()
        .single()
      if (error) throw error
      setTargets(prev => [data, ...prev])
      return data
    }
  }

  return { targets, loading, fetchTargets, getTarget, upsertTarget }
}
