import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function getDashboardData(company = 'All', location = 'All', year = 'All') {
  const filterKey = `${company}_${location}_${year}`
  
  const { data, error } = await supabase
    .from('dashboard_cache')
    .select('data, updated_at')
    .eq('filter_key', filterKey)
    .single()
  
  if (error || !data) {
    console.error('Error fetching dashboard data:', error)
    return null
  }
  
  const result = data.data
  result.fromCache = true
  result.cacheAge = Math.round((Date.now() - new Date(data.updated_at).getTime()) / 60000)
  
  return result
}
