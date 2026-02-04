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
  'Yellowjacket': 25,
  'A-C Electric': 15,
  'ASRC Energy Services': 50,
  'CCI-Industrial': 20,
  'CINGSA': 30,
  'Coho Enterprises': 15,
  'Conam Construction': 40,
  'ConocoPhillips': 500,
  'Five Star Oilfield Services': 25,
  'Fox Energy Services': 20,
  'G.A. West': 15,
  'GLM Energy Services': 20,
  'Graham Industrial Coatings': 15,
  'Harvest Midstream': 30,
  'Hilcorp Alaska': 400,
  'Merkes Builders': 20,
  'Nordic-Calista': 100,
  'Parker TRS': 25,
  'Peninsula Paving': 30,
  'Ridgeline Oilfield Services': 20,
  'Santos': 50,
  'Summit Excavation': 25,
  'Apache Corp.': 100,
  'Armstrong Oil & Gas': 50,
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
    currentEnd = now
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    previousEnd = new Date(currentStart.getTime() - 1)
    previousStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else {
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
  let forecastRisk = 30
  
  if (metrics.bbsTrend?.direction === 'up' && metrics.bbsTrend?.percent > 20) forecastRisk += 15
  else if (metrics.bbsTrend?.direction === 'up') forecastRisk += 8
  else if (metrics.bbsTrend?.direction === 'down') forecastRisk -= 5
  
  if (metrics.sifTrend?.direction === 'up') forecastRisk += 12
  else if (metrics.sifTrend?.direction === 'down') forecastRisk -= 5
  
  if (metrics.avgDaysOpen > 60) forecastRisk += 15
  else if (metrics.avgDaysOpen > 30) forecastRisk += 8
  
  if (metrics.daysSinceLastSubmission > 14) forecastRisk += 20
  else if (metrics.daysSinceLastSubmission > 7) forecastRisk += 10
  else if (metrics.daysSinceLastSubmission > 3) forecastRisk += 5
  
  if (metrics.recentIncidents >= 3) forecastRisk += 20
  else if (metrics.recentIncidents >= 1) forecastRisk += 10
  
  if (metrics.leadingActivityLevel === 'high') forecastRisk -= 15
  else if (metrics.leadingActivityLevel === 'medium') forecastRisk -= 8
  else if (metrics.leadingActivityLevel === 'low') forecastRisk += 10
  else if (metrics.leadingActivityLevel === 'none') forecastRisk += 25
  
  return Math.min(100, Math.max(0, Math.round(forecastRisk)))
}

// ============================================================================
// NEW: COMPREHENSIVE AREAS NEEDING FOCUS CALCULATOR
// ============================================================================
// This function aggregates focus areas from ALL data sources, not just LSR Audits

function calculateAreasNeedingFocus({
  // LSR Audits
  lsrConfinedData,
  lsrDrivingData,
  lsrEnergyData,
  lsrFallData,
  lsrLiftingData,
  lsrLineOfFireData,
  lsrWorkPermitsData,
  lsrHotWorkData,
  lsrWorkingAtHeightsData,
  // BBS & Behavior
  bbsData,
  goodCatchData,
  hazardIdData,
  // Incidents & SAIL
  incidentsData,
  sailLogData,
  propertyDamageData,
  // Inspections
  fireExtData,
  eyewashData,
  firstAidData,
  aedData,
  ladderData,
  harnessData,
  lanyardData,
  vehicleData,
  forkliftInspData,
  craneInspData,
  heavyEquipData,
  scaffoldData,
  // Corrective Actions
  correctiveActionsData,
}) {
  const focusAreas = []
  const isSifPositive = (val) => val === 'Yes' || val === true

  // ========================================================================
  // 1. LSR AUDIT ISSUES (enhanced to detect "Needs Improvement" and "No")
  // ========================================================================
  const allLsrAudits = [
    ...(lsrConfinedData || []).map(a => ({ ...a, category: 'LSR: Confined Space', source: 'lsr' })),
    ...(lsrDrivingData || []).map(a => ({ ...a, category: 'LSR: Driving', source: 'lsr' })),
    ...(lsrEnergyData || []).map(a => ({ ...a, category: 'LSR: Energy Isolation', source: 'lsr' })),
    ...(lsrFallData || []).map(a => ({ ...a, category: 'LSR: Fall Protection', source: 'lsr' })),
    ...(lsrLiftingData || []).map(a => ({ ...a, category: 'LSR: Lifting Operations', source: 'lsr' })),
    ...(lsrLineOfFireData || []).map(a => ({ ...a, category: 'LSR: Line of Fire', source: 'lsr' })),
    ...(lsrWorkPermitsData || []).map(a => ({ ...a, category: 'LSR: Work Permits', source: 'lsr' })),
    ...(lsrHotWorkData || []).map(a => ({ ...a, category: 'LSR: Hot Work', source: 'lsr' })),
    ...(lsrWorkingAtHeightsData || []).map(a => ({ ...a, category: 'LSR: Working at Heights', source: 'lsr' })),
  ]

  // Fields to skip when scanning for issues (metadata fields)
  const skipFields = [
    'id', 'created_at', 'auditor_name', 'date', 'company', 'client_company', 
    'company_name', 'location', 'location_name', 'photo_url', 'category', 
    'source', 'opportunities_improvement', 'comments', 'findings', 'notes'
  ]

  // Helper to convert field names to readable labels
  const fieldToLabel = (field) => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Loto', 'LOTO')
      .replace('Ppe', 'PPE')
      .replace('Simops', 'SIMOPS')
      .replace('Idd', "ID'd")
  }

  const lsrIssuesByField = {}
  
  allLsrAudits.forEach(audit => {
    // Scan ALL fields in the audit for "Needs Improvement" or "No" values
    Object.entries(audit).forEach(([field, value]) => {
      // Skip metadata fields
      if (skipFields.includes(field.toLowerCase())) return
      if (field === 'category' || field === 'source') return
      
      // Check if this field indicates an issue
      const isIssue = 
        value === 'Needs Improvement' ||
        value === 'No' ||
        value === false ||
        (typeof value === 'string' && value.toLowerCase() === 'needs improvement') ||
        (typeof value === 'string' && value.toLowerCase() === 'no')
      
      if (isIssue) {
        const key = `${audit.category}|${field}`
        if (!lsrIssuesByField[key]) {
          lsrIssuesByField[key] = { 
            category: audit.category,
            field: field,
            fieldLabel: fieldToLabel(field),
            count: 0, 
            locations: {},
            companies: {},
            improvements: []
          }
        }
        lsrIssuesByField[key].count++
        
        const loc = audit.location || audit.location_name || 'Unknown'
        lsrIssuesByField[key].locations[loc] = (lsrIssuesByField[key].locations[loc] || 0) + 1
        
        const comp = audit.company || audit.client_company || audit.company_name || 'Unknown'
        lsrIssuesByField[key].companies[comp] = (lsrIssuesByField[key].companies[comp] || 0) + 1
        
        // Capture improvement comments if present
        const improvementComment = audit.opportunities_improvement || audit.comments || audit.findings
        if (improvementComment && typeof improvementComment === 'string' && improvementComment.length > 5) {
          if (!lsrIssuesByField[key].improvements.includes(improvementComment)) {
            lsrIssuesByField[key].improvements.push(improvementComment)
          }
        }
      }
    })
  })

  // Convert to focus areas
  Object.entries(lsrIssuesByField).forEach(([key, data]) => {
    focusAreas.push({
      source: 'LSR Audit',
      category: `${data.category.replace('LSR: ', '')}`,
      issue: `${data.fieldLabel}: ${data.count} non-compliant`,
      detail: data.improvements[0] || null,
      count: data.count,
      severity: data.count >= 3 ? 'high' : data.count >= 2 ? 'medium' : 'low',
      topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      topCompany: Object.entries(data.companies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      priority: data.count * 12 // Higher priority for LSR issues
    })
  })

  // ========================================================================
  // 2. BBS AT-RISK BEHAVIOR PATTERNS
  // ========================================================================
  const atRiskObs = (bbsData || []).filter(b => b.observation_type === 'At-Risk')
  
  // Group by behavior category
  const atRiskByCategory = {}
  atRiskObs.forEach(obs => {
    const category = obs.behavior_category || obs.observation_category || obs.category || 'Uncategorized'
    if (!atRiskByCategory[category]) {
      atRiskByCategory[category] = { count: 0, sifCount: 0, locations: {}, jobStops: 0 }
    }
    atRiskByCategory[category].count++
    if (isSifPositive(obs.stky_event) || isSifPositive(obs.sif_potential)) {
      atRiskByCategory[category].sifCount++
    }
    if (obs.job_stop_required === true || obs.job_stop === true) {
      atRiskByCategory[category].jobStops++
    }
    const loc = obs.location || obs.location_name || 'Unknown'
    atRiskByCategory[category].locations[loc] = (atRiskByCategory[category].locations[loc] || 0) + 1
  })

  Object.entries(atRiskByCategory).forEach(([category, data]) => {
    if (data.count >= 2) { // Only flag if pattern exists (2+ occurrences)
      const sifPercent = data.count > 0 ? Math.round((data.sifCount / data.count) * 100) : 0
      focusAreas.push({
        source: 'BBS Observation',
        category: `At-Risk: ${category}`,
        issue: data.sifCount > 0 
          ? `${data.count} at-risk behaviors (${sifPercent}% SIF potential)` 
          : `${data.count} at-risk behaviors observed`,
        count: data.count,
        severity: data.sifCount > 0 ? 'high' : data.count >= 5 ? 'medium' : 'low',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: (data.sifCount * 25) + (data.count * 5) + (data.jobStops * 10)
      })
    }
  })

  // ========================================================================
  // 3. NEAR MISS / GOOD CATCH - HIGH SEVERITY EVENTS
  // ========================================================================
  const highSeverityNearMiss = (goodCatchData || []).filter(g => 
    isSifPositive(g.stky_event) ||
    isSifPositive(g.sif_potential) ||
    g.psif_classification?.includes('PSIF') ||
    g.psif_classification?.includes('SIF') ||
    g.severity === 'High' ||
    g.potential_severity === 'High'
  )

  // Group by event type or hazard category
  const nearMissByType = {}
  highSeverityNearMiss.forEach(nm => {
    const type = nm.hazard_type || nm.event_category || nm.category || 'Unclassified'
    if (!nearMissByType[type]) {
      nearMissByType[type] = { count: 0, locations: {} }
    }
    nearMissByType[type].count++
    const loc = nm.location || nm.location_name || 'Unknown'
    nearMissByType[type].locations[loc] = (nearMissByType[type].locations[loc] || 0) + 1
  })

  Object.entries(nearMissByType).forEach(([type, data]) => {
    if (data.count >= 1) { // Any high-severity near miss is noteworthy
      focusAreas.push({
        source: 'Near Miss/Good Catch',
        category: `High-SIF: ${type}`,
        issue: `${data.count} high-severity near miss event(s)`,
        count: data.count,
        severity: 'high',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: data.count * 30 // High priority for SIF potential events
      })
    }
  })

  // ========================================================================
  // 4. INCIDENT PATTERNS
  // ========================================================================
  const openIncidents = (incidentsData || []).filter(i => !['Closed', 'Approved'].includes(i.status))
  
  // Group open incidents by type
  const incidentsByType = {}
  openIncidents.forEach(inc => {
    const type = inc.incident_type || inc.classification || inc.category || 'Unclassified'
    if (!incidentsByType[type]) {
      incidentsByType[type] = { count: 0, locations: {}, avgDaysOpen: 0, totalDays: 0 }
    }
    incidentsByType[type].count++
    const created = new Date(inc.incident_date || inc.created_at)
    const daysOpen = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24))
    incidentsByType[type].totalDays += daysOpen
    const loc = inc.location_name || inc.location || 'Unknown'
    incidentsByType[type].locations[loc] = (incidentsByType[type].locations[loc] || 0) + 1
  })

  Object.entries(incidentsByType).forEach(([type, data]) => {
    const avgDays = Math.round(data.totalDays / data.count)
    if (data.count >= 1) {
      focusAreas.push({
        source: 'Incident',
        category: `Open Incident: ${type}`,
        issue: `${data.count} open incident(s), avg ${avgDays} days`,
        count: data.count,
        severity: avgDays > 30 ? 'high' : avgDays > 14 ? 'medium' : 'low',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: (data.count * 15) + (avgDays > 30 ? 20 : avgDays > 14 ? 10 : 0)
      })
    }
  })

  // ========================================================================
  // 5. SAIL LOG - OVERDUE & CRITICAL ITEMS
  // ========================================================================
  const today = new Date()
  const overdueSail = (sailLogData || []).filter(s => {
    if (!s.target_date || ['Closed', 'Complete'].includes(s.status)) return false
    return new Date(s.target_date) < today
  })

  const criticalSail = (sailLogData || []).filter(s => 
    (s.priority === 'A' || s.priority === 'Critical' || s.priority === 'High') &&
    !['Closed', 'Complete'].includes(s.status)
  )

  // Group overdue by category
  const overdueByCategory = {}
  overdueSail.forEach(sail => {
    const category = sail.category || sail.finding_type || 'General'
    if (!overdueByCategory[category]) {
      overdueByCategory[category] = { count: 0, locations: {}, maxDaysOverdue: 0 }
    }
    overdueByCategory[category].count++
    const daysOverdue = Math.floor((today - new Date(sail.target_date)) / (1000 * 60 * 60 * 24))
    if (daysOverdue > overdueByCategory[category].maxDaysOverdue) {
      overdueByCategory[category].maxDaysOverdue = daysOverdue
    }
    const loc = sail.location || sail.location_name || 'Unknown'
    overdueByCategory[category].locations[loc] = (overdueByCategory[category].locations[loc] || 0) + 1
  })

  Object.entries(overdueByCategory).forEach(([category, data]) => {
    focusAreas.push({
      source: 'SAIL Log',
      category: `Overdue: ${category}`,
      issue: `${data.count} overdue item(s), up to ${data.maxDaysOverdue} days past due`,
      count: data.count,
      severity: data.maxDaysOverdue > 30 ? 'high' : data.maxDaysOverdue > 14 ? 'medium' : 'low',
      topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      priority: (data.count * 12) + (data.maxDaysOverdue > 30 ? 25 : data.maxDaysOverdue > 14 ? 15 : 5)
    })
  })

  // Critical priority items
  if (criticalSail.length > 0) {
    const criticalLocations = {}
    criticalSail.forEach(s => {
      const loc = s.location || s.location_name || 'Unknown'
      criticalLocations[loc] = (criticalLocations[loc] || 0) + 1
    })
    
    focusAreas.push({
      source: 'SAIL Log',
      category: 'Critical Priority Items',
      issue: `${criticalSail.length} critical/high priority open item(s)`,
      count: criticalSail.length,
      severity: 'high',
      topLocation: Object.entries(criticalLocations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      priority: criticalSail.length * 35
    })
  }

  // ========================================================================
  // 6. HAZARD ID - UNRESOLVED HIGH-THREAT HAZARDS
  // ========================================================================
  const highThreatHazards = (hazardIdData || []).filter(h => 
    h.threat_level === 'High' || 
    h.risk_level === 'High' ||
    isSifPositive(h.sif_potential) ||
    h.status === 'Open'
  )

  const hazardsByType = {}
  highThreatHazards.forEach(hz => {
    const type = hz.hazard_type || hz.category || 'Unclassified'
    if (!hazardsByType[type]) {
      hazardsByType[type] = { count: 0, locations: {} }
    }
    hazardsByType[type].count++
    const loc = hz.location || hz.location_name || 'Unknown'
    hazardsByType[type].locations[loc] = (hazardsByType[type].locations[loc] || 0) + 1
  })

  Object.entries(hazardsByType).forEach(([type, data]) => {
    if (data.count >= 2) {
      focusAreas.push({
        source: 'Hazard ID',
        category: `High-Risk Hazard: ${type}`,
        issue: `${data.count} high-threat hazard(s) identified`,
        count: data.count,
        severity: 'medium',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: data.count * 12
      })
    }
  })

  // ========================================================================
  // 7. INSPECTION FAILURES (enhanced to check actual column names)
  // ========================================================================
  const inspectionTypes = [
    { data: fireExtData, name: 'Fire Extinguisher' },
    { data: eyewashData, name: 'Eyewash Station' },
    { data: firstAidData, name: 'First Aid Kit' },
    { data: aedData, name: 'AED' },
    { data: ladderData, name: 'Ladder' },
    { data: harnessData, name: 'Harness' },
    { data: lanyardData, name: 'Lanyard/SRL' },
    { data: vehicleData, name: 'Vehicle' },
    { data: forkliftInspData, name: 'Forklift' },
    { data: craneInspData, name: 'Crane' },
    { data: heavyEquipData, name: 'Heavy Equipment' },
    { data: scaffoldData, name: 'Scaffold' },
  ]

  // Helper to check if an inspection failed
  const isInspectionFailure = (insp) => {
    // Check various possible fail indicators
    const failValues = ['Fail', 'Failed', 'No', 'Unsatisfactory', 'Not Acceptable', 'Needs Repair', 'Out of Service']
    
    // Check inspection_result field
    if (insp.inspection_result && failValues.some(v => 
      insp.inspection_result.toLowerCase().includes(v.toLowerCase())
    )) return true
    
    // Check overall_condition field
    if (insp.overall_condition && failValues.some(v => 
      insp.overall_condition.toLowerCase().includes(v.toLowerCase())
    )) return true
    
    // Check pass/satisfactory/compliant fields
    if (insp.pass === false || insp.pass === 'No' || insp.pass === 'Fail') return true
    if (insp.satisfactory === false || insp.satisfactory === 'No') return true
    if (insp.compliant === false || insp.compliant === 'No') return true
    
    // Check for deficiencies or action required
    if (insp.deficiencies_found === true || insp.deficiencies_found === 'Yes') return true
    if (insp.action_required === true || insp.action_required === 'Yes') return true
    if (insp.corrective_action_needed === true || insp.corrective_action_needed === 'Yes') return true
    
    return false
  }

  inspectionTypes.forEach(({ data, name }) => {
    if (!data) return
    
    const failures = data.filter(insp => isInspectionFailure(insp))

    if (failures.length >= 1) {
      const locations = {}
      const issues = []
      
      failures.forEach(f => {
        const loc = f.location || f.location_name || 'Unknown'
        locations[loc] = (locations[loc] || 0) + 1
        
        // Capture specific issues
        if (f.comments && typeof f.comments === 'string' && f.comments.length > 3) {
          issues.push(f.comments)
        }
        if (f.action_taken && typeof f.action_taken === 'string' && f.action_taken.length > 3) {
          issues.push(f.action_taken)
        }
      })

      focusAreas.push({
        source: 'Inspection',
        category: `Failed: ${name}`,
        issue: issues[0] || `${failures.length} failed inspection(s)`,
        count: failures.length,
        severity: failures.length >= 3 ? 'high' : failures.length >= 2 ? 'medium' : 'low',
        topLocation: Object.entries(locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: failures.length * 8
      })
    }
  })

  // ========================================================================
  // 8. CORRECTIVE ACTIONS - OVERDUE
  // ========================================================================
  const openCAs = (correctiveActionsData || []).filter(ca => 
    !['Completed', 'Verified', 'Closed'].includes(ca.action_status)
  )

  const overdueCAs = openCAs.filter(ca => {
    if (!ca.due_date && !ca.target_date) return false
    return new Date(ca.due_date || ca.target_date) < today
  })

  if (overdueCAs.length > 0) {
    const caLocations = {}
    let maxDaysOverdue = 0
    overdueCAs.forEach(ca => {
      const dueDate = new Date(ca.due_date || ca.target_date)
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
      if (daysOverdue > maxDaysOverdue) maxDaysOverdue = daysOverdue
      const loc = ca.location_name || ca.location || 'Unknown'
      caLocations[loc] = (caLocations[loc] || 0) + 1
    })

    focusAreas.push({
      source: 'Corrective Action',
      category: 'Overdue Actions',
      issue: `${overdueCAs.length} overdue corrective action(s), up to ${maxDaysOverdue} days`,
      count: overdueCAs.length,
      severity: maxDaysOverdue > 30 ? 'high' : maxDaysOverdue > 14 ? 'medium' : 'low',
      topLocation: Object.entries(caLocations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
      priority: (overdueCAs.length * 15) + (maxDaysOverdue > 30 ? 20 : 10)
    })
  }

  // ========================================================================
  // 9. PROPERTY DAMAGE PATTERNS
  // ========================================================================
  const propertyDamageByType = {}
  ;(propertyDamageData || []).forEach(pd => {
    const type = pd.damage_type || pd.category || pd.equipment_type || 'Unclassified'
    if (!propertyDamageByType[type]) {
      propertyDamageByType[type] = { count: 0, locations: {}, totalCost: 0 }
    }
    propertyDamageByType[type].count++
    propertyDamageByType[type].totalCost += parseFloat(pd.estimated_cost || pd.damage_cost || 0)
    const loc = pd.location || pd.location_name || 'Unknown'
    propertyDamageByType[type].locations[loc] = (propertyDamageByType[type].locations[loc] || 0) + 1
  })

  Object.entries(propertyDamageByType).forEach(([type, data]) => {
    if (data.count >= 2) {
      focusAreas.push({
        source: 'Property Damage',
        category: `Damage Pattern: ${type}`,
        issue: `${data.count} incidents${data.totalCost > 0 ? `, ~$${Math.round(data.totalCost).toLocaleString()} total` : ''}`,
        count: data.count,
        severity: data.totalCost > 10000 ? 'high' : data.count >= 3 ? 'medium' : 'low',
        topLocation: Object.entries(data.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        priority: (data.count * 10) + (data.totalCost > 10000 ? 20 : 0)
      })
    }
  })

  // ========================================================================
  // SORT BY PRIORITY AND RETURN TOP FOCUS AREAS
  // ========================================================================
  return focusAreas
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 25) // Return top 25 focus areas
    .map(({ priority, ...rest }) => rest) // Remove internal priority field
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
      lsrHotWorkData,
      lsrWorkingAtHeightsData,
      
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
      safeQuery('lsr_hot_work_audits', '*', filters),
      safeQuery('lsr_working_at_heights_audits', '*', filters),
      
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

    // Calculate by severity for the Near Miss panel
    const highSifP = goodCatchData.filter(g => 
      g.psif_classification === 'PSIF' || 
      g.severity === 'High' ||
      g.potential_severity === 'High' ||
      g.stky_event === 'Yes' ||
      g.stky_event === true
    ).length

    const mediumSifP = goodCatchData.filter(g => 
      g.psif_classification === 'Medium-PSIF' || 
      g.severity === 'Medium' ||
      g.potential_severity === 'Medium'
    ).length

    const lowSeverity = goodCatchData.length - highSifP - mediumSifP

    const nearMissMetrics = {
      totalReported: goodCatchData.length,
      nearMisses: nearMissCount,
      goodCatches: goodCatchCount,
      bySeverity: {
        high: highSifP,
        medium: mediumSifP,
        low: lowSeverity > 0 ? lowSeverity : 0
      }
    }

    // ========================================================================
    // CALCULATE SIF POTENTIAL METRICS
    // ========================================================================
    const isSifPositive = (val) => val === 'Yes' || val === true
    
    const sifFromGoodCatch = goodCatchData.filter(g => 
      isSifPositive(g.stky_event) ||
      isSifPositive(g.sif_potential) ||
      g.psif_classification?.includes('PSIF') ||
      g.psif_classification?.includes('SIF')
    ).length
    
    const sifFromIncidents = incidentsData.filter(i => 
      isSifPositive(i.is_sif) ||
      isSifPositive(i.is_sif_p) ||
      isSifPositive(i.stky_event) ||
      i.psif_classification?.includes('SIF') || 
      i.psif_classification?.includes('PSIF')
    ).length
    
    const sifFromHazardId = hazardIdData.filter(h => 
      isSifPositive(h.sif_potential) ||
      isSifPositive(h.stky_event) ||
      h.threat_level === 'High'
    ).length
    
    const atRiskBBS = bbsData.filter(b => b.observation_type === 'At-Risk')
    const sifFromBBS = atRiskBBS.filter(b => isSifPositive(b.stky_event)).length
    
    const sifFromPropertyDamage = propertyDamageData.filter(p =>
      isSifPositive(p.stky_event) ||
      isSifPositive(p.sif_potential) ||
      p.psif_classification?.includes('PSIF') ||
      p.psif_classification?.includes('SIF')
    ).length
    
    const totalSifEvents = sifFromGoodCatch + sifFromIncidents + sifFromBBS + sifFromPropertyDamage
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
    // CALCULATE COMPREHENSIVE AREAS NEEDING FOCUS (NEW!)
    // ========================================================================
    const areasNeedingFocus = calculateAreasNeedingFocus({
      // LSR Audits
      lsrConfinedData,
      lsrDrivingData,
      lsrEnergyData,
      lsrFallData,
      lsrLiftingData,
      lsrLineOfFireData,
      lsrWorkPermitsData,
      lsrHotWorkData,
      lsrWorkingAtHeightsData,
      // BBS & Behavior
      bbsData,
      goodCatchData,
      hazardIdData,
      // Incidents & SAIL
      incidentsData,
      sailLogData,
      propertyDamageData,
      // Inspections
      fireExtData,
      eyewashData,
      firstAidData,
      aedData,
      ladderData,
      harnessData,
      lanyardData,
      vehicleData,
      forkliftInspData,
      craneInspData,
      heavyEquipData,
      scaffoldData,
      // Corrective Actions
      correctiveActionsData,
    })

    // ========================================================================
    // CALCULATE LSR AUDIT COUNTS (for the existing panel)
    // ========================================================================
    const allLsrAudits = [
      ...lsrConfinedData,
      ...lsrDrivingData,
      ...lsrEnergyData,
      ...lsrFallData,
      ...lsrLiftingData,
      ...lsrLineOfFireData,
      ...lsrWorkPermitsData,
      ...(lsrHotWorkData || []),
      ...(lsrWorkingAtHeightsData || []),
    ]

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
    let sciScore = 70

    // POSITIVE FACTORS (can add up to +30)
    if (safeRatio >= 10) sciScore += 10
    else if (safeRatio >= 5) sciScore += 7
    else if (safeRatio >= 3) sciScore += 5
    else if (safeRatio >= 2) sciScore += 3
    else if (safeRatio >= 1) sciScore += 1

    if (jobStopRate >= 80) sciScore += 10
    else if (jobStopRate >= 60) sciScore += 8
    else if (jobStopRate >= 40) sciScore += 5
    else if (jobStopRate >= 20) sciScore += 2

    if (nearMissMetrics.totalReported >= 20) sciScore += 10
    else if (nearMissMetrics.totalReported >= 10) sciScore += 7
    else if (nearMissMetrics.totalReported >= 5) sciScore += 4
    else if (nearMissMetrics.totalReported >= 1) sciScore += 2

    // NEGATIVE FACTORS (can subtract up to -50)
    const totalIncidents = incidentsData.length
    if (totalIncidents >= 10) sciScore -= 20
    else if (totalIncidents >= 5) sciScore -= 15
    else if (totalIncidents >= 3) sciScore -= 10
    else if (totalIncidents >= 1) sciScore -= 5

    if (sifPotentialRate >= 50) sciScore -= 15
    else if (sifPotentialRate >= 30) sciScore -= 10
    else if (sifPotentialRate >= 20) sciScore -= 7
    else if (sifPotentialRate >= 10) sciScore -= 3

    const atRiskRate = bbsData.length > 0 ? (bbsAtRisk / bbsData.length) * 100 : 0
    if (atRiskRate >= 50) sciScore -= 15
    else if (atRiskRate >= 30) sciScore -= 10
    else if (atRiskRate >= 20) sciScore -= 5
    else if (atRiskRate >= 10) sciScore -= 2

    const totalOpenItems = openIncidents + sailOpen
    if (totalOpenItems >= 10) sciScore -= 10
    else if (totalOpenItems >= 5) sciScore -= 7
    else if (totalOpenItems >= 3) sciScore -= 4
    else if (totalOpenItems >= 1) sciScore -= 2

    if (sailOverdue >= 5) sciScore -= 10
    else if (sailOverdue >= 3) sciScore -= 7
    else if (sailOverdue >= 1) sciScore -= 3

    const safetyCultureIndex = Math.min(100, Math.max(0, sciScore))

    let riskScore = 0

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
    // TREND CALCULATIONS
    // ========================================================================
    const allDataArrays = [
      bbsData, goodCatchData, hazardIdData, thaData, safetyMeetingsData,
      toolboxMeetingsData, hseContactsData, incidentsData
    ]
    
    const daysSinceLastSubmission = getDaysSinceLastSubmission(allDataArrays)
    const uniqueSubmitters = getUniqueSubmitters(allDataArrays)
    const activeSubmitterCount = uniqueSubmitters.size
    
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
      
      const incFirstHalf = incidentsData.filter(i => new Date(i.incident_date || i.created_at) < midpoint).length
      const incSecondHalf = incidentsData.filter(i => new Date(i.incident_date || i.created_at) >= midpoint).length
      trends.incidents = calculateTrend(incSecondHalf, incFirstHalf)
      
      const leadingFirstHalf = [...thaData, ...safetyMeetingsData, ...toolboxMeetingsData, ...hseContactsData]
        .filter(l => new Date(l.created_at || l.date) < midpoint).length
      const leadingSecondHalf = [...thaData, ...safetyMeetingsData, ...toolboxMeetingsData, ...hseContactsData]
        .filter(l => new Date(l.created_at || l.date) >= midpoint).length
      trends.leadingActivities = calculateTrend(leadingSecondHalf, leadingFirstHalf)
    }
    
    let leadingActivityLevel = 'none'
    if (totalLeading >= 50) leadingActivityLevel = 'high'
    else if (totalLeading >= 20) leadingActivityLevel = 'medium'
    else if (totalLeading >= 5) leadingActivityLevel = 'low'
    
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
      areasNeedingFocus, // NOW COMPREHENSIVE!
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
        hotWork: (lsrHotWorkData || []).length,
        workingAtHeights: (lsrWorkingAtHeightsData || []).length,
        total: allLsrAudits.length
      },
      trends,
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
      nearMissMetrics: { totalReported: 0, nearMisses: 0, goodCatches: 0, bySeverity: { high: 0, medium: 0, low: 0 } },
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
