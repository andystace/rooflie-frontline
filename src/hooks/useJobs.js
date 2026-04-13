import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching jobs:', error)
    else setJobs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  async function createJob(payload) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw error
    setJobs(prev => [data, ...prev])
    return data
  }

  async function updateJob(id, payload) {
    const { data, error } = await supabase
      .from('jobs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setJobs(prev => prev.map(j => j.id === id ? data : j))
    return data
  }

  async function deleteJob(id) {
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) throw error
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  return { jobs, loading, fetchJobs, createJob, updateJob, deleteJob }
}
