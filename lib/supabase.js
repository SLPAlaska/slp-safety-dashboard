import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iypezirwdlqpptjpeeyf.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cGV6aXJ3ZGxxcHB0anBlZXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Nzg3NzYsImV4cCI6MjA4NDI1NDc3Nn0.rfTN8fi9rd6o5rX-scAg9I1BbC-UjM8WoWEXDbrYJD4'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildFilters(query, company, location, year, dateField = 'created_at') {
  if (company !== 'All') {
    query = query.or(`company.eq.${company},company_name.eq.${company}`)
  }
  if (location !== 'All') {
    query = query.or(`location.eq.${location},location_name.eq.${location}`)
  }
  if (year !== 'All') {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    query = query.gte(dateField, startDate).lte(dateField, endDate)
  }
  return query
}

function getYearFilter(year) {
  if (year === 'All') return { start: null, end: null }
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  }
}

async function safeQuery(tableName, selectFields = '*', filters = {}) {
  try {
    let query = supabase.from(tableName).select(selectFields)
    
    // Apply year filter first (most reliable)
    if (filters.year && filters.year !== 'All') {
      const dateField = filters.dateField || 'created_at'
      query = query.gte(dateField, `${filters.year}-01-01`).lte(dateField, `${filters.year}-12-31`)
    }
    
    const { data, error } = await query
    if (error) {
      console.warn(`Query error for ${tableName}:`, error.message)
      return []
    }
    
    let results = data || []
    
    // Apply company filter in JavaScript (handles company, company_name, client_company, AND client fields)
    if (filters.company && filters.company !== 'All') {
      results = results.filter(row => 
        row.company === filters.company || 
        row.company_name === filters.company ||
        row.client_company === filters.company ||
        row.client === filters.company
      )
    }
    
    // Apply location filter in JavaScript (handles both location and location_name fields)
    if (filters.location && filters.location !== 'All') {
      results = results.filter(row => 
        row.location === filters.location || 
        row.location_name === filters.location
      )
    }
    
    return results
  } catch (e) {
    console.warn(`Exception querying ${tableName}:`, e.message)
    return []
  }
}

// ============================================================================
// EMPLOYEE CENSUS DATA (for participation rate calculation)
// ============================================================================
const EMPLOYEE_CENSUS = {
  'MagTec Alaska': 82,
  'Chosen Construction': 38,
  'AKE-Line': 41,
  'Pollard Wireline': 154,
  'GBR Equipment': 8,
  'Yellowjacket': 25,  // Estimate
  'A-C Electric': 15,  // Estimate
  'ASRC Energy Services': 50, // Estimate
  'CCI-Industrial': 20, // Estimate
  'CINGSA': 30, // Estimate
  'Coho Enterprises': 15, // Estimate
  'Conam Construction': 40, // Estimate
  'ConocoPhillips': 500, // Large operator - estimate
  'Five Star Oilfield Services': 25, // Estimate
  'Fox Energy Services': 20, // Estimate
  'G.A. West': 15, // Estimate
  'GLM Energy Services': 20, // Estimate
  'Graham Industrial Coatings': 15, // Estimate
  'Harvest Midstream': 30, // Estimate
  'Hilcorp Alaska': 400, // Large operator - estimate
  'Merkes Builders': 20, // Estimate
  'Nordic-Calista': 100, // Estimate
  'Parker TRS': 25, // Estimate
  'Peninsula Paving': 30, // Estimate
  'Ridgeline Oilfield Services': 20, // Estimate
  'Santos': 50, // Estimate
  'Summit Excavation': 25, // Estimate
  'Apache Corp.': 100, // Estimate
  'Armstrong Oil & Gas': 50, // Estimate
}

function getEmployeeCount(company) {
  if (company === 'All') {
    return Object.values(EMPLOYEE_CENSUS).reduce((a, b) => a + b, 0)
  }
  return EMPLOYEE_CENSUS[company] || null
}

// ============================================================================
// TREND & ENGAGEMENT HELPERS
// ============================================================================

function calculateTrend(current, previous) {
  if (previous === 0 && current === 0) return { direction: 'flat', change: 0, percent: 0 }
  if (previous === 0) return { direction: 'up', change: current, percent: 100 }
  const change = current - previous
  const percent = Math.round((change / previous) * 100)
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    change,
    percent: Math.abs(percent)
  }
}

function getDateRanges(year) {
  const now = new Date()
  let currentStart, currentEnd, previousStart, previousEnd
  
  if (year === 'All') {
    // Compare last 30 days to previous 30 days
    currentEnd = now
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    previousEnd = new Date(currentStart.getTime() - 1)
    previousStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else {
    // Compare this year to last year (same period)
    const yearNum = parseInt(year)
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))
    
    currentStart = new Date(`${yearNum}-01-01`)
    currentEnd = new Date(`${yearNum}-12-31`)
    previousStart = new Date(`${yearNum - 1}-01-01`)
    previousEnd = new Date(`${yearNum - 1}-12-31`)
  }
  
  return { currentStart, currentEnd, previousStart, previousEnd }
}

function filterByDateRange(data, startDate, endDate, dateField = 'created_at') {
  return data.filter(item => {
    const itemDate = new Date(item[dateField] || item.created_at || item.date || item.incident_date || item.observation_date)
    return itemDate >= startDate && itemDate <= endDate
  })
}

function getUniqueSubmitters(dataArrays) {
  const submitters = new Set()
  dataArrays.forEach(data => {
    data.forEach(item => {
      const name = item.submitter_name || item.reporter_name || item.reported_by_name || 
                   item.observer_name || item.inspector_name || item.conducted_by || 
                   item.auditor_name || item.employee_name
      if (name) submitters.add(name.toLowerCase().trim())
    })
  })
  return submitters
}

function getDaysSinceLastSubmission(dataArrays) {
  let mostRecentDate = null
  
  dataArrays.forEach(data => {
    data.forEach(item => {
      const dateStr = item.created_at || item.date || item.incident_date || item.observation_date
      if (dateStr) {
        const itemDate = new Date(dateStr)
        if (!mostRecentDate || itemDate > mostRecentDate) {
          mostRecentDate = itemDate
        }
      }
    })
  })
  
  if (!mostRecentDate) return null
  
  const now = new Date()
  const diffTime = Math.abs(now - mostRecentDate)
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

function calculate30DayRiskForecast(metrics) {
  // Base risk starts at 30 (moderate baseline)
  let forecastRisk = 30
  
  // Factor 1: Trend in at-risk behaviors (weight: high)
  if (metrics.bbsTrend?.direction === 'up' && metrics.bbsTrend?.percent > 20) forecastRisk += 15
  else if (metrics.bbsTrend?.direction === 'up') forecastRisk += 8
  else if (metrics.bbsTrend?.direction === 'down') forecastRisk -= 5
  
  // Factor 2: SIF Potential trend
  if (metrics.sifTrend?.direction === 'up') forecastRisk += 12
  else if (metrics.sifTrend?.direction === 'down') forecastRisk -= 5
  
  // Factor 3: Open items aging
  if (metrics.avgDaysOpen > 60) forecastRisk += 15
  else if (metrics.avgDaysOpen > 30) forecastRisk += 8
  
  // Factor 4: Engagement declining (days since submission)
  if (metrics.daysSinceLastSubmission > 14) forecastRisk += 20
  else if (metrics.daysSinceLastSubmission > 7) forecastRisk += 10
  else if (metrics.daysSinceLastSubmission > 3) forecastRisk += 5
  
  // Factor 5: Recent incidents
  if (metrics.recentIncidents >= 3) forecastRisk += 20
  else if (metrics.recentIncidents >= 1) forecastRisk += 10
  
  // Factor 6: Leading indicator activity (protective)
  if (metrics.leadingActivityLevel === 'high') forecastRisk -= 15
  else if (metrics.leadingActivityLevel === 'medium') forecastRisk -= 8
  else if (metrics.leadingActivityLevel === 'low') forecastRisk += 10
  else if (metrics.leadingActivityLevel === 'none') forecastRisk += 25
  
  return Math.min(100, Math.max(0, Math.round(forecastRisk)))
}

// ============================================================================
// MAIN DASHBOARD DATA FUNCTION
// ============================================================================

export async function getDashboardData(company = 'All', location = 'All', year = 'All') {
  const filters = { company, location, year }
  const startTime = Date.now()
  
  try {
    // ========================================================================
    // PARALLEL DATA FETCHING - All queries run simultaneously
    // ========================================================================
    const [
      // BBS & Behavior Data
      bbsData,
      goodCatchData,
      hazardIdData,
      stopTake5Data,
      riskConversationData,
      
      // Incidents & SAIL
      incidentsData,
      sailLogData,
      propertyDamageData,
      
      // Leading Indicator Forms
      thaData,
      safetyMeetingsData,
      toolboxMeetingsData,
      mbwaData,
      hseContactsData,
      dailyActivityData,
      ehsFieldData,
      
      // LSR Audits
      lsrConfinedData,
      lsrDrivingData,
      lsrEnergyData,
      lsrFallData,
      lsrLiftingData,
      lsrLineOfFireData,
      lsrWorkPermitsData,
      
      // Monthly Inspections
      fireExtData,
      eyewashData,
      firstAidData,
      aedData,
      ladderData,
      harnessData,
      lanyardData,
      shackleData,
      slingData,
      wireRopeData,
      chainHoistData,
      drillEvalData,
      
      // Equipment Inspections
      vehicleData,
      forkliftInspData,
      craneInspData,
      heavyEquipData,
      scaffoldData,
      
      // Investigation Data
      correctiveActionsData,
      incidentCostsData,
      
    ] = await Promise.all([
      // BBS & Behavior
      safeQuery('bbs_observations', '*', filters),
      safeQuery('good_catch_near_miss', '*', filters),
      safeQuery('hazard_id_reports', '*', filters),
      safeQuery('stop_take_5', '*', filters),
      safeQuery('risk_control_conversations', '*', filters),
      
      // Incidents & SAIL
      safeQuery('incidents', '*', { ...filters, dateField: 'incident_date' }),
      safeQuery('sail_log', '*', filters),
      safeQuery('property_damage_reports', '*', filters),
      
      // Leading Indicators
      safeQuery('tha_submissions', '*', filters),
      safeQuery('safety_meetings', '*', filters),
      safeQuery('toolbox_meeting_assessment', '*', filters),
      safeQuery('mbwa', '*', filters),
      safeQuery('hse_contacts', '*', filters),
      safeQuery('daily_activity_logs', '*', filters),
      safeQuery('ehs_field_evaluations', '*', filters),
      
      // LSR Audits
      safeQuery('lsr_confined_space_audits', '*', filters),
      safeQuery('lsr_driving_audits', '*', filters),
      safeQuery('lsr_energy_isolation_audits', '*', filters),
      safeQuery('lsr_fall_protection_audits', '*', filters),
      safeQuery('lsr_lifting_operations_audits', '*', filters),
      safeQuery('lsr_line_of_fire_audits', '*', filters),
      safeQuery('lsr_work_permits_audits', '*', filters),
      
      // Monthly Inspections
      safeQuery('fire_extinguisher_inspections', '*', filters),
      safeQuery('eyewash_station_inspections', '*', filters),
      safeQuery('first_aid_kit_inspections', '*', filters),
      safeQuery('aed_inspections', '*', filters),
      safeQuery('ladder_inspections', '*', filters),
      safeQuery('harness_inspections', '*', filters),
      safeQuery('lanyard_srl_inspections', '*', filters),
      safeQuery('shackle_inspections', '*', filters),
      safeQuery('synthetic_sling_inspections', '*', filters),
      safeQuery('wire_rope_inspections', '*', filters),
      safeQuery('chain_hoist_inspections', '*', filters),
      safeQuery('emergency_drill_evaluations', '*', filters),
      
      // Equipment
      safeQuery('vehicle_inspections', '*', filters),
      safeQuery('forklift_inspections', '*', filters),
      safeQuery('crane_inspections', '*', filters),
      safeQuery('heavy_equipment_inspections', '*', filters),
      safeQuery('scaffold_inspections', '*', filters),
      
      // Investigation
      safeQuery('investigation_corrective_actions', '*', filters),
      safeQuery('incident_costs', '*', filters),
    ])

    // ========================================================================
    // CALCULATE BBS METRICS
    // ========================================================================
    const bbsSafe = bbsData.filter(b => b.observation_type === 'Safe').length
    
    const bbsAtRisk = bbsData.filter(b => b.observation_type === 'At-Risk').length
    
    const bbsJobStops = bbsData.filter(b => b.job_stop_required === true).length
    
    const safeRatio = bbsAtRisk > 0 ? Math.round((bbsSafe / bbsAtRisk) * 10) / 10 : bbsSafe > 0 ? bbsSafe : 0
    const jobStopRate = bbsAtRisk > 0 ? Math.round((bbsJobStops / bbsAtRisk) * 100) : 0

    const bbsMetrics = {
      total: bbsData.length,
      safe: bbsSafe,
      atRisk: bbsAtRisk,
      jobStops: bbsJobStops,
      safeRatio,
      jobStopRate
    }

    // ========================================================================
    // CALCULATE NEAR MISS / GOOD CATCH METRICS
    // ========================================================================
    const nearMissCount = goodCatchData.filter(g => 
      g.event_type === 'Near Miss' || g.near_miss === true
    ).length
    
    const goodCatchCount = goodCatchData.filter(g => 
      g.event_type === 'Good Catch' || g.good_catch === true
    ).length

    const nearMissMetrics = {
      totalReported: goodCatchData.length,
      nearMisses: nearMissCount,
      goodCatches: goodCatchCount
    }

    // ========================================================================
    // CALCULATE SIF POTENTIAL METRICS
    // ========================================================================
    // SIF Potential should ONLY be calculated from events where something 
    // went wrong or could have gone wrong - NOT from safe behavior observations
    
    // Helper to check if STKY/SIF is positively marked (handles text, boolean, null)
    const isSifPositive = (val) => val === 'Yes' || val === true
    
    // Good Catch / Near Miss - all are relevant events
    const sifFromGoodCatch = goodCatchData.filter(g => 
      isSifPositive(g.stky_event) ||
      isSifPositive(g.sif_potential) ||
      g.psif_classification?.includes('PSIF') ||
      g.psif_classification?.includes('SIF')
    ).length
    
    // Incidents - all are relevant events
    const sifFromIncidents = incidentsData.filter(i => 
      isSifPositive(i.is_sif) ||
      isSifPositive(i.is_sif_p) ||
      isSifPositive(i.stky_event) ||
      i.psif_classification?.includes('SIF') || 
      i.psif_classification?.includes('PSIF')
    ).length
    
    // Hazard IDs - only count those explicitly marked as SIF potential
    const sifFromHazardId = hazardIdData.filter(h => 
      isSifPositive(h.sif_potential) ||
      isSifPositive(h.stky_event) ||
      h.threat_level === 'High'
    ).length
    
    // BBS - ONLY count At-Risk observations with SIF potential
    // Safe observations should NEVER count toward SIF metrics
    const atRiskBBS = bbsData.filter(b => b.observation_type === 'At-Risk')
    const sifFromBBS = atRiskBBS.filter(b => isSifPositive(b.stky_event)).length
    
    // Property Damage - all are relevant events
    const sifFromPropertyDamage = propertyDamageData.filter(p =>
      isSifPositive(p.stky_event) ||
      isSifPositive(p.sif_potential) ||
      p.psif_classification?.includes('PSIF') ||
      p.psif_classification?.includes('SIF')
    ).length
    
    // Total SIF events (numerator) - only from actual events, not hazard IDs
    const totalSifEvents = sifFromGoodCatch + sifFromIncidents + sifFromBBS + sifFromPropertyDamage
    
    // Denominator: Only events where SIF potential is relevant
    // - All incidents (something went wrong)
    // - All good catches / near misses (something almost went wrong)
    // - All property damage (something went wrong)
    // - Only AT-RISK BBS observations (unsafe behavior observed)
    // - Hazard IDs are informational, not events - exclude from denominator
    const totalEventsForSif = goodCatchData.length + incidentsData.length + propertyDamageData.length + atRiskBBS.length
    
    const sifPotentialRate = totalEventsForSif > 0 ? Math.round((totalSifEvents / totalEventsForSif) * 100) : 0

    const allEventsWithControls = [...goodCatchData, ...incidentsData, ...propertyDamageData]
    const directControlEffective = allEventsWithControls.filter(i => 
      i.direct_control_present === 'Yes' || 
      i.direct_control_status === 'Effective' ||
      i.direct_control_status === 'Yes-Effective'
    ).length
    const directControlFailed = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-Failed' ||
      i.direct_control_status === 'Failed' ||
      i.direct_control_status === 'Yes-Failed'
    ).length
    const directControlAltOnly = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-Alternative' ||
      i.direct_control_status === 'Alternative Only'
    ).length
    const directControlNone = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-None' ||
      i.direct_control_status === 'None' ||
      i.direct_control_status === 'No'
    ).length

    const sifMetrics = {
      sifPotentialCount: totalSifEvents,
      totalEvents: totalEventsForSif,
      sifPotentialRate,
      directControlStatus: {
        effective: directControlEffective,
        failed: directControlFailed,
        alternativeOnly: directControlAltOnly,
        none: directControlNone
      }
    }

    // ========================================================================
    // CALCULATE ENERGY SOURCE METRICS
    // ========================================================================
    const energyTypes = ['Gravity', 'Motion', 'Mechanical', 'Electrical', 'Pressure', 'Chemical', 'Temperature', 'Stored']
    const byEnergyType = {}
    energyTypes.forEach(type => { byEnergyType[type] = 0 })

    const parseEnergyTypes = (energyField) => {
      if (!energyField) return []
      if (Array.isArray(energyField)) return energyField
      if (typeof energyField === 'string') {
        return energyField.split(',').map(e => e.trim())
      }
      return []
    }

    goodCatchData.forEach(gc => {
      const types = parseEnergyTypes(gc.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    thaData.forEach(tha => {
      const types = parseEnergyTypes(tha.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
      energyTypes.forEach(type => {
        if (tha[`energy_${type.toLowerCase()}`] === true || tha[`energy_${type.toLowerCase()}`] === 'Yes') {
          byEnergyType[type]++
        }
      })
    })

    stopTake5Data.forEach(st => {
      const types = parseEnergyTypes(st.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
      energyTypes.forEach(type => {
        if (st[`energy_${type.toLowerCase()}`] === true || st[`energy_${type.toLowerCase()}`] === 'Yes') {
          byEnergyType[type]++
        }
      })
    })

    riskConversationData.forEach(rc => {
      const types = parseEnergyTypes(rc.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    hazardIdData.forEach(hz => {
      const types = parseEnergyTypes(hz.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    propertyDamageData.forEach(pd => {
      const types = parseEnergyTypes(pd.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    const totalEnergyObservations = Object.values(byEnergyType).reduce((a, b) => a + b, 0)

    let tier1Controls = 0, tier2Controls = 0, tier3Controls = 0
    const controlTiers = {
      tier1: ['Elimination', 'Substitution', 'Engineering'],
      tier2: ['Guarding', 'LOTO', 'Warnings', 'Barriers'],
      tier3: ['Administrative', 'PPE', 'Training', 'Procedures']
    }

    thaData.forEach(tha => {
      if (tha.control_types && Array.isArray(tha.control_types)) {
        tha.control_types.forEach(c => {
          if (controlTiers.tier1.some(t => c?.toLowerCase().includes(t.toLowerCase()))) tier1Controls++
          else if (controlTiers.tier2.some(t => c?.toLowerCase().includes(t.toLowerCase()))) tier2Controls++
          else if (controlTiers.tier3.some(t => c?.toLowerCase().includes(t.toLowerCase()))) tier3Controls++
        })
      }
      if (tha.hierarchy_control) {
        const level = parseInt(tha.hierarchy_control.charAt(0))
        if (level <= 2) tier1Controls++
        else if (level <= 4) tier2Controls++
        else tier3Controls++
      }
    })

    const totalControls = tier1Controls + tier2Controls + tier3Controls
    const controlHierarchyScore = totalControls > 0 
      ? Math.round(((tier1Controls * 100) + (tier2Controls * 60) + (tier3Controls * 30)) / totalControls)
      : 50

    const energySourceMetrics = {
      totalObservations: totalEnergyObservations,
      byEnergyType,
      controlHierarchy: {
        tier1: tier1Controls,
        tier2: tier2Controls,
        tier3: tier3Controls
      },
      controlHierarchyScore
    }

    // ========================================================================
    // CALCULATE LEADING INDICATORS
    // ========================================================================
    const leadingIndicators = {
      hseContacts: hseContactsData.length + dailyActivityData.length,
      thas: thaData.length,
      safetyMeetings: safetyMeetingsData.length,
      toolboxMeetings: toolboxMeetingsData.length,
      stopTake5: stopTake5Data.length,
      riskConversations: riskConversationData.length,
      mbwa: mbwaData.length,
      ehsFieldEvals: ehsFieldData.length,
      bbsObservations: bbsData.length,
      hazardIds: hazardIdData.length,
      goodCatches: goodCatchData.length
    }

    const totalLeading = Object.values(leadingIndicators).reduce((a, b) => a + b, 0)

    // ========================================================================
    // CALCULATE LAGGING INDICATORS
    // ========================================================================
    const openIncidents = incidentsData.filter(i => 
      !['Closed', 'Approved'].includes(i.status)
    ).length
    
    const closedIncidents = incidentsData.filter(i => 
      ['Closed', 'Approved'].includes(i.status)
    ).length

    const firstAidIncidents = incidentsData.filter(i => 
      i.safety_severity === 'G' || i.safety_severity === 'F' || i.actual_outcome === 'First Aid'
    ).length

    const recordableIncidents = incidentsData.filter(i => 
      ['C', 'D', 'E'].includes(i.safety_severity) || i.actual_outcome === 'Recordable'
    ).length

    const lostTimeIncidents = incidentsData.filter(i => 
      ['A', 'B'].includes(i.safety_severity) || i.actual_outcome === 'Lost Time'
    ).length

    const sailOpen = sailLogData.filter(s => s.status === 'Open' || s.status === 'In Progress').length
    const sailCritical = sailLogData.filter(s => s.priority === 'A' || s.priority === 'Critical').length
    const sailOverdue = sailLogData.filter(s => {
      if (!s.target_date || ['Closed', 'Complete'].includes(s.status)) return false
      return new Date(s.target_date) < new Date()
    }).length

    const laggingIndicators = {
      openIncidents,
      closedIncidents,
      firstAid: firstAidIncidents,
      recordable: recordableIncidents,
      lostTime: lostTimeIncidents,
      propertyDamage: propertyDamageData.length,
      sailOpen,
      sailCritical,
      sailOverdue
    }

    const totalLagging = openIncidents + closedIncidents + propertyDamageData.length + sailOpen

    // ========================================================================
    // CALCULATE AGING METRICS
    // ========================================================================
    const today = new Date()
    const openItems = []
    
    incidentsData.filter(i => !['Closed', 'Approved'].includes(i.status)).forEach(i => {
      const created = new Date(i.incident_date || i.created_at)
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24))
      openItems.push({
        form: 'Incident',
        id: i.incident_id || i.id,
        company: i.company_name || i.company,
        location: i.location_name || i.location,
        status: i.status || 'Open',
        daysOpen,
        created: i.incident_date || i.created_at
      })
    })

    sailLogData.filter(s => !['Closed', 'Complete'].includes(s.status)).forEach(s => {
      const created = new Date(s.date_identified || s.created_at)
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24))
      openItems.push({
        form: 'SAIL Log',
        id: s.sail_id || s.id,
        company: s.company_name || s.company,
        location: s.location_name || s.location,
        status: s.status || 'Open',
        daysOpen,
        created: s.date_identified || s.created_at
      })
    })

    correctiveActionsData.filter(ca => !['Completed', 'Verified', 'Closed'].includes(ca.action_status)).forEach(ca => {
      const created = new Date(ca.created_at)
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24))
      openItems.push({
        form: 'Corrective Action',
        id: `CA-${ca.action_number}`,
        company: ca.company_name || 'N/A',
        location: ca.location_name || 'N/A',
        status: ca.action_status || 'Open',
        daysOpen,
        created: ca.created_at
      })
    })

    openItems.sort((a, b) => b.daysOpen - a.daysOpen)

    const avgDaysOpen = openItems.length > 0 
      ? Math.round(openItems.reduce((sum, i) => sum + i.daysOpen, 0) / openItems.length)
      : 0

    const aging = {
      avgDaysOpen,
      over30Days: openItems.filter(i => i.daysOpen > 30).length,
      over60Days: openItems.filter(i => i.daysOpen > 60).length,
      over90Days: openItems.filter(i => i.daysOpen > 90).length
    }

    // ========================================================================
    // CALCULATE LSR AUDIT AREAS NEEDING FOCUS
    // ========================================================================
    const allLsrAudits = [
      ...lsrConfinedData.map(a => ({ ...a, category: 'Confined Space' })),
      ...lsrDrivingData.map(a => ({ ...a, category: 'Driving' })),
      ...lsrEnergyData.map(a => ({ ...a, category: 'Energy Isolation' })),
      ...lsrFallData.map(a => ({ ...a, category: 'Fall Protection' })),
      ...lsrLiftingData.map(a => ({ ...a, category: 'Lifting Operations' })),
      ...lsrLineOfFireData.map(a => ({ ...a, category: 'Line of Fire' })),
      ...lsrWorkPermitsData.map(a => ({ ...a, category: 'Work Permits' }))
    ]

    const issuesByCategory = {}
    allLsrAudits.forEach(audit => {
      const hasIssue = audit.compliant === false || 
                       audit.satisfactory === false || 
                       audit.pass === false ||
                       audit.findings ||
                       audit.corrective_action_required === true

      if (hasIssue) {
        const key = audit.category
        if (!issuesByCategory[key]) {
          issuesByCategory[key] = { count: 0, issues: [], locations: {} }
        }
        issuesByCategory[key].count++
        if (audit.findings) issuesByCategory[key].issues.push(audit.findings)
        const loc = audit.location || audit.location_name || 'Unknown'
        issuesByCategory[key].locations[loc] = (issuesByCategory[key].locations[loc] || 0) + 1
      }
    })

    const areasNeedingFocus = Object.entries(issuesByCategory)
      .map(([category, data]) => ({
        category,
        count: data.count,
        issue: data.issues[0] || 'Non-compliance identified',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ========================================================================
    // CALCULATE TRUECOST SUMMARY
    // ========================================================================
    const totalIncidentCosts = incidentCostsData.reduce((sum, ic) => sum + (ic.total_cost || 0), 0)
    const trueCostSummary = {
      hasData: incidentCostsData.length > 0,
      totalCosts: totalIncidentCosts,
      incidentsCosted: incidentCostsData.length,
      avgCostPerIncident: incidentCostsData.length > 0 
        ? Math.round(totalIncidentCosts / incidentCostsData.length) 
        : 0
    }

    // ========================================================================
    // CALCULATE COMPOSITE SCORES
    // ========================================================================
    
    // SAFETY CULTURE INDEX (0-100)
    // Start at 70 (baseline "average" culture) and adjust up/down based on indicators
    let sciScore = 70

    // POSITIVE FACTORS (can add up to +30)
    
    // Safe/At-Risk Ratio - higher is better (max +10)
    if (safeRatio >= 10) sciScore += 10
    else if (safeRatio >= 5) sciScore += 7
    else if (safeRatio >= 3) sciScore += 5
    else if (safeRatio >= 2) sciScore += 3
    else if (safeRatio >= 1) sciScore += 1

    // Job Stop Rate - willingness to stop work is positive (max +10)
    if (jobStopRate >= 80) sciScore += 10
    else if (jobStopRate >= 60) sciScore += 8
    else if (jobStopRate >= 40) sciScore += 5
    else if (jobStopRate >= 20) sciScore += 2

    // Near Miss / Good Catch Reporting - more reporting = better culture (max +10)
    if (nearMissMetrics.totalReported >= 20) sciScore += 10
    else if (nearMissMetrics.totalReported >= 10) sciScore += 7
    else if (nearMissMetrics.totalReported >= 5) sciScore += 4
    else if (nearMissMetrics.totalReported >= 1) sciScore += 2

    // NEGATIVE FACTORS (can subtract up to -50)
    
    // Incidents - having incidents is bad (max -20)
    const totalIncidents = incidentsData.length
    if (totalIncidents >= 10) sciScore -= 20
    else if (totalIncidents >= 5) sciScore -= 15
    else if (totalIncidents >= 3) sciScore -= 10
    else if (totalIncidents >= 1) sciScore -= 5

    // SIF Potential Rate - high rate is concerning (max -15)
    if (sifPotentialRate >= 50) sciScore -= 15
    else if (sifPotentialRate >= 30) sciScore -= 10
    else if (sifPotentialRate >= 20) sciScore -= 7
    else if (sifPotentialRate >= 10) sciScore -= 3

    // At-Risk Behavior Rate - high at-risk rate is bad (max -15)
    const atRiskRate = bbsData.length > 0 ? (bbsAtRisk / bbsData.length) * 100 : 0
    if (atRiskRate >= 50) sciScore -= 15
    else if (atRiskRate >= 30) sciScore -= 10
    else if (atRiskRate >= 20) sciScore -= 5
    else if (atRiskRate >= 10) sciScore -= 2

    // Open/Overdue Items - unresolved issues hurt culture (max -10)
    const totalOpenItems = openIncidents + sailOpen
    if (totalOpenItems >= 10) sciScore -= 10
    else if (totalOpenItems >= 5) sciScore -= 7
    else if (totalOpenItems >= 3) sciScore -= 4
    else if (totalOpenItems >= 1) sciScore -= 2

    // Overdue items are especially bad
    if (sailOverdue >= 5) sciScore -= 10
    else if (sailOverdue >= 3) sciScore -= 7
    else if (sailOverdue >= 1) sciScore -= 3

    const safetyCultureIndex = Math.min(100, Math.max(0, sciScore))

    let riskScore = 0

    // Already calculated totalOpenItems above
    if (totalOpenItems >= 20) riskScore += 30
    else if (totalOpenItems >= 10) riskScore += 25
    else if (totalOpenItems >= 5) riskScore += 15
    else if (totalOpenItems >= 1) riskScore += 5

    if (sailOverdue >= 10) riskScore += 25
    else if (sailOverdue >= 5) riskScore += 20
    else if (sailOverdue >= 2) riskScore += 10
    else if (sailOverdue >= 1) riskScore += 5

    if (sifPotentialRate >= 30) riskScore += 25
    else if (sifPotentialRate >= 20) riskScore += 20
    else if (sifPotentialRate >= 10) riskScore += 10
    else if (sifPotentialRate >= 5) riskScore += 5

    // atRiskRate already calculated above for SCI
    if (atRiskRate >= 50) riskScore += 20
    else if (atRiskRate >= 30) riskScore += 15
    else if (atRiskRate >= 15) riskScore += 8
    else if (atRiskRate >= 5) riskScore += 3

    const predictiveRiskScore = Math.min(100, Math.max(0, riskScore))

    // ========================================================================
    // INSPECTION COMPLIANCE SUMMARY
    // ========================================================================
    const inspectionCounts = {
      fireExtinguisher: fireExtData.length,
      eyewash: eyewashData.length,
      firstAid: firstAidData.length,
      aed: aedData.length,
      ladder: ladderData.length,
      harness: harnessData.length,
      lanyard: lanyardData.length,
      shackle: shackleData.length,
      sling: slingData.length,
      wireRope: wireRopeData.length,
      chainHoist: chainHoistData.length,
      drillEval: drillEvalData.length,
      vehicle: vehicleData.length,
      forklift: forkliftInspData.length,
      crane: craneInspData.length,
      heavyEquip: heavyEquipData.length,
      scaffold: scaffoldData.length
    }

    const totalInspections = Object.values(inspectionCounts).reduce((a, b) => a + b, 0)

    // ========================================================================
    // TREND CALCULATIONS (comparing current period to previous)
    // ========================================================================
    
    // Get all data arrays for engagement calculation
    const allDataArrays = [
      bbsData, goodCatchData, hazardIdData, thaData, safetyMeetingsData,
      toolboxMeetingsData, hseContactsData, incidentsData
    ]
    
    // Days since last submission
    const daysSinceLastSubmission = getDaysSinceLastSubmission(allDataArrays)
    
    // Unique submitters (engagement proxy)
    const uniqueSubmitters = getUniqueSubmitters(allDataArrays)
    const activeSubmitterCount = uniqueSubmitters.size
    
    // Calculate trends by comparing first half to second half of data
    // (Simple approach that works without additional queries)
    const allDates = []
    allDataArrays.forEach(arr => {
      arr.forEach(item => {
        const d = item.created_at || item.date || item.incident_date || item.observation_date
        if (d) allDates.push(new Date(d))
      })
    })
    
    let trends = {
      safeRatio: { direction: 'flat', change: 0, percent: 0 },
      incidents: { direction: 'flat', change: 0, percent: 0 },
      sifRate: { direction: 'flat', change: 0, percent: 0 },
      leadingActivities: { direction: 'flat', change: 0, percent: 0 },
      atRiskBehaviors: { direction: 'flat', change: 0, percent: 0 }
    }
    
    if (allDates.length > 1) {
      allDates.sort((a, b) => a - b)
      const midpoint = allDates[Math.floor(allDates.length / 2)]
      
      // BBS trends
      const bbsFirstHalf = bbsData.filter(b => new Date(b.observation_date || b.created_at) < midpoint)
      const bbsSecondHalf = bbsData.filter(b => new Date(b.observation_date || b.created_at) >= midpoint)
      
      const firstHalfAtRisk = bbsFirstHalf.filter(b => b.observation_type === 'At-Risk').length
      const secondHalfAtRisk = bbsSecondHalf.filter(b => b.observation_type === 'At-Risk').length
      trends.atRiskBehaviors = calculateTrend(secondHalfAtRisk, firstHalfAtRisk)
      
      const firstHalfSafe = bbsFirstHalf.filter(b => b.observation_type === 'Safe').length
      const secondHalfSafe = bbsSecondHalf.filter(b => b.observation_type === 'Safe').length
      const firstRatio = firstHalfAtRisk > 0 ? firstHalfSafe / firstHalfAtRisk : firstHalfSafe
      const secondRatio = secondHalfAtRisk > 0 ? secondHalfSafe / secondHalfAtRisk : secondHalfSafe
      trends.safeRatio = calculateTrend(secondRatio, firstRatio)
      
      // Incident trends
      const incFirstHalf = incidentsData.filter(i => new Date(i.incident_date || i.created_at) < midpoint).length
      const incSecondHalf = incidentsData.filter(i => new Date(i.incident_date || i.created_at) >= midpoint).length
      trends.incidents = calculateTrend(incSecondHalf, incFirstHalf)
      
      // Leading activity trends
      const leadingFirstHalf = [...thaData, ...safetyMeetingsData, ...toolboxMeetingsData, ...hseContactsData]
        .filter(l => new Date(l.created_at || l.date) < midpoint).length
      const leadingSecondHalf = [...thaData, ...safetyMeetingsData, ...toolboxMeetingsData, ...hseContactsData]
        .filter(l => new Date(l.created_at || l.date) >= midpoint).length
      trends.leadingActivities = calculateTrend(leadingSecondHalf, leadingFirstHalf)
    }
    
    // Determine leading activity level for risk forecast
    let leadingActivityLevel = 'none'
    if (totalLeading >= 50) leadingActivityLevel = 'high'
    else if (totalLeading >= 20) leadingActivityLevel = 'medium'
    else if (totalLeading >= 5) leadingActivityLevel = 'low'
    
    // Calculate 30-day risk forecast
    const forecastMetrics = {
      bbsTrend: trends.atRiskBehaviors,
      sifTrend: trends.sifRate,
      avgDaysOpen: aging.avgDaysOpen,
      daysSinceLastSubmission: daysSinceLastSubmission || 0,
      recentIncidents: incidentsData.filter(i => {
        const d = new Date(i.incident_date || i.created_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        return d >= thirtyDaysAgo
      }).length,
      leadingActivityLevel
    }
    
    const riskForecast30Day = calculate30DayRiskForecast(forecastMetrics)
    
    // Engagement metrics
    const employeeCount = getEmployeeCount(company)
    const participationRate = employeeCount && activeSubmitterCount > 0 
      ? Math.round((activeSubmitterCount / employeeCount) * 100) 
      : null
    
    const engagementMetrics = {
      uniqueSubmitters: activeSubmitterCount,
      employeeCount: employeeCount,
      participationRate: participationRate,
      daysSinceLastSubmission: daysSinceLastSubmission,
      submissionsLast7Days: allDataArrays.reduce((count, arr) => {
        return count + arr.filter(item => {
          const d = new Date(item.created_at || item.date || item.incident_date || item.observation_date)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return d >= sevenDaysAgo
        }).length
      }, 0),
      submissionsLast30Days: allDataArrays.reduce((count, arr) => {
        return count + arr.filter(item => {
          const d = new Date(item.created_at || item.date || item.incident_date || item.observation_date)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          return d >= thirtyDaysAgo
        }).length
      }, 0),
      engagementStatus: daysSinceLastSubmission === null ? 'no-data' :
                        daysSinceLastSubmission > 14 ? 'critical' :
                        daysSinceLastSubmission > 7 ? 'warning' :
                        daysSinceLastSubmission > 3 ? 'moderate' : 'active'
    }

    // ========================================================================
    // RETURN COMPLETE DASHBOARD DATA
    // ========================================================================
    const loadTime = Date.now() - startTime

    return {
      safetyCultureIndex,
      predictiveRiskScore,
      riskForecast30Day,
      bbsMetrics,
      nearMissMetrics,
      sifMetrics,
      energySourceMetrics,
      leadingIndicators,
      laggingIndicators,
      aging,
      trueCostSummary,
      openItems: openItems.slice(0, 20),
      areasNeedingFocus,
      totalLeadingIndicators: totalLeading,
      totalLaggingIndicators: totalLagging,
      leadLagRatio: totalLagging > 0 ? Math.round(totalLeading / totalLagging * 10) / 10 : totalLeading,
      totalInspections,
      inspectionCounts,
      lsrAuditCounts: {
        confinedSpace: lsrConfinedData.length,
        driving: lsrDrivingData.length,
        energyIsolation: lsrEnergyData.length,
        fallProtection: lsrFallData.length,
        liftingOperations: lsrLiftingData.length,
        lineOfFire: lsrLineOfFireData.length,
        workPermits: lsrWorkPermitsData.length,
        total: allLsrAudits.length
      },
      // NEW: Trend indicators
      trends,
      // NEW: Engagement metrics
      engagementMetrics,
      timestamp: new Date().toISOString(),
      loadTimeMs: loadTime,
      fromCache: false,
      cacheAge: 0,
      filters: { company, location, year }
    }

  } catch (error) {
    console.error('Error in getDashboardData:', error)
    return {
      safetyCultureIndex: 0,
      predictiveRiskScore: 100,
      bbsMetrics: { total: 0, safe: 0, atRisk: 0, jobStops: 0, safeRatio: 0, jobStopRate: 0 },
      nearMissMetrics: { totalReported: 0, nearMisses: 0, goodCatches: 0 },
      sifMetrics: { sifPotentialCount: 0, totalEvents: 0, sifPotentialRate: 0, directControlStatus: { effective: 0, failed: 0, alternativeOnly: 0, none: 0 } },
      energySourceMetrics: { totalObservations: 0, byEnergyType: {}, controlHierarchy: { tier1: 0, tier2: 0, tier3: 0 }, controlHierarchyScore: 0 },
      leadingIndicators: { hseContacts: 0, thas: 0, safetyMeetings: 0, toolboxMeetings: 0, stopTake5: 0, riskConversations: 0, mbwa: 0 },
      laggingIndicators: { openIncidents: 0, closedIncidents: 0, firstAid: 0, recordable: 0, lostTime: 0, propertyDamage: 0, sailOpen: 0, sailCritical: 0, sailOverdue: 0 },
      aging: { avgDaysOpen: 0, over30Days: 0, over60Days: 0, over90Days: 0 },
      trueCostSummary: { hasData: false, totalCosts: 0, incidentsCosted: 0 },
      openItems: [],
      areasNeedingFocus: [],
      timestamp: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0,
      error: error.message
    }
  }
}

// ============================================================================
// OPTIONAL: CACHE THE RESULTS
// ============================================================================

export async function cacheDashboardData(company = 'All', location = 'All', year = 'All') {
  const filterKey = `${company}_${location}_${year}`
  const data = await getDashboardData(company, location, year)
  
  const { error } = await supabase
    .from('dashboard_cache')
    .upsert({
      filter_key: filterKey,
      company,
      location,
      year,
      data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'filter_key' })
  
  if (error) {
    console.error('Error caching dashboard data:', error)
  }
  
  return data
}

// ============================================================================
// GET CACHED OR LIVE DATA
// ============================================================================

export async function getDashboardDataWithCache(company = 'All', location = 'All', year = 'All', maxCacheAge = 30) {
  const filterKey = `${company}_${location}_${year}`
  
  const { data: cached } = await supabase
    .from('dashboard_cache')
    .select('data, updated_at')
    .eq('filter_key', filterKey)
    .single()
  
  if (cached) {
    const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 60000)
    if (cacheAge <= maxCacheAge) {
      const result = cached.data
      result.fromCache = true
      result.cacheAge = cacheAge
      return result
    }
  }
  
  return await cacheDashboardData(company, location, year)
}
