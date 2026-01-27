import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iypezirwdlqpptjpeeyf.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cGV6aXJ3ZGxxcHB0anBlZXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Nzg3NzYsImV4cCI6MjA4NDI1NDc3Nn0.rfTN8fi9rd6o5rX-scAg9I1BbC-UjM8WoWEXDbrYJD4'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildFilters(query, company, location, year, dateField = 'created_at') {
  if (company !== 'All') {
    // Try common company field names
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
    
    // Apply company filter in JavaScript (handles both company and company_name fields)
    if (filters.company && filters.company !== 'All') {
      results = results.filter(row => 
        row.company === filters.company || 
        row.company_name === filters.company
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
    const bbsSafe = bbsData.filter(b => 
      b.observation_type === 'Safe' || 
      b.safe_behavior === true || 
      b.behavior_type === 'Safe'
    ).length
    
    const bbsAtRisk = bbsData.filter(b => 
      b.observation_type === 'At-Risk' || 
      b.at_risk_behavior === true || 
      b.behavior_type === 'At-Risk'
    ).length
    
    const bbsJobStops = bbsData.filter(b => 
      b.job_stop === true || 
      b.job_stopped === true || 
      b.work_stopped === true
    ).length
    
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
    // SIF potential can come from multiple sources
    // Handle text fields like "Yes", "PSIF-High", "PSIF-Elevated", etc.
    const sifFromGoodCatch = goodCatchData.filter(g => 
      g.stky_event === 'Yes' || 
      g.stky_event === true ||
      g.sif_potential === 'Yes' ||
      g.sif_potential === true ||
      g.psif_classification?.includes('PSIF') ||
      g.psif_classification?.includes('SIF')
    ).length
    
    const sifFromIncidents = incidentsData.filter(i => 
      i.is_sif === true || 
      i.is_sif === 'Yes' ||
      i.is_sif_p === true || 
      i.is_sif_p === 'Yes' ||
      i.psif_classification?.includes('SIF') || 
      i.psif_classification?.includes('PSIF')
    ).length
    
    const sifFromHazardId = hazardIdData.filter(h => 
      h.sif_potential === true || 
      h.sif_potential === 'Yes' ||
      h.threat_level === 'High'
    ).length
    
    const sifFromBBS = bbsData.filter(b => 
      b.sif_potential === true ||
      b.sif_potential === 'Yes'
    ).length
    
    const totalSifEvents = sifFromGoodCatch + sifFromIncidents + sifFromHazardId + sifFromBBS
    const totalEventsForSif = goodCatchData.length + incidentsData.length + hazardIdData.length
    const sifPotentialRate = totalEventsForSif > 0 ? Math.round((totalSifEvents / totalEventsForSif) * 100) : 0

    // Direct control status from good_catch_near_miss and incidents
    // Handle text values like "Yes", "No-None", "No-Alternative"
    const allEventsWithControls = [...goodCatchData, ...incidentsData]
    const directControlEffective = allEventsWithControls.filter(i => 
      i.direct_control_present === 'Yes' || 
      i.direct_control_status === 'Effective'
    ).length
    const directControlFailed = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-Failed' ||
      i.direct_control_status === 'Failed'
    ).length
    const directControlAltOnly = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-Alternative' ||
      i.direct_control_status === 'Alternative Only'
    ).length
    const directControlNone = allEventsWithControls.filter(i => 
      i.direct_control_present === 'No-None' ||
      i.direct_control_status === 'None' ||
      (!i.direct_control_present && !i.direct_control_status)
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

    // Helper function to parse energy types from various formats
    const parseEnergyTypes = (energyField) => {
      if (!energyField) return []
      if (Array.isArray(energyField)) return energyField
      if (typeof energyField === 'string') {
        // Handle comma-separated text like "Gravity, Motion"
        return energyField.split(',').map(e => e.trim())
      }
      return []
    }

    // Count energy types from Good Catch / Near Miss
    goodCatchData.forEach(gc => {
      const types = parseEnergyTypes(gc.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    // Count energy types from THA/JSA
    thaData.forEach(tha => {
      const types = parseEnergyTypes(tha.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
      // Also check individual boolean fields
      energyTypes.forEach(type => {
        if (tha[`energy_${type.toLowerCase()}`] === true || tha[`energy_${type.toLowerCase()}`] === 'Yes') {
          byEnergyType[type]++
        }
      })
    })

    // Count from STOP Take 5
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

    // Count from Risk Control Conversations
    riskConversationData.forEach(rc => {
      const types = parseEnergyTypes(rc.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    // Count from Hazard IDs
    hazardIdData.forEach(hz => {
      const types = parseEnergyTypes(hz.energy_types)
      types.forEach(e => {
        const normalized = energyTypes.find(t => e?.toLowerCase().includes(t.toLowerCase()))
        if (normalized) byEnergyType[normalized]++
      })
    })

    const totalEnergyObservations = Object.values(byEnergyType).reduce((a, b) => a + b, 0)

    // Control hierarchy from THA
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
      // Check hierarchy_control field
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
    
    // Add open incidents
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

    // Add open SAIL items
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

    // Add open corrective actions
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

    // Sort by days open descending
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

    // Find issues (non-compliant items)
    const issuesByCategory = {}
    allLsrAudits.forEach(audit => {
      // Look for any field that indicates non-compliance
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
    // Factors: Safe/At-Risk ratio, Job Stop Rate, Near Miss reporting, Leading vs Lagging, Control Quality
    let sciScore = 50 // Base score

    // Safe/At-Risk Ratio component (0-25 points)
    if (safeRatio >= 5) sciScore += 25
    else if (safeRatio >= 3) sciScore += 20
    else if (safeRatio >= 2) sciScore += 15
    else if (safeRatio >= 1) sciScore += 10
    else sciScore += 5

    // Job Stop Rate component (0-25 points)
    if (jobStopRate >= 60) sciScore += 25
    else if (jobStopRate >= 40) sciScore += 20
    else if (jobStopRate >= 25) sciScore += 15
    else if (jobStopRate >= 10) sciScore += 10
    else sciScore += 5

    // Near Miss / Good Catch reporting (0-15 points) - more is better
    if (nearMissMetrics.totalReported >= 20) sciScore += 15
    else if (nearMissMetrics.totalReported >= 10) sciScore += 12
    else if (nearMissMetrics.totalReported >= 5) sciScore += 8
    else if (nearMissMetrics.totalReported >= 1) sciScore += 5

    // Leading vs Lagging ratio (0-10 points)
    const leadLagRatio = totalLagging > 0 ? totalLeading / totalLagging : totalLeading
    if (leadLagRatio >= 10) sciScore += 10
    else if (leadLagRatio >= 5) sciScore += 7
    else if (leadLagRatio >= 2) sciScore += 4

    // Control Quality component (already 0-100, scale to 0-10)
    sciScore += Math.round(controlHierarchyScore / 10) - 5

    // Cap at 100
    const safetyCultureIndex = Math.min(100, Math.max(0, sciScore))

    // PREDICTIVE RISK SCORE (0-100) - Lower is better
    let riskScore = 0

    // Open items factor (0-30 points)
    const totalOpenItems = openIncidents + sailOpen
    if (totalOpenItems >= 20) riskScore += 30
    else if (totalOpenItems >= 10) riskScore += 25
    else if (totalOpenItems >= 5) riskScore += 15
    else if (totalOpenItems >= 1) riskScore += 5

    // Overdue items factor (0-25 points)
    if (sailOverdue >= 10) riskScore += 25
    else if (sailOverdue >= 5) riskScore += 20
    else if (sailOverdue >= 2) riskScore += 10
    else if (sailOverdue >= 1) riskScore += 5

    // SIF Potential factor (0-25 points)
    if (sifPotentialRate >= 30) riskScore += 25
    else if (sifPotentialRate >= 20) riskScore += 20
    else if (sifPotentialRate >= 10) riskScore += 10
    else if (sifPotentialRate >= 5) riskScore += 5

    // At-risk behavior factor (0-20 points)
    const atRiskRate = bbsData.length > 0 ? (bbsAtRisk / bbsData.length) * 100 : 0
    if (atRiskRate >= 50) riskScore += 20
    else if (atRiskRate >= 30) riskScore += 15
    else if (atRiskRate >= 15) riskScore += 8
    else if (atRiskRate >= 5) riskScore += 3

    // Cap at 100
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
    // RETURN COMPLETE DASHBOARD DATA
    // ========================================================================
    const loadTime = Date.now() - startTime

    return {
      // Composite Scores
      safetyCultureIndex,
      predictiveRiskScore,
      
      // Detailed Metrics
      bbsMetrics,
      nearMissMetrics,
      sifMetrics,
      energySourceMetrics,
      leadingIndicators,
      laggingIndicators,
      aging,
      trueCostSummary,
      
      // Tables
      openItems: openItems.slice(0, 20), // Top 20 oldest
      areasNeedingFocus,
      
      // Summary counts
      totalLeadingIndicators: totalLeading,
      totalLaggingIndicators: totalLagging,
      leadLagRatio: totalLagging > 0 ? Math.round(totalLeading / totalLagging * 10) / 10 : totalLeading,
      totalInspections,
      inspectionCounts,
      
      // LSR Audit counts
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
      
      // Metadata
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
  
  // Upsert to cache table
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
  
  // Try to get cached data first
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
  
  // Cache miss or stale - fetch fresh data
  return await cacheDashboardData(company, location, year)
}
