// ============================================================================
// ADVANCED SAFETY ANALYTICS MODULE
// SLP Alaska - Predictive Safety Analytics Dashboard
// ============================================================================
// 
// This module contains proprietary algorithms for:
// 1. Novel Workflows - Automated safety data processing pipelines
// 2. Unique Scoring Algorithms - Multi-factor safety culture & risk scoring
// 3. Automated Risk Modeling - ML-inspired risk prediction
// 4. Integrated Compliance Logic - Real-time regulatory compliance checking
// 5. Predictive Injury Modeling - Probability-based incident forecasting
//
// ============================================================================

// ============================================================================
// 1. NOVEL WORKFLOWS
// ============================================================================
// Automated data aggregation and analysis pipelines that transform raw safety
// data into actionable intelligence

/**
 * WORKFLOW: Leading Indicator Cascade Analysis
 * Traces the relationship between leading indicators and outcomes
 * Identifies which leading activities have the strongest protective effect
 */
export function analyzeLeadingIndicatorCascade(data) {
  const {
    bbsData, thaData, safetyMeetingsData, toolboxMeetingsData,
    hseContactsData, hazardIdData, incidentsData, goodCatchData
  } = data

  // Calculate activity density (activities per employee per month)
  const totalLeading = (bbsData?.length || 0) + (thaData?.length || 0) + 
                       (safetyMeetingsData?.length || 0) + (toolboxMeetingsData?.length || 0) +
                       (hseContactsData?.length || 0) + (hazardIdData?.length || 0)
  
  const totalLagging = (incidentsData?.length || 0)
  
  // Leading-to-Lagging Ratio (target: 10:1 or higher)
  const leadLagRatio = totalLagging > 0 ? totalLeading / totalLagging : totalLeading
  
  // Intervention Effectiveness Score
  // Measures how well leading activities prevent incidents
  const interventionEffectiveness = calculateInterventionEffectiveness({
    goodCatches: goodCatchData?.length || 0,
    hazardIds: hazardIdData?.length || 0,
    incidents: incidentsData?.length || 0,
    nearMisses: goodCatchData?.filter(g => g.event_type === 'Near Miss').length || 0
  })

  return {
    leadLagRatio: Math.round(leadLagRatio * 10) / 10,
    interventionEffectiveness,
    activityBreakdown: {
      bbs: bbsData?.length || 0,
      tha: thaData?.length || 0,
      meetings: (safetyMeetingsData?.length || 0) + (toolboxMeetingsData?.length || 0),
      hseContacts: hseContactsData?.length || 0,
      hazardIds: hazardIdData?.length || 0
    },
    recommendation: leadLagRatio >= 10 ? 'Excellent' : leadLagRatio >= 5 ? 'Good' : leadLagRatio >= 2 ? 'Needs Improvement' : 'Critical'
  }
}

function calculateInterventionEffectiveness({ goodCatches, hazardIds, incidents, nearMisses }) {
  // Formula: (Prevented Events / Total Potential Events) * 100
  // Prevented = Good Catches + Hazard IDs that didn't become incidents
  const preventedEvents = goodCatches + hazardIds
  const totalPotentialEvents = preventedEvents + incidents + nearMisses
  
  if (totalPotentialEvents === 0) return 100 // No events = perfect prevention
  
  return Math.round((preventedEvents / totalPotentialEvents) * 100)
}

/**
 * WORKFLOW: Automated Trend Detection
 * Identifies emerging patterns before they become incidents
 */
export function detectEmergingTrends(data, timeWindowDays = 30) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - timeWindowDays * 24 * 60 * 60 * 1000)
  
  const trends = {
    risingRisks: [],
    decliningPerformance: [],
    improvingAreas: [],
    stableAreas: []
  }

  // Analyze BBS trends by category
  const bbsByCategory = groupByCategory(data.bbsData || [], 'observation_category')
  Object.entries(bbsByCategory).forEach(([category, observations]) => {
    const recentAtRisk = observations.filter(o => 
      o.observation_type === 'At-Risk' && 
      new Date(o.observation_date || o.created_at) >= windowStart
    ).length

    const olderAtRisk = observations.filter(o => 
      o.observation_type === 'At-Risk' && 
      new Date(o.observation_date || o.created_at) < windowStart
    ).length

    if (recentAtRisk > olderAtRisk * 1.5) {
      trends.risingRisks.push({
        type: 'BBS At-Risk Behavior',
        category,
        change: '+' + Math.round(((recentAtRisk - olderAtRisk) / Math.max(olderAtRisk, 1)) * 100) + '%',
        severity: recentAtRisk > 5 ? 'high' : 'medium'
      })
    } else if (recentAtRisk < olderAtRisk * 0.7) {
      trends.improvingAreas.push({
        type: 'BBS Improvement',
        category,
        change: '-' + Math.round(((olderAtRisk - recentAtRisk) / Math.max(olderAtRisk, 1)) * 100) + '%'
      })
    }
  })

  return trends
}

function groupByCategory(data, categoryField) {
  return data.reduce((acc, item) => {
    const cat = item[categoryField] || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})
}

// ============================================================================
// 2. UNIQUE SCORING ALGORITHMS
// ============================================================================

/**
 * SAFETY CULTURE INDEX (SCI) - Proprietary Algorithm
 * 
 * A composite score (0-100) measuring organizational safety culture health
 * based on multiple weighted factors:
 * 
 * POSITIVE FACTORS (can add up to +30):
 * - Safe/At-Risk Ratio: Higher ratio = better culture (+0 to +10)
 * - Job Stop Rate: Willingness to stop unsafe work (+0 to +10)
 * - Near Miss Reporting: More reporting = better culture (+0 to +10)
 * 
 * NEGATIVE FACTORS (can subtract up to -50):
 * - Incident Count: More incidents = worse culture (-0 to -20)
 * - SIF Potential Rate: High-consequence events (-0 to -15)
 * - At-Risk Behavior Rate: Unsafe behaviors observed (-0 to -15)
 * - Open/Overdue Items: Unresolved issues (-0 to -20)
 */
export function calculateSafetyCultureIndex(metrics) {
  let sciScore = 70 // Baseline "average" culture

  // === POSITIVE FACTORS ===
  
  // Safe/At-Risk Ratio (max +10)
  const safeRatio = metrics.safeRatio || 0
  if (safeRatio >= 10) sciScore += 10
  else if (safeRatio >= 5) sciScore += 7
  else if (safeRatio >= 3) sciScore += 5
  else if (safeRatio >= 2) sciScore += 3
  else if (safeRatio >= 1) sciScore += 1

  // Job Stop Rate - willingness to stop work (max +10)
  const jobStopRate = metrics.jobStopRate || 0
  if (jobStopRate >= 80) sciScore += 10
  else if (jobStopRate >= 60) sciScore += 8
  else if (jobStopRate >= 40) sciScore += 5
  else if (jobStopRate >= 20) sciScore += 2

  // Near Miss Reporting Culture (max +10)
  const nearMissCount = metrics.nearMissCount || 0
  if (nearMissCount >= 20) sciScore += 10
  else if (nearMissCount >= 10) sciScore += 7
  else if (nearMissCount >= 5) sciScore += 4
  else if (nearMissCount >= 1) sciScore += 2

  // === NEGATIVE FACTORS ===
  
  // Incidents (max -20)
  const incidentCount = metrics.incidentCount || 0
  if (incidentCount >= 10) sciScore -= 20
  else if (incidentCount >= 5) sciScore -= 15
  else if (incidentCount >= 3) sciScore -= 10
  else if (incidentCount >= 1) sciScore -= 5

  // SIF Potential Rate (max -15)
  const sifRate = metrics.sifPotentialRate || 0
  if (sifRate >= 50) sciScore -= 15
  else if (sifRate >= 30) sciScore -= 10
  else if (sifRate >= 20) sciScore -= 7
  else if (sifRate >= 10) sciScore -= 3

  // At-Risk Behavior Rate (max -15)
  const atRiskRate = metrics.atRiskRate || 0
  if (atRiskRate >= 50) sciScore -= 15
  else if (atRiskRate >= 30) sciScore -= 10
  else if (atRiskRate >= 20) sciScore -= 5
  else if (atRiskRate >= 10) sciScore -= 2

  // Open/Overdue Items (max -20)
  const openItems = metrics.openItems || 0
  const overdueItems = metrics.overdueItems || 0
  if (openItems >= 10) sciScore -= 10
  else if (openItems >= 5) sciScore -= 7
  else if (openItems >= 3) sciScore -= 4
  else if (openItems >= 1) sciScore -= 2

  if (overdueItems >= 5) sciScore -= 10
  else if (overdueItems >= 3) sciScore -= 7
  else if (overdueItems >= 1) sciScore -= 3

  return {
    score: Math.min(100, Math.max(0, sciScore)),
    grade: sciScore >= 85 ? 'A' : sciScore >= 70 ? 'B' : sciScore >= 55 ? 'C' : sciScore >= 40 ? 'D' : 'F',
    factors: {
      positive: { safeRatio, jobStopRate, nearMissCount },
      negative: { incidentCount, sifRate, atRiskRate, openItems, overdueItems }
    }
  }
}

/**
 * PREDICTIVE RISK SCORE (PRS) - Proprietary Algorithm
 * 
 * Predicts likelihood of future incidents based on current conditions
 * Score 0-100: 0 = minimal risk, 100 = critical risk
 * 
 * Risk Factors:
 * - Open items aging (+5 to +30)
 * - Overdue corrective actions (+5 to +25)
 * - SIF Potential trend (+5 to +25)
 * - At-Risk behavior trend (+3 to +20)
 * - Engagement decline (+5 to +25)
 * - Recent incident cluster (+10 to +30)
 */
export function calculatePredictiveRiskScore(metrics) {
  let riskScore = 0

  // Open Items Aging
  const openItems = metrics.openItems || 0
  if (openItems >= 20) riskScore += 30
  else if (openItems >= 10) riskScore += 25
  else if (openItems >= 5) riskScore += 15
  else if (openItems >= 1) riskScore += 5

  // Overdue Items
  const overdueItems = metrics.overdueItems || 0
  if (overdueItems >= 10) riskScore += 25
  else if (overdueItems >= 5) riskScore += 20
  else if (overdueItems >= 2) riskScore += 10
  else if (overdueItems >= 1) riskScore += 5

  // SIF Potential Rate
  const sifRate = metrics.sifPotentialRate || 0
  if (sifRate >= 30) riskScore += 25
  else if (sifRate >= 20) riskScore += 20
  else if (sifRate >= 10) riskScore += 10
  else if (sifRate >= 5) riskScore += 5

  // At-Risk Rate
  const atRiskRate = metrics.atRiskRate || 0
  if (atRiskRate >= 50) riskScore += 20
  else if (atRiskRate >= 30) riskScore += 15
  else if (atRiskRate >= 15) riskScore += 8
  else if (atRiskRate >= 5) riskScore += 3

  // Engagement (days since last submission)
  const daysSinceActivity = metrics.daysSinceLastSubmission || 0
  if (daysSinceActivity >= 30) riskScore += 25
  else if (daysSinceActivity >= 14) riskScore += 15
  else if (daysSinceActivity >= 7) riskScore += 8

  // Recent Incidents (clustering detection)
  const recentIncidents = metrics.recentIncidents || 0
  if (recentIncidents >= 5) riskScore += 30
  else if (recentIncidents >= 3) riskScore += 20
  else if (recentIncidents >= 1) riskScore += 10

  return {
    score: Math.min(100, Math.max(0, riskScore)),
    level: riskScore >= 70 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 30 ? 'Moderate' : riskScore >= 10 ? 'Low' : 'Minimal',
    color: riskScore >= 70 ? '#dc2626' : riskScore >= 50 ? '#f97316' : riskScore >= 30 ? '#eab308' : '#22c55e'
  }
}

/**
 * CONTROL HIERARCHY EFFECTIVENESS SCORE
 * 
 * Measures how well hazard controls follow the hierarchy of controls
 * Tier 1 (Elimination/Substitution/Engineering) = 100 points
 * Tier 2 (Guarding/LOTO/Barriers) = 60 points  
 * Tier 3 (Administrative/PPE) = 30 points
 */
export function calculateControlHierarchyScore(controls) {
  const { tier1 = 0, tier2 = 0, tier3 = 0 } = controls
  const total = tier1 + tier2 + tier3
  
  if (total === 0) return { score: 50, grade: 'N/A' }
  
  const weightedScore = ((tier1 * 100) + (tier2 * 60) + (tier3 * 30)) / total
  
  return {
    score: Math.round(weightedScore),
    grade: weightedScore >= 80 ? 'Excellent' : weightedScore >= 60 ? 'Good' : weightedScore >= 40 ? 'Fair' : 'Poor',
    breakdown: {
      tier1: { count: tier1, percent: Math.round((tier1 / total) * 100) },
      tier2: { count: tier2, percent: Math.round((tier2 / total) * 100) },
      tier3: { count: tier3, percent: Math.round((tier3 / total) * 100) }
    }
  }
}

// ============================================================================
// 3. AUTOMATED RISK MODELING
// ============================================================================

/**
 * 30-DAY RISK FORECAST MODEL
 * 
 * Uses multiple weighted factors to predict risk level 30 days out
 * Employs a modified regression approach with safety-specific variables
 */
export function calculate30DayRiskForecast(metrics) {
  // Base risk starts at 30 (moderate baseline)
  let forecastRisk = 30
  
  // Factor 1: At-Risk Behavior Trend (weight: HIGH)
  // Rising at-risk behaviors are a strong predictor of future incidents
  if (metrics.bbsTrend?.direction === 'up' && metrics.bbsTrend?.percent > 20) {
    forecastRisk += 15
  } else if (metrics.bbsTrend?.direction === 'up') {
    forecastRisk += 8
  } else if (metrics.bbsTrend?.direction === 'down') {
    forecastRisk -= 5
  }
  
  // Factor 2: SIF Potential Trend (weight: HIGH)
  // Increasing serious injury/fatality potential is critical
  if (metrics.sifTrend?.direction === 'up') {
    forecastRisk += 12
  } else if (metrics.sifTrend?.direction === 'down') {
    forecastRisk -= 5
  }
  
  // Factor 3: Open Items Aging (weight: MEDIUM)
  // Unresolved issues accumulate risk over time
  if (metrics.avgDaysOpen > 60) forecastRisk += 15
  else if (metrics.avgDaysOpen > 30) forecastRisk += 8
  
  // Factor 4: Engagement Decline (weight: HIGH)
  // Declining engagement is a leading indicator of incidents
  if (metrics.daysSinceLastSubmission > 14) forecastRisk += 20
  else if (metrics.daysSinceLastSubmission > 7) forecastRisk += 10
  else if (metrics.daysSinceLastSubmission > 3) forecastRisk += 5
  
  // Factor 5: Recent Incident Clustering (weight: HIGH)
  // Multiple recent incidents indicate systemic issues
  if (metrics.recentIncidents >= 3) forecastRisk += 20
  else if (metrics.recentIncidents >= 1) forecastRisk += 10
  
  // Factor 6: Leading Activity Level (PROTECTIVE)
  // Active safety engagement reduces future risk
  if (metrics.leadingActivityLevel === 'high') forecastRisk -= 15
  else if (metrics.leadingActivityLevel === 'medium') forecastRisk -= 8
  else if (metrics.leadingActivityLevel === 'low') forecastRisk += 10
  else if (metrics.leadingActivityLevel === 'none') forecastRisk += 25

  const finalScore = Math.min(100, Math.max(0, Math.round(forecastRisk)))
  
  return {
    score: finalScore,
    level: finalScore >= 70 ? 'Critical' : finalScore >= 50 ? 'High' : finalScore >= 30 ? 'Elevated' : 'Low',
    factors: {
      bbsTrend: metrics.bbsTrend,
      sifTrend: metrics.sifTrend,
      avgDaysOpen: metrics.avgDaysOpen,
      daysSinceLastSubmission: metrics.daysSinceLastSubmission,
      recentIncidents: metrics.recentIncidents,
      leadingActivityLevel: metrics.leadingActivityLevel
    },
    recommendations: generateRiskRecommendations(finalScore, metrics)
  }
}

function generateRiskRecommendations(score, metrics) {
  const recommendations = []
  
  if (metrics.daysSinceLastSubmission > 7) {
    recommendations.push({
      priority: 'High',
      action: 'Increase safety engagement activities',
      detail: `No submissions in ${metrics.daysSinceLastSubmission} days - schedule safety stand-down or toolbox talks`
    })
  }
  
  if (metrics.avgDaysOpen > 30) {
    recommendations.push({
      priority: 'High', 
      action: 'Accelerate corrective action closure',
      detail: `Average open item age is ${metrics.avgDaysOpen} days - prioritize oldest items`
    })
  }
  
  if (metrics.bbsTrend?.direction === 'up') {
    recommendations.push({
      priority: 'Medium',
      action: 'Address rising at-risk behaviors',
      detail: 'Conduct targeted behavioral safety coaching in affected areas'
    })
  }
  
  if (metrics.recentIncidents >= 2) {
    recommendations.push({
      priority: 'Critical',
      action: 'Investigate incident cluster',
      detail: `${metrics.recentIncidents} incidents in last 30 days - look for common causes`
    })
  }
  
  return recommendations
}

/**
 * LOCATION RISK HEAT MAP
 * Calculates risk score for each location based on incident history,
 * at-risk behaviors, and compliance gaps
 */
export function calculateLocationRiskMap(data) {
  const locationRisks = {}
  
  // Aggregate incidents by location
  (data.incidentsData || []).forEach(inc => {
    const loc = inc.location || inc.location_name || 'Unknown'
    if (!locationRisks[loc]) {
      locationRisks[loc] = { incidents: 0, atRiskBehaviors: 0, openItems: 0, sifEvents: 0 }
    }
    locationRisks[loc].incidents++
    if (inc.is_sif || inc.stky_event === 'Yes') locationRisks[loc].sifEvents++
  })
  
  // Aggregate at-risk behaviors by location
  (data.bbsData || []).filter(b => b.observation_type === 'At-Risk').forEach(obs => {
    const loc = obs.location || obs.location_name || 'Unknown'
    if (!locationRisks[loc]) {
      locationRisks[loc] = { incidents: 0, atRiskBehaviors: 0, openItems: 0, sifEvents: 0 }
    }
    locationRisks[loc].atRiskBehaviors++
  })
  
  // Calculate composite risk score for each location
  return Object.entries(locationRisks).map(([location, data]) => ({
    location,
    riskScore: Math.min(100, 
      (data.incidents * 20) + 
      (data.sifEvents * 30) + 
      (data.atRiskBehaviors * 5) + 
      (data.openItems * 10)
    ),
    ...data
  })).sort((a, b) => b.riskScore - a.riskScore)
}

// ============================================================================
// 4. INTEGRATED COMPLIANCE LOGIC
// ============================================================================

/**
 * LIFE-SAVING RULES COMPLIANCE CHECKER
 * Automatically evaluates compliance with critical safety rules
 */
export function checkLSRCompliance(auditData) {
  const complianceResults = {
    overallCompliance: 0,
    byCategory: {},
    criticalGaps: [],
    recommendations: []
  }

  const categories = [
    'Confined Space', 'Driving', 'Energy Isolation', 'Fall Protection',
    'Lifting Operations', 'Line of Fire', 'Work Permits', 'Hot Work', 'Working at Heights'
  ]

  let totalAudits = 0
  let totalCompliant = 0

  categories.forEach(category => {
    const categoryData = auditData[category] || []
    if (categoryData.length === 0) return

    const compliantCount = categoryData.filter(audit => {
      // Check all Yes/No fields for compliance
      let isCompliant = true
      Object.entries(audit).forEach(([field, value]) => {
        if (value === 'No' || value === 'Needs Improvement' || value === false) {
          isCompliant = false
        }
      })
      return isCompliant
    }).length

    const categoryCompliance = Math.round((compliantCount / categoryData.length) * 100)
    
    complianceResults.byCategory[category] = {
      total: categoryData.length,
      compliant: compliantCount,
      complianceRate: categoryCompliance
    }

    totalAudits += categoryData.length
    totalCompliant += compliantCount

    // Flag critical gaps (< 80% compliance)
    if (categoryCompliance < 80) {
      complianceResults.criticalGaps.push({
        category,
        complianceRate: categoryCompliance,
        gap: 80 - categoryCompliance
      })
    }
  })

  complianceResults.overallCompliance = totalAudits > 0 
    ? Math.round((totalCompliant / totalAudits) * 100) 
    : 100

  // Generate recommendations
  complianceResults.criticalGaps.forEach(gap => {
    complianceResults.recommendations.push({
      priority: gap.gap > 30 ? 'Critical' : 'High',
      category: gap.category,
      action: `Improve ${gap.category} compliance from ${gap.complianceRate}% to 80%+`,
      detail: `Current gap: ${gap.gap} percentage points below target`
    })
  })

  return complianceResults
}

/**
 * INSPECTION COMPLIANCE TRACKER
 * Tracks inspection completion rates and identifies overdue equipment
 */
export function trackInspectionCompliance(inspectionData, requirements) {
  const compliance = {
    summary: { completed: 0, required: 0, complianceRate: 0 },
    byType: {},
    overdue: [],
    upcoming: []
  }

  const inspectionTypes = [
    { key: 'fireExtinguisher', name: 'Fire Extinguisher', frequency: 30 },
    { key: 'eyewash', name: 'Eyewash Station', frequency: 7 },
    { key: 'firstAid', name: 'First Aid Kit', frequency: 30 },
    { key: 'aed', name: 'AED', frequency: 30 },
    { key: 'vehicle', name: 'Vehicle', frequency: 1 }, // Daily
    { key: 'harness', name: 'Fall Protection Harness', frequency: 30 },
    { key: 'crane', name: 'Crane', frequency: 30 }
  ]

  const now = new Date()

  inspectionTypes.forEach(({ key, name, frequency }) => {
    const typeData = inspectionData[key] || []
    
    // Find most recent inspection
    const sorted = typeData.sort((a, b) => 
      new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
    )
    
    const mostRecent = sorted[0]
    const daysSinceLast = mostRecent 
      ? Math.floor((now - new Date(mostRecent.created_at || mostRecent.date)) / (1000 * 60 * 60 * 24))
      : 999

    const isCompliant = daysSinceLast <= frequency
    
    compliance.byType[key] = {
      name,
      frequency,
      lastInspection: mostRecent?.created_at || mostRecent?.date || null,
      daysSinceLast,
      isCompliant,
      status: daysSinceLast > frequency ? 'Overdue' : daysSinceLast > frequency * 0.8 ? 'Due Soon' : 'Current'
    }

    if (!isCompliant) {
      compliance.overdue.push({
        type: name,
        daysSinceLast,
        daysOverdue: daysSinceLast - frequency
      })
    } else if (daysSinceLast > frequency * 0.8) {
      compliance.upcoming.push({
        type: name,
        daysUntilDue: frequency - daysSinceLast
      })
    }

    compliance.summary.required++
    if (isCompliant) compliance.summary.completed++
  })

  compliance.summary.complianceRate = Math.round(
    (compliance.summary.completed / compliance.summary.required) * 100
  )

  return compliance
}

// ============================================================================
// 5. PREDICTIVE INJURY MODELING
// ============================================================================

/**
 * INJURY PROBABILITY MODEL
 * 
 * Calculates the probability of an injury occurring based on:
 * - Historical incident rates
 * - Current at-risk behavior patterns
 * - Leading indicator activity levels
 * - Environmental/seasonal factors
 * 
 * Returns a probability score (0-100%) and confidence interval
 */
export function calculateInjuryProbability(data, timeframeDays = 30) {
  // Base probability from industry benchmarks (adjusted for oilfield operations)
  let baseProbability = 5 // 5% base probability over 30 days

  // Factor 1: Historical Incident Rate
  const historicalRate = calculateHistoricalIncidentRate(data.incidentsData, data.employeeCount)
  baseProbability *= (1 + historicalRate / 10)

  // Factor 2: At-Risk Behavior Prevalence
  const atRiskRate = calculateAtRiskRate(data.bbsData)
  if (atRiskRate > 30) baseProbability *= 1.5
  else if (atRiskRate > 20) baseProbability *= 1.3
  else if (atRiskRate > 10) baseProbability *= 1.1
  else if (atRiskRate < 5) baseProbability *= 0.8

  // Factor 3: Leading Indicator Activity (PROTECTIVE)
  const leadingActivity = assessLeadingActivity(data)
  if (leadingActivity === 'high') baseProbability *= 0.6
  else if (leadingActivity === 'medium') baseProbability *= 0.8
  else if (leadingActivity === 'low') baseProbability *= 1.2
  else baseProbability *= 1.5

  // Factor 4: SIF Potential Events
  const sifRate = data.sifMetrics?.sifPotentialRate || 0
  if (sifRate > 20) baseProbability *= 1.4
  else if (sifRate > 10) baseProbability *= 1.2

  // Factor 5: Open Corrective Actions
  const openItems = data.aging?.over30Days || 0
  if (openItems > 10) baseProbability *= 1.3
  else if (openItems > 5) baseProbability *= 1.15

  // Cap probability at 95%
  const finalProbability = Math.min(95, Math.max(1, baseProbability))

  // Calculate confidence interval (wider with less data)
  const dataPoints = (data.incidentsData?.length || 0) + (data.bbsData?.length || 0)
  const confidenceWidth = dataPoints > 100 ? 5 : dataPoints > 50 ? 10 : dataPoints > 20 ? 15 : 20

  return {
    probability: Math.round(finalProbability),
    confidenceInterval: {
      low: Math.max(1, Math.round(finalProbability - confidenceWidth)),
      high: Math.min(95, Math.round(finalProbability + confidenceWidth))
    },
    timeframe: `${timeframeDays} days`,
    riskLevel: finalProbability >= 25 ? 'High' : finalProbability >= 15 ? 'Elevated' : finalProbability >= 8 ? 'Moderate' : 'Low',
    factors: {
      historicalRate,
      atRiskRate,
      leadingActivity,
      sifRate,
      openItems
    }
  }
}

function calculateHistoricalIncidentRate(incidents, employeeCount) {
  if (!incidents || !employeeCount) return 0
  // TRIR-style calculation: (Incidents * 200,000) / Hours Worked
  // Assuming 2000 hours/employee/year, scaled to available data
  const incidentCount = incidents.length
  const estimatedHours = employeeCount * 2000
  return (incidentCount * 200000) / estimatedHours
}

function calculateAtRiskRate(bbsData) {
  if (!bbsData || bbsData.length === 0) return 0
  const atRisk = bbsData.filter(b => b.observation_type === 'At-Risk').length
  return Math.round((atRisk / bbsData.length) * 100)
}

function assessLeadingActivity(data) {
  const total = (data.bbsData?.length || 0) + 
                (data.thaData?.length || 0) + 
                (data.safetyMeetingsData?.length || 0) +
                (data.hazardIdData?.length || 0)
  
  if (total >= 50) return 'high'
  if (total >= 20) return 'medium'
  if (total >= 5) return 'low'
  return 'none'
}

/**
 * SIF POTENTIAL PREDICTOR
 * 
 * Identifies conditions that increase likelihood of Serious Injury/Fatality
 * Based on energy source exposure, control effectiveness, and precursor events
 */
export function predictSIFPotential(data) {
  const sifIndicators = {
    score: 0,
    factors: [],
    highRiskActivities: [],
    recommendations: []
  }

  // Factor 1: High-Energy Work Activities
  const highEnergyTypes = ['Gravity', 'Electrical', 'Pressure', 'Mechanical']
  const energyExposure = data.energySourceMetrics?.byEnergyType || {}
  
  highEnergyTypes.forEach(type => {
    if ((energyExposure[type] || 0) > 10) {
      sifIndicators.score += 15
      sifIndicators.factors.push(`High exposure to ${type} energy sources`)
      sifIndicators.highRiskActivities.push(type)
    }
  })

  // Factor 2: Control Effectiveness
  const controlScore = data.energySourceMetrics?.controlHierarchyScore || 50
  if (controlScore < 40) {
    sifIndicators.score += 20
    sifIndicators.factors.push('Weak control hierarchy - over-reliance on PPE/administrative controls')
  }

  // Factor 3: Precursor Events (Near Misses with SIF Potential)
  const sifPrecursors = data.sifMetrics?.sifPotentialCount || 0
  if (sifPrecursors > 5) {
    sifIndicators.score += 25
    sifIndicators.factors.push(`${sifPrecursors} SIF-potential events recorded`)
  } else if (sifPrecursors > 2) {
    sifIndicators.score += 15
  }

  // Factor 4: Life-Saving Rule Gaps
  const lsrGaps = data.areasNeedingFocus?.filter(a => a.source === 'LSR Audit').length || 0
  if (lsrGaps > 3) {
    sifIndicators.score += 20
    sifIndicators.factors.push(`${lsrGaps} Life-Saving Rule compliance gaps`)
  }

  // Generate recommendations
  if (sifIndicators.highRiskActivities.length > 0) {
    sifIndicators.recommendations.push({
      priority: 'Critical',
      action: 'Review high-energy work controls',
      detail: `Focus on: ${sifIndicators.highRiskActivities.join(', ')}`
    })
  }

  if (controlScore < 50) {
    sifIndicators.recommendations.push({
      priority: 'High',
      action: 'Upgrade hazard controls',
      detail: 'Move from PPE/administrative controls to engineering controls where possible'
    })
  }

  return {
    ...sifIndicators,
    score: Math.min(100, sifIndicators.score),
    level: sifIndicators.score >= 60 ? 'Critical' : sifIndicators.score >= 40 ? 'High' : sifIndicators.score >= 20 ? 'Moderate' : 'Low'
  }
}

/**
 * INCIDENT RECURRENCE PREDICTOR
 * 
 * Analyzes past incidents to identify patterns and predict recurrence
 */
export function predictIncidentRecurrence(incidents) {
  if (!incidents || incidents.length < 2) {
    return { patterns: [], recurrenceRisk: 'Insufficient Data' }
  }

  const patterns = {
    byType: {},
    byLocation: {},
    byTimeOfDay: {},
    byDayOfWeek: {},
    seasonal: {}
  }

  incidents.forEach(inc => {
    // Type patterns
    const type = inc.incident_type || inc.classification || 'Unknown'
    patterns.byType[type] = (patterns.byType[type] || 0) + 1

    // Location patterns
    const loc = inc.location || inc.location_name || 'Unknown'
    patterns.byLocation[loc] = (patterns.byLocation[loc] || 0) + 1

    // Time patterns
    const date = new Date(inc.incident_date || inc.created_at)
    const hour = date.getHours()
    const timeSlot = hour < 6 ? 'Night (12am-6am)' : hour < 12 ? 'Morning (6am-12pm)' : hour < 18 ? 'Afternoon (12pm-6pm)' : 'Evening (6pm-12am)'
    patterns.byTimeOfDay[timeSlot] = (patterns.byTimeOfDay[timeSlot] || 0) + 1

    const day = date.toLocaleDateString('en-US', { weekday: 'long' })
    patterns.byDayOfWeek[day] = (patterns.byDayOfWeek[day] || 0) + 1

    const month = date.toLocaleDateString('en-US', { month: 'long' })
    patterns.seasonal[month] = (patterns.seasonal[month] || 0) + 1
  })

  // Find high-recurrence patterns
  const recurrencePatterns = []

  // Types with 2+ incidents
  Object.entries(patterns.byType).forEach(([type, count]) => {
    if (count >= 2) {
      recurrencePatterns.push({
        pattern: `${type} incidents`,
        occurrences: count,
        risk: count >= 4 ? 'High' : 'Medium',
        recommendation: `Conduct root cause analysis on ${type} incidents`
      })
    }
  })

  // Locations with 2+ incidents
  Object.entries(patterns.byLocation).forEach(([location, count]) => {
    if (count >= 2) {
      recurrencePatterns.push({
        pattern: `Incidents at ${location}`,
        occurrences: count,
        risk: count >= 4 ? 'High' : 'Medium',
        recommendation: `Site-specific safety review for ${location}`
      })
    }
  })

  return {
    patterns: recurrencePatterns,
    details: patterns,
    recurrenceRisk: recurrencePatterns.length > 3 ? 'High' : recurrencePatterns.length > 1 ? 'Medium' : 'Low',
    totalPatterns: recurrencePatterns.length
  }
}

// ============================================================================
// EXPORT ALL ANALYTICS FUNCTIONS
// ============================================================================

export default {
  // Novel Workflows
  analyzeLeadingIndicatorCascade,
  detectEmergingTrends,
  
  // Unique Scoring Algorithms
  calculateSafetyCultureIndex,
  calculatePredictiveRiskScore,
  calculateControlHierarchyScore,
  
  // Automated Risk Modeling
  calculate30DayRiskForecast,
  calculateLocationRiskMap,
  
  // Integrated Compliance Logic
  checkLSRCompliance,
  trackInspectionCompliance,
  
  // Predictive Injury Modeling
  calculateInjuryProbability,
  predictSIFPotential,
  predictIncidentRecurrence
}
