// ============================================================================
// SHARED SCORING DEFINITIONS
// Pure functions only (no I/O, no React, no Supabase) so each definition can be
// pinned by unit tests in tests/scoring.test.js and reused by the dashboard.
// Control Quality is deliberately NOT here: it stays exactly as it was.
// The weekly email function (supabase/functions/send-weekly-reports) is a Deno
// function deployed separately and does not import this file yet. See the PR
// description for the follow-up.
// ============================================================================

export const MIN_RATIO_OBSERVATIONS = 10
export const MIN_SIF_EVENTS_FOR_PERCENT = 10
export const MIN_FORECAST_RANGE_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Job Stop Rate: job stops divided by at-risk observations (one denominator)
// ---------------------------------------------------------------------------
export function jobStopRate({ jobStops = 0, atRisk = 0 }) {
  if (!atRisk) {
    return { state: 'none-yet', rate: null, jobStops, atRisk, label: 'Job Stop Rate (of at-risk observations)', detail: 'None yet' }
  }
  const rate = Math.round((jobStops / atRisk) * 100)
  return {
    state: 'ok',
    rate,
    jobStops,
    atRisk,
    label: 'Job Stop Rate (of at-risk observations)',
    detail: `${jobStops} stops of ${atRisk} at-risk observations`
  }
}

export const JOB_STOP_ENCOURAGEMENT = 'Crews who stop the job are doing the right thing'

// ---------------------------------------------------------------------------
// Safe / At-Risk ratio: hidden under 10 observations
// ---------------------------------------------------------------------------
export function safeAtRiskRatio({ safe = 0, atRisk = 0, minObservations = MIN_RATIO_OBSERVATIONS }) {
  const observations = safe + atRisk
  const ratio = atRisk > 0 ? Math.round((safe / atRisk) * 10) / 10 : safe
  return { observations, ratio, hidden: observations < minObservations }
}

// Split a period into two equal halves: previous and current.
export function equalPeriodSplit(from, to) {
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  const mid = start + (end - start) / 2
  return { start, mid, end }
}

// Trend of the Safe/At-Risk ratio, current half against the previous equal half.
// Returns a flat "insufficient" trend when either half has too few observations
// (this replaces the old "up 100%" shown whenever the first half was zero).
export function safeRatioTrend(observations, from, to, minObservations = MIN_RATIO_OBSERVATIONS) {
  const flat = { direction: 'flat', change: 0, percent: 0, insufficient: true }
  if (!observations || observations.length === 0) return flat
  const { mid, start, end } = equalPeriodSplit(from, to)
  const tally = { prev: { safe: 0, atRisk: 0 }, cur: { safe: 0, atRisk: 0 } }
  observations.forEach(o => {
    const t = new Date(o.date).getTime()
    if (Number.isNaN(t) || t < start || t > end) return
    const bucket = t < mid ? tally.prev : tally.cur
    if (o.type === 'Safe') bucket.safe++
    else if (o.type === 'At-Risk') bucket.atRisk++
  })
  const prev = safeAtRiskRatio({ ...tally.prev, minObservations })
  const cur = safeAtRiskRatio({ ...tally.cur, minObservations })
  if (prev.hidden || cur.hidden || prev.ratio === 0) return flat
  const change = Math.round((cur.ratio - prev.ratio) * 10) / 10
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    change,
    percent: Math.abs(Math.round((change / prev.ratio) * 100)),
    insufficient: false
  }
}

// ---------------------------------------------------------------------------
// SIF Potential: one event list, count first, percent only at 10 or more events
// ---------------------------------------------------------------------------
const isYes = val => val === 'Yes' || val === true
const hasSifClass = c => !!c && (c.includes('PSIF') || c.includes('SIF'))

export function isSifPotentialEvent(row) {
  return isYes(row?.stky_event) || isYes(row?.sif_potential) || hasSifClass(row?.psif_classification)
}

// Incidents keep their own flags and do not use sif_potential (unchanged behavior).
export function isSifIncident(row) {
  return isYes(row?.is_sif) || isYes(row?.is_sif_p) || isYes(row?.stky_event) || hasSifClass(row?.psif_classification)
}

export function sifPotential({ goodCatch = [], incidents = [], atRiskBbs = [], propertyDamage = [] }) {
  const count =
    goodCatch.filter(isSifPotentialEvent).length +
    incidents.filter(isSifIncident).length +
    atRiskBbs.filter(b => isYes(b.stky_event)).length +
    propertyDamage.filter(isSifPotentialEvent).length
  const total = goodCatch.length + incidents.length + propertyDamage.length + atRiskBbs.length
  const rate = total > 0 ? Math.round((count / total) * 100) : 0
  return {
    count,
    total,
    rate,
    showPercent: total >= MIN_SIF_EVENTS_FOR_PERCENT,
    label: 'Potential serious events found early'
  }
}

// ---------------------------------------------------------------------------
// Lead / Lag: lagging = incidents (open and closed once each) + property damage
// ---------------------------------------------------------------------------
export function leadLag({ leadingTotal = 0, incidents = 0, propertyDamage = 0 }) {
  const lagging = incidents + propertyDamage
  if (lagging === 0) {
    return { state: 'no-lagging', lagging, leading: leadingTotal, ratio: null, display: 'No lagging events' }
  }
  const ratio = Math.round((leadingTotal / lagging) * 10) / 10
  return { state: 'ok', lagging, leading: leadingTotal, ratio, display: `${ratio}:1` }
}

// ---------------------------------------------------------------------------
// Open Items (follow-through)
// ---------------------------------------------------------------------------
export function sailTargetDate(row) {
  return row?.target_completion_date || row?.target_date || null
}

const isoDay = d => new Date(d).toISOString().slice(0, 10)

export function isPastTarget(row, now = new Date()) {
  const target = sailTargetDate(row)
  if (!target || ['Closed', 'Complete'].includes(row.status)) return false
  return isoDay(target) < isoDay(now)
}

export function openItemsSummary({ openCount = 0, sail = [], over30Days = 0, now = new Date() }) {
  return {
    open: openCount,
    pastTarget: sail.filter(s => isPastTarget(s, now)).length,
    over30Days,
    label: 'Follow-through: items still open'
  }
}

// ---------------------------------------------------------------------------
// Training: percent of assigned courses completed (EN/ES twins count once)
// ---------------------------------------------------------------------------
export function trainingProgress({ users = [], courses = [], requiredByCompany = {}, individual = [], completions = [], now = new Date() }) {
  const courseInfo = new Map(courses.map(c => [c.id, c]))
  const keyOf = courseId => {
    const c = courseInfo.get(courseId)
    return c ? (c.course_group || c.id) : null // unknown or inactive course: not counted
  }
  const done = new Set(completions.map(c => `${c.user_id}|${keyOf(c.course_id) ?? c.course_id}`))
  const assigned = new Map() // "user|courseKey" -> earliest due date or null

  users.filter(u => u.active !== false).forEach(u => {
    ;(requiredByCompany[u.company_id] || []).forEach(courseId => {
      const k = keyOf(courseId)
      if (k && !assigned.has(`${u.id}|${k}`)) assigned.set(`${u.id}|${k}`, null)
    })
  })
  const activeIds = new Set(users.filter(u => u.active !== false).map(u => u.id))
  individual.forEach(a => {
    const k = keyOf(a.course_id)
    if (!k || !activeIds.has(a.user_id)) return
    const key = `${a.user_id}|${k}`
    const prior = assigned.get(key)
    const due = a.due_date || null
    if (!assigned.has(key) || (due && (!prior || due < prior))) assigned.set(key, due)
  })

  let completed = 0
  let pastDue = 0
  assigned.forEach((due, key) => {
    if (done.has(key)) completed++
    else if (due && isoDay(due) < isoDay(now)) pastDue++
  })
  const total = assigned.size
  return {
    state: total === 0 ? 'none-assigned' : 'ok',
    assigned: total,
    completed,
    pastDue,
    percent: total === 0 ? null : Math.round((completed / total) * 100)
  }
}

// ---------------------------------------------------------------------------
// Risk bands (shared by Risk Load, the 30-Day Risk Index and card colors)
// ---------------------------------------------------------------------------
export function riskBand(score) {
  if (score <= 30) return { key: 'good', word: 'Low' }
  if (score <= 60) return { key: 'warning', word: 'Watch' }
  return { key: 'danger', word: 'Elevated' }
}

// Number of days the selected range covers (year = 'All' means unbounded).
export function rangeDays(year, now = new Date()) {
  if (!year || year === 'All') return Infinity
  const start = Date.UTC(Number(year), 0, 1)
  const end = Math.min(now.getTime(), Date.UTC(Number(year), 11, 31))
  return Math.max(0, Math.floor((end - start) / DAY_MS) + 1)
}

export function riskIndex30Day(value, year, now = new Date()) {
  const days = rangeDays(year, now)
  const band = riskBand(value)
  return { value, band: band.key, word: band.word, visible: days >= MIN_FORECAST_RANGE_DAYS, label: '30-Day Risk Index' }
}

// ---------------------------------------------------------------------------
// Leading Culture Score (leading inputs only) and the separate Outcomes view
// ---------------------------------------------------------------------------
export function leadingCultureScore({ safeRatio = 0, jobStopRate: stopRate = null, reports = 0, overdueSail = 0 }) {
  let score = 70
  if (safeRatio >= 10) score += 10
  else if (safeRatio >= 5) score += 7
  else if (safeRatio >= 3) score += 5
  else if (safeRatio >= 2) score += 3
  else if (safeRatio >= 1) score += 1

  if (stopRate !== null) {
    if (stopRate >= 80) score += 10
    else if (stopRate >= 60) score += 8
    else if (stopRate >= 40) score += 5
    else if (stopRate >= 20) score += 2
  }

  if (reports >= 20) score += 10
  else if (reports >= 10) score += 7
  else if (reports >= 5) score += 4
  else if (reports >= 1) score += 2

  // Follow-through
  if (overdueSail >= 5) score -= 10
  else if (overdueSail >= 3) score -= 7
  else if (overdueSail >= 1) score -= 3

  return Math.min(100, Math.max(0, score))
}

export function cultureOutcomes({ incidents = 0, openItems = 0, overdueSail = 0 }) {
  return { incidents, openItems, overdueSail }
}

// ---------------------------------------------------------------------------
// TrueCost card wording
// ---------------------------------------------------------------------------
export function trueCostDisplay({ costed = 0, incidents = 0 }) {
  if (!costed) return { state: 'none-entered', text: 'No costs entered yet' }
  return { state: 'ok', text: incidents >= costed ? `${costed} of ${incidents} incidents costed` : `${costed} incidents costed` }
}
