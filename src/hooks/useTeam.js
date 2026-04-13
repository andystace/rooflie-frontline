import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { format, subDays } from 'date-fns'

export function useTeam() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState(new Set())

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('display_order')
    if (error) console.error('Error fetching team:', error)
    else setTeam(data || [])
    setLoading(false)
  }, [])

  // Fetch recent activity — member IDs with schedule entries in last 30 days
  const fetchRecentActivity = useCallback(async () => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('team_member_id')
      .gte('date', thirtyDaysAgo)
    if (error) {
      console.error('Error fetching recent activity:', error)
      return
    }
    const ids = new Set((data || []).map(e => e.team_member_id))
    setRecentActivity(ids)
  }, [])

  useEffect(() => {
    fetchTeam()
    fetchRecentActivity()
  }, [fetchTeam, fetchRecentActivity])

  const activeTeam = team.filter(m => m.active)

  // Smart sort: active+recent first, active+no-recent second, inactive last
  // Within each tier: own team before subcontractors, then by display_order
  const sortedTeam = useMemo(() => {
    function tierOf(m) {
      if (!m.active) return 2
      if (recentActivity.has(m.id)) return 0
      return 1
    }
    function subOrder(m) {
      return m.role === 'subcontractor' ? 1 : 0
    }
    return [...team].sort((a, b) => {
      const tierDiff = tierOf(a) - tierOf(b)
      if (tierDiff !== 0) return tierDiff
      const subDiff = subOrder(a) - subOrder(b)
      if (subDiff !== 0) return subDiff
      return (a.display_order || 0) - (b.display_order || 0)
    })
  }, [team, recentActivity])

  const sortedActiveTeam = useMemo(() => sortedTeam.filter(m => m.active), [sortedTeam])

  async function createMember(payload) {
    const maxOrder = team.reduce((max, m) => Math.max(max, m.display_order || 0), 0)
    const { data, error } = await supabase
      .from('team_members')
      .insert({ ...payload, display_order: maxOrder + 1 })
      .select()
      .single()
    if (error) throw error
    setTeam(prev => [...prev, data])
    return data
  }

  async function updateMember(id, payload) {
    const { data, error } = await supabase
      .from('team_members')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setTeam(prev => prev.map(m => m.id === id ? data : m))
    return data
  }

  function getPartner(memberId) {
    const member = team.find(m => m.id === memberId)
    if (!member?.default_partner_id) return null
    return team.find(m => m.id === member.default_partner_id) || null
  }

  return { team, activeTeam, sortedTeam, sortedActiveTeam, loading, fetchTeam, createMember, updateMember, getPartner }
}
