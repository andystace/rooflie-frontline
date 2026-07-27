import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePaySettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pay_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) console.error('Error fetching pay settings:', error)
    setSettings(data || null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function setPayForHolidays(value) {
    if (!settings) return
    const { data, error } = await supabase
      .from('pay_settings')
      .update({ pay_for_holidays: value, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single()
    if (error) throw error
    setSettings(data)
    return data
  }

  return { settings, loading, setPayForHolidays }
}
