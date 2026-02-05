// Supabase Edge Function: send-weekly-reports
// Deploy to: supabase/functions/send-weekly-reports/index.ts
// 
// UPDATED: Now pulls YTD data and includes all dashboard metrics
// - Safety Culture Index, Predictive Risk Score, 30-Day Forecast
// - SIF Potential, Energy Sources, LSR Audits
// - Leading/Lagging Indicators with full breakdown
// - Areas Needing Focus, Open Items

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

// Employee census for participation rate
const EMPLOYEE_CENSUS: Record<string, number> = {
  'MagTec Alaska': 82,
  'Chosen Construction': 38,
  'AKE-Line': 41,
  'Pollard Wireline': 154,
  'GBR Equipment': 8,
  'Yellowjacket': 25,
  'A-C Electric': 15,
  'ASRC Energy Services': 50,
  'Hilcorp Alaska': 200,
  'ConocoPhillips': 500,
}

// Get last 7 days date range
function getLastWeekRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return {
    year: end.getFullYear().toString(),
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startFormatted: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    endFormatted: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

// Safe query helper with company filter variations
async function safeQuery(tableName: string, companyName: string, startDate: string, endDate: string, dateField = 'created_at') {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gte(dateField, startDate)
      .lte(dateField, endDate + 'T23:59:59')
    
    if (error) {
      console.warn(`Query error for ${tableName}:`, error.message)
      return []
    }
    
    // Filter by company (handling multiple column names)
    return (data || []).filter(row => 
      row.company === companyName || 
      row.company_name === companyName ||
      row.client_company === companyName ||
      row.client === companyName
    )
  } catch (e) {
    console.warn(`Exception querying ${tableName}:`, e)
    return []
  }
}

// Fetch ALL company data for last 7 days
async function getCompanyData(companyName: string, startDate: string, endDate: string) {
  // Parallel fetch all data sources
  const [
    incidents,
    sailLog,
    bbsObs,
    goodCatch,
    hazardIds,
    thas,
    safetyMeetings,
    toolboxMeetings,
    hseContacts,
    lsrLineOfFire,
    lsrLiftingOps,
    lsrWorkPermits,
    lsrFallProtection,
    lsrDriving,
    lsrConfinedSpace,
    lsrEnergyIsolation,
    propertyDamage
  ] = await Promise.all([
    safeQuery('incidents', companyName, startDate, endDate, 'incident_date'),
    safeQuery('sail_log', companyName, startDate, endDate, 'created_at'),
    safeQuery('bbs_observations', companyName, startDate, endDate, 'observation_date'),
    safeQuery('good_catch_near_miss', companyName, startDate, endDate, 'created_at'),
    safeQuery('hazard_id_reports', companyName, startDate, endDate, 'created_at'),
    safeQuery('tha_submissions', companyName, startDate, endDate, 'created_at'),
    safeQuery('safety_meetings', companyName, startDate, endDate, 'meeting_date'),
    safeQuery('toolbox_meetings', companyName, startDate, endDate, 'meeting_date'),
    safeQuery('hse_contacts', companyName, startDate, endDate, 'contact_date'),
    safeQuery('lsr_line_of_fire_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_lifting_operations_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_work_permits_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_fall_protection_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_driving_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_confined_space_audits', companyName, startDate, endDate, 'date'),
    safeQuery('lsr_energy_isolation_audits', companyName, startDate, endDate, 'date'),
    safeQuery('property_damage', companyName, startDate, endDate, 'created_at')
  ])

  // Get ALL open items (regardless of year)
  const { data: allSailOpen } = await supabase
    .from('sail_log')
    .select('*')
    .in('status', ['Open', 'In Progress', 'Pending'])
  
  const openSailItems = (allSailOpen || []).filter(row => 
    row.company === companyName || row.company_name === companyName || row.client_company === companyName
  )

  const { data: allIncidentsOpen } = await supabase
    .from('incidents')
    .select('*')
    .not('status', 'in', '("Closed","Approved")')
  
  const openIncidents = (allIncidentsOpen || []).filter(row => 
    row.company === companyName || row.company_name === companyName
  )

  // ========================================================================
  // CALCULATE METRICS
  // ========================================================================
  
  // BBS Metrics
  const safeObs = bbsObs.filter(b => b.observation_type === 'Safe').length
  const atRiskObs = bbsObs.filter(b => b.observation_type === 'At-Risk').length
  const jobStops = bbsObs.filter(b => b.job_stop === true || b.job_stop === 'Yes').length
  const safeRatio = atRiskObs > 0 ? Math.round((safeObs / atRiskObs) * 10) / 10 : safeObs
  const jobStopRate = bbsObs.length > 0 ? Math.round((jobStops / bbsObs.length) * 100) : 0

  // SIF Metrics (STKY events)
  const allEvents = [...bbsObs, ...goodCatch, ...hazardIds]
  const sifPotentialEvents = allEvents.filter(e => 
    e.stky_event === 'Yes' || e.sif_potential === 'Yes' || e.sif_potential === true
  )
  const sifPotentialRate = allEvents.length > 0 
    ? Math.round((sifPotentialEvents.length / allEvents.length) * 100) 
    : 0

  // Energy Source Analytics
  const energyTypes: Record<string, number> = {}
  let controlTier1 = 0, controlTier2 = 0, controlTier3 = 0
  
  allEvents.forEach(e => {
    const energy = e.energy_source || e.energy_type
    if (energy) {
      energyTypes[energy] = (energyTypes[energy] || 0) + 1
    }
    // Control hierarchy
    const control = e.direct_control || e.control_type || ''
    if (['Elimination', 'Substitution', 'Engineering'].some(c => control.includes(c))) controlTier1++
    else if (['Guard', 'LOTO', 'Barrier', 'Administrative'].some(c => control.includes(c))) controlTier2++
    else if (control.includes('PPE') || control) controlTier3++
  })
  
  const totalControls = controlTier1 + controlTier2 + controlTier3
  const controlHierarchyScore = totalControls > 0 
    ? Math.round(((controlTier1 * 100) + (controlTier2 * 60) + (controlTier3 * 30)) / totalControls)
    : 50

  // LSR Audit totals
  const allLsrAudits = [
    ...lsrLineOfFire, ...lsrLiftingOps, ...lsrWorkPermits, 
    ...lsrFallProtection, ...lsrDriving, ...lsrConfinedSpace, ...lsrEnergyIsolation
  ]
  
  // Check for LSR issues (Needs Improvement or No)
  const lsrIssues: any[] = []
  const skipFields = ['id', 'created_at', 'auditor_name', 'date', 'company', 'location', 'photo_url', 'opportunities_improvement']
  
  allLsrAudits.forEach(audit => {
    Object.entries(audit).forEach(([field, value]) => {
      if (skipFields.includes(field)) return
      if (value === 'Needs Improvement' || value === 'No') {
        lsrIssues.push({ field, value, audit })
      }
    })
  })

  // Leading Indicators
  const leadingIndicators = {
    bbsObservations: bbsObs.length,
    thas: thas.length,
    safetyMeetings: safetyMeetings.length,
    toolboxMeetings: toolboxMeetings.length,
    hseContacts: hseContacts.length,
    hazardIds: hazardIds.length,
    goodCatches: goodCatch.length,
    lsrAudits: allLsrAudits.length
  }
  const totalLeading = Object.values(leadingIndicators).reduce((a, b) => a + b, 0)

  // Lagging Indicators
  const laggingIndicators = {
    totalIncidents: incidents.length,
    openIncidents: openIncidents.length,
    closedIncidents: incidents.filter(i => i.status === 'Closed').length,
    openSail: openSailItems.length,
    propertyDamage: propertyDamage.length
  }
  const totalLagging = incidents.length + propertyDamage.length

  // Lead/Lag Ratio
  const leadLagRatio = totalLagging > 0 ? Math.round((totalLeading / totalLagging) * 10) / 10 : totalLeading

  // Near Miss breakdown
  const nearMissHigh = goodCatch.filter(g => g.sif_potential === 'Yes' || g.severity === 'High').length
  const nearMissMed = goodCatch.filter(g => g.severity === 'Medium').length
  const nearMissLow = goodCatch.length - nearMissHigh - nearMissMed

  // Engagement Metrics
  const uniqueSubmitters = new Set<string>()
  const allData = [...bbsObs, ...thas, ...safetyMeetings, ...hazardIds, ...goodCatch]
  allData.forEach(item => {
    const name = item.submitter_name || item.observer_name || item.employee_name || item.conducted_by
    if (name) uniqueSubmitters.add(name.toLowerCase().trim())
  })
  
  const employeeCount = EMPLOYEE_CENSUS[companyName] || null
  const participationRate = employeeCount ? Math.round((uniqueSubmitters.size / employeeCount) * 100) : null

  // Days since last submission
  let mostRecentDate: Date | null = null
  allData.forEach(item => {
    const dateStr = item.created_at || item.date || item.observation_date
    if (dateStr) {
      const d = new Date(dateStr)
      if (!mostRecentDate || d > mostRecentDate) mostRecentDate = d
    }
  })
  const daysSinceLastSubmission = mostRecentDate 
    ? Math.floor((Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999

  // ========================================================================
  // CALCULATE SCORES
  // ========================================================================

  // Safety Culture Index (0-100)
  let sciScore = 70
  if (safeRatio >= 10) sciScore += 10
  else if (safeRatio >= 5) sciScore += 7
  else if (safeRatio >= 3) sciScore += 5
  if (jobStopRate >= 50) sciScore += 10
  else if (jobStopRate >= 25) sciScore += 5
  if (goodCatch.length >= 10) sciScore += 10
  else if (goodCatch.length >= 5) sciScore += 5
  if (incidents.length >= 5) sciScore -= 15
  else if (incidents.length >= 1) sciScore -= 5
  if (sifPotentialRate >= 30) sciScore -= 10
  if (openSailItems.length >= 5) sciScore -= 10
  else if (openSailItems.length >= 1) sciScore -= 3
  sciScore = Math.min(100, Math.max(0, sciScore))

  // Predictive Risk Score (0-100, lower is better)
  let riskScore = 0
  if (openSailItems.length >= 10) riskScore += 25
  else if (openSailItems.length >= 5) riskScore += 15
  else if (openSailItems.length >= 1) riskScore += 5
  if (sifPotentialRate >= 30) riskScore += 20
  else if (sifPotentialRate >= 15) riskScore += 10
  if (atRiskObs > safeObs) riskScore += 15
  if (daysSinceLastSubmission > 14) riskScore += 20
  else if (daysSinceLastSubmission > 7) riskScore += 10
  if (incidents.length >= 3) riskScore += 20
  else if (incidents.length >= 1) riskScore += 10
  riskScore = Math.min(100, Math.max(0, riskScore))

  // 30-Day Risk Forecast
  let forecast = 30
  if (daysSinceLastSubmission > 7) forecast += 15
  if (openSailItems.length > 3) forecast += 10
  if (atRiskObs > safeObs * 0.5) forecast += 10
  if (totalLeading >= 50) forecast -= 15
  else if (totalLeading >= 20) forecast -= 8
  forecast = Math.min(100, Math.max(0, forecast))

  // Open Items with aging
  const today = new Date()
  const openItems = [
    ...openIncidents.map(i => ({
      form: 'Incident',
      location: i.location || i.location_name || 'N/A',
      status: i.status || 'Open',
      daysOpen: Math.floor((today.getTime() - new Date(i.incident_date || i.created_at).getTime()) / (1000 * 60 * 60 * 24))
    })),
    ...openSailItems.map(s => ({
      form: 'SAIL Log',
      location: s.location || s.location_name || 'N/A',
      status: s.status || 'Open',
      daysOpen: Math.floor((today.getTime() - new Date(s.date || s.created_at).getTime()) / (1000 * 60 * 60 * 24))
    }))
  ].sort((a, b) => b.daysOpen - a.daysOpen).slice(0, 5)

  // Areas Needing Focus
  const areasNeedingFocus: any[] = []
  
  // High-priority SAIL items
  const criticalSail = openSailItems.filter(s => s.priority === 'Critical' || s.priority === 'High')
  if (criticalSail.length > 0) {
    areasNeedingFocus.push({
      source: 'SAIL Log',
      category: 'Critical Priority Items',
      issue: `${criticalSail.length} critical/high priority open item(s)`,
      count: criticalSail.length,
      severity: 'high'
    })
  }
  
  // High-SIF near misses
  if (nearMissHigh > 0) {
    areasNeedingFocus.push({
      source: 'Near Miss/Good Catch',
      category: 'High-SIF Potential',
      issue: `${nearMissHigh} high-severity near miss event(s)`,
      count: nearMissHigh,
      severity: 'high'
    })
  }
  
  // LSR Issues
  if (lsrIssues.length > 0) {
    areasNeedingFocus.push({
      source: 'LSR Audit',
      category: 'Compliance Gaps',
      issue: `${lsrIssues.length} non-compliant finding(s)`,
      count: lsrIssues.length,
      severity: lsrIssues.length > 3 ? 'high' : 'medium'
    })
  }

  // High-risk hazards
  const highRiskHazards = hazardIds.filter(h => h.risk_level === 'High' || h.severity === 'High')
  if (highRiskHazards.length > 0) {
    areasNeedingFocus.push({
      source: 'Hazard ID',
      category: 'High-Risk Hazards',
      issue: `${highRiskHazards.length} high-risk hazard(s) identified`,
      count: highRiskHazards.length,
      severity: 'medium'
    })
  }

  return {
    // Raw data for tables
    incidents,
    openIncidents,
    openSailItems,
    hazardIds,
    bbsObs,
    goodCatch,
    
    // Calculated metrics
    metrics: {
      // BBS
      totalBBS: bbsObs.length,
      safeObs,
      atRiskObs,
      safeRatio,
      jobStops,
      jobStopRate,
      
      // SIF
      sifPotentialRate,
      sifPotentialCount: sifPotentialEvents.length,
      totalEvents: allEvents.length,
      
      // Energy & Controls
      energyTypes,
      totalEnergySources: Object.values(energyTypes).reduce((a, b) => a + b, 0),
      controlHierarchyScore,
      
      // Leading
      leadingIndicators,
      totalLeading,
      
      // Lagging
      laggingIndicators,
      totalLagging,
      
      // Ratios
      leadLagRatio,
      
      // Near Miss
      nearMissTotal: goodCatch.length,
      nearMissHigh,
      nearMissMed,
      nearMissLow,
      
      // LSR
      lsrAuditCounts: {
        total: allLsrAudits.length,
        lineOfFire: lsrLineOfFire.length,
        liftingOps: lsrLiftingOps.length,
        workPermits: lsrWorkPermits.length,
        fallProtection: lsrFallProtection.length,
        driving: lsrDriving.length,
        confinedSpace: lsrConfinedSpace.length,
        energyIsolation: lsrEnergyIsolation.length
      },
      lsrIssuesCount: lsrIssues.length,
      
      // Engagement
      uniqueSubmitters: uniqueSubmitters.size,
      employeeCount,
      participationRate,
      daysSinceLastSubmission,
      
      // Scores
      safetyCultureIndex: sciScore,
      predictiveRiskScore: riskScore,
      riskForecast30Day: forecast,
      
      // Open Items
      openItems,
      totalOpenItems: openIncidents.length + openSailItems.length,
      
      // Areas Needing Focus
      areasNeedingFocus
    }
  }
}

// Generate comprehensive HTML email
function generateEmailHTML(companyName: string, data: any, dateRange: any, companyToken: string) {
  const m = data.metrics
  
  const dashboardLink = companyToken 
    ? `https://slp-safety-dashboard.vercel.app/view/${companyToken}`
    : 'https://slp-safety-dashboard.vercel.app'

  // Color helpers
  const getScoreColor = (score: number, inverse = false) => {
    if (inverse) {
      return score <= 30 ? '#22c55e' : score <= 50 ? '#eab308' : '#ef4444'
    }
    return score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
  }
  
  const getRatioColor = (ratio: number) => ratio >= 5 ? '#22c55e' : ratio >= 2 ? '#eab308' : '#ef4444'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Safety Report - ${companyName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #e2e8f0; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%); padding: 24px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; color: white; }
    .header .company { font-size: 28px; font-weight: 700; color: #5eead4; margin: 8px 0; }
    .header .date-range { background: rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 20px; display: inline-block; font-size: 12px; color: white; }
    
    /* Score Cards Row */
    .score-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .score-card { flex: 1; min-width: 100px; background: #1e293b; border-radius: 10px; padding: 14px 10px; text-align: center; border-top: 3px solid #3b82f6; }
    .score-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .score-value { font-size: 26px; font-weight: 700; line-height: 1.1; }
    .score-detail { font-size: 9px; color: #64748b; margin-top: 4px; }
    
    /* Panels */
    .panel-row { display: flex; gap: 16px; margin-bottom: 16px; }
    .panel { flex: 1; background: #1e293b; border-radius: 10px; overflow: hidden; }
    .panel-header { padding: 10px 14px; font-size: 12px; font-weight: 600; color: white; display: flex; align-items: center; gap: 8px; }
    .panel-content { padding: 14px; }
    
    /* Metrics Grid */
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .metric { background: #0f172a; border-radius: 6px; padding: 10px; text-align: center; }
    .metric-value { font-size: 22px; font-weight: 700; }
    .metric-label { font-size: 8px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
    
    /* Progress Bars */
    .progress-bar { height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin: 4px 0; }
    .progress-fill { height: 100%; border-radius: 4px; }
    
    /* Tables */
    .table-section { background: #1e293b; border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
    .table-header { padding: 10px 14px; font-size: 12px; font-weight: 600; color: white; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0f172a; color: #94a3b8; padding: 8px 10px; text-align: left; font-weight: 500; text-transform: uppercase; font-size: 9px; }
    td { padding: 8px 10px; border-bottom: 1px solid #334155; }
    
    /* Status Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
    .badge-high { background: #7f1d1d; color: #fca5a5; }
    .badge-medium { background: #78350f; color: #fcd34d; }
    .badge-low { background: #1e3a5f; color: #93c5fd; }
    .badge-open { background: #7f1d1d; color: #fca5a5; }
    .badge-safe { background: #064e3b; color: #6ee7b7; }
    .badge-atrisk { background: #7f1d1d; color: #fca5a5; }
    
    /* Days indicator */
    .days { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .days-critical { background: #dc2626; color: white; }
    .days-warning { background: #f97316; color: white; }
    .days-ok { background: #22c55e; color: white; }
    
    /* Footer */
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #64748b; border-top: 1px solid #334155; margin-top: 20px; }
    .footer a { color: #5eead4; text-decoration: none; font-weight: 600; }
    
    /* Colors */
    .green { color: #22c55e; }
    .yellow { color: #eab308; }
    .red { color: #ef4444; }
    .orange { color: #f97316; }
    .cyan { color: #22d3ee; }
    .purple { color: #a855f7; }
    
    @media (max-width: 600px) {
      .score-row { flex-direction: column; }
      .score-card { min-width: auto; }
      .panel-row { flex-direction: column; }
      .metrics-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Weekly Safety Report</h1>
      <div class="company">${companyName}</div>
      <div class="date-range">📅 ${dateRange.startFormatted} - ${dateRange.endFormatted}</div>
    </div>

    <!-- Top Score Cards Row -->
    <div class="score-row">
      <div class="score-card" style="border-top-color: ${getScoreColor(m.safetyCultureIndex)}">
        <div class="score-label">Safety Culture Index</div>
        <div class="score-value" style="color: ${getScoreColor(m.safetyCultureIndex)}">${m.safetyCultureIndex}</div>
        <div class="score-detail">Target: 70+</div>
      </div>
      <div class="score-card" style="border-top-color: ${getScoreColor(m.predictiveRiskScore, true)}">
        <div class="score-label">Predictive Risk Score</div>
        <div class="score-value" style="color: ${getScoreColor(m.predictiveRiskScore, true)}">${m.predictiveRiskScore}</div>
        <div class="score-detail">Lower is better</div>
      </div>
      <div class="score-card" style="border-top-color: ${getScoreColor(m.riskForecast30Day, true)}">
        <div class="score-label">30-Day Forecast</div>
        <div class="score-value" style="color: ${getScoreColor(m.riskForecast30Day, true)}">${m.riskForecast30Day}</div>
        <div class="score-detail">${m.riskForecast30Day >= 50 ? 'Elevated Risk' : 'Low Risk'}</div>
      </div>
      <div class="score-card" style="border-top-color: ${getRatioColor(m.safeRatio)}">
        <div class="score-label">Safe/At-Risk Ratio</div>
        <div class="score-value" style="color: ${getRatioColor(m.safeRatio)}">${m.safeRatio}:1</div>
        <div class="score-detail">Target: 5:1</div>
      </div>
      <div class="score-card" style="border-top-color: #f97316">
        <div class="score-label">Job Stop Rate</div>
        <div class="score-value orange">${m.jobStopRate}%</div>
        <div class="score-detail">${m.jobStops} stops</div>
      </div>
      <div class="score-card" style="border-top-color: ${m.sifPotentialRate > 25 ? '#ef4444' : '#eab308'}">
        <div class="score-label">SIF Potential Rate</div>
        <div class="score-value" style="color: ${m.sifPotentialRate > 25 ? '#ef4444' : '#eab308'}">${m.sifPotentialRate}%</div>
        <div class="score-detail">${m.sifPotentialCount} of ${m.totalEvents} events</div>
      </div>
    </div>

    <!-- Second Row: Open Items, Lead/Lag, Near Misses -->
    <div class="score-row">
      <div class="score-card" style="border-top-color: ${m.totalOpenItems > 3 ? '#ef4444' : m.totalOpenItems > 0 ? '#eab308' : '#22c55e'}">
        <div class="score-label">Open Items</div>
        <div class="score-value" style="color: ${m.totalOpenItems > 3 ? '#ef4444' : m.totalOpenItems > 0 ? '#eab308' : '#22c55e'}">${m.totalOpenItems}</div>
        <div class="score-detail">Requiring action</div>
      </div>
      <div class="score-card" style="border-top-color: ${m.leadLagRatio >= 10 ? '#22c55e' : m.leadLagRatio >= 5 ? '#eab308' : '#ef4444'}">
        <div class="score-label">Lead/Lag Ratio</div>
        <div class="score-value" style="color: ${m.leadLagRatio >= 10 ? '#22c55e' : m.leadLagRatio >= 5 ? '#eab308' : '#ef4444'}">${m.leadLagRatio}:1</div>
        <div class="score-detail">Target: 10:1+</div>
      </div>
      <div class="score-card" style="border-top-color: #06b6d4">
        <div class="score-label">Near Misses</div>
        <div class="score-value cyan">${m.nearMissTotal}</div>
        <div class="score-detail">More = better culture</div>
      </div>
      <div class="score-card" style="border-top-color: #a855f7">
        <div class="score-label">Control Quality</div>
        <div class="score-value purple">${m.controlHierarchyScore}</div>
        <div class="score-detail">Higher = better controls</div>
      </div>
    </div>

    <!-- Engagement & Activity + BBS Observations -->
    <div class="panel-row">
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #065f46 0%, #047857 100%);">👥 Engagement & Activity</div>
        <div class="panel-content">
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value ${m.daysSinceLastSubmission <= 3 ? 'green' : m.daysSinceLastSubmission <= 7 ? 'yellow' : 'red'}">${m.daysSinceLastSubmission}</div>
              <div class="metric-label">Days Since Activity</div>
            </div>
            <div class="metric">
              <div class="metric-value cyan">${m.uniqueSubmitters}</div>
              <div class="metric-label">Active Submitters</div>
            </div>
            ${m.participationRate !== null ? `
            <div class="metric">
              <div class="metric-value ${m.participationRate >= 50 ? 'green' : m.participationRate >= 25 ? 'yellow' : 'red'}">${m.participationRate}%</div>
              <div class="metric-label">Participation Rate</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);">👀 BBS Observations</div>
        <div class="panel-content">
          <div style="text-align: center; margin-bottom: 12px;">
            <span style="font-size: 28px; font-weight: 700; color: #22c55e;">${m.safeObs}</span>
            <span style="font-size: 18px; color: #64748b; margin: 0 8px;">:</span>
            <span style="font-size: 28px; font-weight: 700; color: #ef4444;">${m.atRiskObs}</span>
          </div>
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value green">${m.totalBBS}</div>
              <div class="metric-label">Total Observations</div>
            </div>
            <div class="metric">
              <div class="metric-value orange">${m.jobStops}</div>
              <div class="metric-label">Job Stops</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leading Indicators + SIF Analytics -->
    <div class="panel-row">
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #065f46 0%, #059669 100%);">📈 Leading Indicators</div>
        <div class="panel-content">
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.bbsObservations}</div>
              <div class="metric-label">BBS</div>
            </div>
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.thas}</div>
              <div class="metric-label">THA/JSA</div>
            </div>
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.hazardIds}</div>
              <div class="metric-label">Hazard IDs</div>
            </div>
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.safetyMeetings + m.leadingIndicators.toolboxMeetings}</div>
              <div class="metric-label">Meetings</div>
            </div>
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.hseContacts}</div>
              <div class="metric-label">HSE Contacts</div>
            </div>
            <div class="metric">
              <div class="metric-value green">${m.leadingIndicators.lsrAudits}</div>
              <div class="metric-label">LSR Audits</div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);">☠️ SIF Potential (STKY)</div>
        <div class="panel-content">
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 36px; font-weight: 700; color: ${m.sifPotentialRate > 25 ? '#ef4444' : '#eab308'};">${m.sifPotentialRate}%</div>
            <div style="font-size: 10px; color: #94a3b8;">${m.sifPotentialCount} of ${m.totalEvents} events had SIF potential</div>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">ENERGY SOURCES:</div>
          ${Object.entries(m.energyTypes).slice(0, 4).map(([type, count]) => `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span style="color: #e2e8f0;">${type}</span>
            <span style="color: #f97316; font-weight: 600;">${count}</span>
          </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Lagging Indicators + Near Miss -->
    <div class="panel-row">
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%);">📉 Lagging Indicators</div>
        <div class="panel-content">
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value ${m.laggingIndicators.totalIncidents > 0 ? 'red' : 'green'}">${m.laggingIndicators.totalIncidents}</div>
              <div class="metric-label">Total Incidents</div>
            </div>
            <div class="metric">
              <div class="metric-value ${m.laggingIndicators.openIncidents > 0 ? 'red' : 'green'}">${m.laggingIndicators.openIncidents}</div>
              <div class="metric-label">Open Incidents</div>
            </div>
            <div class="metric">
              <div class="metric-value ${m.laggingIndicators.openSail > 0 ? 'red' : 'green'}">${m.laggingIndicators.openSail}</div>
              <div class="metric-label">Open SAIL</div>
            </div>
            <div class="metric">
              <div class="metric-value orange">${m.laggingIndicators.propertyDamage}</div>
              <div class="metric-label">Property Damage</div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #c2410c 0%, #ea580c 100%);">⚠️ Near Miss Reporting</div>
        <div class="panel-content">
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 36px; font-weight: 700; color: #22d3ee;">${m.nearMissTotal}</div>
            <div style="font-size: 10px; color: #94a3b8;">Near Misses Reported</div>
          </div>
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value red">${m.nearMissHigh}</div>
              <div class="metric-label">High-SIF P</div>
            </div>
            <div class="metric">
              <div class="metric-value yellow">${m.nearMissMed}</div>
              <div class="metric-label">Medium-SIF P</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LSR Audits -->
    <div class="panel-row">
      <div class="panel">
        <div class="panel-header" style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);">🛡️ Life-Saving Rules Audits</div>
        <div class="panel-content">
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 36px; font-weight: 700; color: #22d3ee;">${m.lsrAuditCounts.total}</div>
            <div style="font-size: 10px; color: #94a3b8;">Total LSR Audits</div>
          </div>
          <div class="metrics-grid">
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.lineOfFire}</div><div class="metric-label">Line of Fire</div></div>
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.liftingOps}</div><div class="metric-label">Lifting Ops</div></div>
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.workPermits}</div><div class="metric-label">Work Permits</div></div>
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.fallProtection}</div><div class="metric-label">Fall Protection</div></div>
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.driving}</div><div class="metric-label">Driving</div></div>
            <div class="metric"><div class="metric-value cyan">${m.lsrAuditCounts.confinedSpace}</div><div class="metric-label">Confined Space</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Open Items Table -->
    ${m.openItems.length > 0 ? `
    <div class="table-section">
      <div class="table-header" style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);">🔴 Oldest Open Items</div>
      <table>
        <thead><tr><th>Form</th><th>Location</th><th>Status</th><th>Days Open</th></tr></thead>
        <tbody>
          ${m.openItems.map((item: any) => `
          <tr>
            <td>${item.form}</td>
            <td>${item.location}</td>
            <td><span class="badge badge-open">${item.status}</span></td>
            <td><span class="days ${item.daysOpen > 30 ? 'days-critical' : item.daysOpen > 14 ? 'days-warning' : 'days-ok'}">${item.daysOpen}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Areas Needing Focus -->
    ${m.areasNeedingFocus.length > 0 ? `
    <div class="table-section">
      <div class="table-header" style="background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%);">⚠️ Areas Needing Focus</div>
      <table>
        <thead><tr><th>Source</th><th>Category</th><th>Issue</th><th>Count</th><th>Severity</th></tr></thead>
        <tbody>
          ${m.areasNeedingFocus.map((item: any) => `
          <tr>
            <td>${item.source}</td>
            <td style="color: #f97316; font-weight: 600;">${item.category}</td>
            <td>${item.issue}</td>
            <td style="font-weight: 700; color: #f97316;">${item.count}</td>
            <td><span class="badge badge-${item.severity}">${item.severity.toUpperCase()}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div style="background: #064e3b; border: 1px solid #10b981; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
      <span style="font-size: 20px;">✅</span>
      <span style="color: #6ee7b7; font-weight: 600; margin-left: 8px;">No critical areas needing immediate attention!</span>
    </div>
    `}

    <!-- Footer -->
    <div class="footer">
      <p style="margin-bottom: 12px;">View your full interactive dashboard at:</p>
      <p><a href="${dashboardLink}" style="font-size: 14px;">${dashboardLink}</a></p>
      <p style="margin-top: 16px; font-size: 10px;">
        Please do not reply to this email. For questions, contact <a href="mailto:brian@slpalaska.com">brian@slpalaska.com</a>
      </p>
      <p style="margin-top: 12px; font-size: 10px; color: #64748b;">
        Powered by Predictive Safety Analytics™ © 2026 SLP Alaska, LLC
      </p>
    </div>
  </div>
</body>
</html>
`
}

// Send email via Resend
async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'SLP Safety Reports <reports@slpalaska.com>',
      to,
      subject,
      html
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  return await response.json()
}

serve(async (req) => {
  try {
    const dateRange = getLastWeekRange()

    // Get all active recipients grouped by company
    const { data: recipients, error } = await supabase
      .from('email_recipients')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    // Get company tokens
    const { data: tokens } = await supabase
      .from('company_view_tokens')
      .select('company_name, token')
      .eq('is_active', true)

    const tokenMap = new Map<string, string>()
    for (const t of tokens || []) {
      tokenMap.set(t.company_name, t.token)
    }

    // Group recipients by company
    const companiesMap = new Map<string, string[]>()
    for (const r of recipients || []) {
      const emails = companiesMap.get(r.company_name) || []
      emails.push(r.email)
      companiesMap.set(r.company_name, emails)
    }

    const results = []

    // TEST MODE
    const TEST_MODE = false
    const TEST_EMAIL = 'brian@slpalaska.com'

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    let companyIndex = 0
    for (const [companyName, emails] of companiesMap) {
      try {
        if (companyIndex > 0) await delay(1500)
        companyIndex++

        const allRecipients = TEST_MODE ? [TEST_EMAIL] : [...emails, 'brian@slpalaska.com']
        const companyToken = tokenMap.get(companyName) || ''

        // Get last 7 days company data
        const data = await getCompanyData(companyName, dateRange.start, dateRange.end)

        // Generate email
        const html = generateEmailHTML(companyName, data, dateRange, companyToken)
        const subject = `Weekly Safety Report - ${companyName} (${dateRange.startFormatted} - ${dateRange.endFormatted})`

        // Send email
        const result = await sendEmail(allRecipients, subject, html)

        results.push({
          company: companyName,
          recipients: allRecipients.length,
          status: 'sent',
          id: result.id
        })

        console.log(`✓ Sent report to ${companyName} (${allRecipients.length} recipients)`)

      } catch (err: any) {
        results.push({
          company: companyName,
          status: 'error',
          error: err.message
        })
        console.error(`✗ Error sending to ${companyName}:`, err.message)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dateRange,
        companiesProcessed: results.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
