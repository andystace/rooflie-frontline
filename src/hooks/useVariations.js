import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useVariations(jobId) {
  const [variations, setVariations] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchVariations = useCallback(async (id) => {
    const targetId = id || jobId
    if (!targetId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('variations')
      .select('*')
      .eq('job_id', targetId)
      .order('variation_no')
    if (error) console.error('Error fetching variations:', error)
    else setVariations(data || [])
    setLoading(false)
  }, [jobId])

  async function createVariation(payload) {
    const nextNo = variations.length > 0
      ? Math.max(...variations.map(v => v.variation_no)) + 1
      : 1
    const { data, error } = await supabase
      .from('variations')
      .insert({ ...payload, variation_no: nextNo })
      .select()
      .single()
    if (error) throw error
    setVariations(prev => [...prev, data])
    return data
  }

  async function deleteVariation(id) {
    const { error } = await supabase.from('variations').delete().eq('id', id)
    if (error) throw error
    setVariations(prev => prev.filter(v => v.id !== id))
  }

  return { variations, loading, fetchVariations, createVariation, deleteVariation }
}
