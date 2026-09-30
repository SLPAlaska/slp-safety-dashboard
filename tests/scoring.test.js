import test from 'node:test'
import assert from 'node:assert/strict'
import {
  jobStopRate, safeAtRiskRatio, safeRatioTrend, sifPotential, leadLag,
  isPastTarget, sailTargetDate, openItemsSummary, trainingProgress,
  riskBand, rangeDays, riskIndex30Day, leadingCultureScore, trueCostDisplay
} from '../lib/scoring.js'

const NOW = new Date('2026-09-30T12:00:00Z')

test('Job Stop Rate uses at-risk observations as the only denominator', () => {
  assert.equal(jobStopRate({ jobStops: 2, atRisk: 8 }).rate, 25)
  assert.equal(jobStopRate({ jobStops: 5, atRisk: 5 }).rate, 100)
})

test('Job Stop Rate shows "none yet" when there are no at-risk observations', () => {
  const r = jobStopRate({ jobStops: 0, atRisk: 0 })
  assert.equal(r.state, 'none-yet')
  assert.equal(r.rate, null)
  assert.equal(r.detail, 'None yet')
})

test('Safe/At-Risk ratio is hidden under 10 observations', () => {
  assert.equal(safeAtRiskRatio({ safe: 5, atRisk: 4 }).hidden, true)
  const shown = safeAtRiskRatio({ safe: 20, atRisk: 4 })
  assert.equal(shown.hidden, false)
  assert.equal(shown.ratio, 5)
  assert.equal(shown.observations, 24)
})

test('Safe/At-Risk ratio with no at-risk observations returns the safe count', () => {
  assert.equal(safeAtRiskRatio({ safe: 12, atRisk: 0 }).ratio, 12)
})

function obs(dateStr, type, n) {
  return Array.from({ length: n }, () => ({ date: dateStr, type }))
}

test('Safe/At-Risk trend compares against the previous equal period', () => {
  const rows = [...obs('2026-01-10', 'Safe', 10), ...obs('2026-01-11', 'At-Risk', 5), // ratio 2
                ...obs('2026-03-10', 'Safe', 20), ...obs('2026-03-11', 'At-Risk', 5)] // ratio 4
  const t = safeRatioTrend(rows, '2026-01-01', '2026-04-01')
  assert.equal(t.direction, 'up')
  assert.equal(t.percent, 100)
  assert.equal(t.insufficient, false)
})

test('Safe/At-Risk trend is flat, not "up 100%", when the previous period has no data', () => {
  const rows = [...obs('2026-03-10', 'Safe', 20), ...obs('2026-03-11', 'At-Risk', 5)]
  const t = safeRatioTrend(rows, '2026-01-01', '2026-04-01')
  assert.equal(t.direction, 'flat')
  assert.equal(t.insufficient, true)
})

test('SIF Potential shows the count first and the percent only at 10 or more events', () => {
  const small = sifPotential({ goodCatch: [{ stky_event: 'Yes' }, {}, {}, {}, {}] })
  assert.equal(small.count, 1)
  assert.equal(small.total, 5)
  assert.equal(small.showPercent, false)
  const large = sifPotential({ goodCatch: [{ stky_event: 'Yes' }, ...Array.from({ length: 9 }, () => ({}))] })
  assert.equal(large.total, 10)
  assert.equal(large.showPercent, true)
  assert.equal(large.rate, 10)
})

test('SIF Potential counts one shared event list', () => {
  const r = sifPotential({
    goodCatch: [{ psif_classification: 'PSIF' }, { sif_potential: true }],
    incidents: [{ is_sif: 'Yes' }, { sif_potential: 'Yes' }], // incidents do not use sif_potential
    atRiskBbs: [{ stky_event: true }, { stky_event: 'No' }],
    propertyDamage: [{ stky_event: 'Yes' }]
  })
  assert.equal(r.count, 5)
  assert.equal(r.total, 7)
})

test('Lead/Lag lagging total is incidents plus property damage only', () => {
  const r = leadLag({ leadingTotal: 60, incidents: 4, propertyDamage: 2 })
  assert.equal(r.lagging, 6)
  assert.equal(r.ratio, 10)
  assert.equal(r.display, '10:1')
})

test('Lead/Lag does not count open incidents twice (open and closed are added once)', () => {
  // caller passes open + closed once; 3 open + 2 closed = 5 incidents
  assert.equal(leadLag({ leadingTotal: 50, incidents: 3 + 2, propertyDamage: 0 }).lagging, 5)
})

test('Lead/Lag shows "No lagging events" when lagging is 0', () => {
  const r = leadLag({ leadingTotal: 40, incidents: 0, propertyDamage: 0 })
  assert.equal(r.state, 'no-lagging')
  assert.equal(r.ratio, null)
  assert.equal(r.display, 'No lagging events')
})

test('Open Items read target_completion_date and fall back to target_date', () => {
  assert.equal(sailTargetDate({ target_completion_date: '2026-09-01', target_date: '2026-10-01' }), '2026-09-01')
  assert.equal(sailTargetDate({ target_date: '2026-10-01' }), '2026-10-01')
  assert.equal(sailTargetDate({}), null)
})

test('Open Items count past target only for open items with a target in the past', () => {
  const sail = [
    { status: 'Open', target_completion_date: '2026-09-01' },
    { status: 'In Progress', target_completion_date: '2026-09-29' },
    { status: 'Open', target_completion_date: '2026-10-15' },
    { status: 'Closed', target_completion_date: '2026-01-01' },
    { status: 'Open' }
  ]
  assert.equal(isPastTarget(sail[0], NOW), true)
  assert.equal(isPastTarget(sail[3], NOW), false)
  const s = openItemsSummary({ openCount: 7, sail, over30Days: 3, now: NOW })
  assert.equal(s.pastTarget, 2)
  assert.equal(s.over30Days, 3)
  assert.equal(s.open, 7)
})

test('Open Items: a target of today is not yet past target', () => {
  assert.equal(isPastTarget({ status: 'Open', target_completion_date: '2026-09-30' }, NOW), false)
})

test('Training is percent of assigned, with EN/ES twins counted once and a past-due count', () => {
  const users = [{ id: 'u1', company_id: 'c1', active: true }, { id: 'u2', company_id: 'c1', active: true }, { id: 'u3', company_id: 'c1', active: false }]
  const courses = [
    { id: 'a-en', course_group: 'a' }, { id: 'a-es', course_group: 'a' }, { id: 'b', course_group: null }
  ]
  const requiredByCompany = { c1: ['a-en', 'a-es'] } // twins: one assignment per learner
  const individual = [{ user_id: 'u1', course_id: 'b', due_date: '2026-09-01' }]
  const completions = [{ user_id: 'u1', course_id: 'a-es' }, { user_id: 'u2', course_id: 'a-en' }]
  const t = trainingProgress({ users, courses, requiredByCompany, individual, completions, now: NOW })
  // u1: a (done), b (past due); u2: a (done). Inactive u3 excluded.
  assert.equal(t.assigned, 3)
  assert.equal(t.completed, 2)
  assert.equal(t.pastDue, 1)
  assert.equal(t.percent, 67)
})

test('Training shows "none-assigned" instead of 0 or 100 percent when nothing is assigned', () => {
  const t = trainingProgress({})
  assert.equal(t.state, 'none-assigned')
  assert.equal(t.percent, null)
})

test('Risk bands: 30 or under is Low, 31 to 60 Watch, above 60 Elevated', () => {
  assert.equal(riskBand(30).word, 'Low')
  assert.equal(riskBand(33).word, 'Watch')
  assert.equal(riskBand(33).key, 'warning')
  assert.equal(riskBand(61).word, 'Elevated')
})

test('30-Day Risk Index is hidden for ranges shorter than 90 days', () => {
  assert.equal(riskIndex30Day(40, '2026', new Date('2026-02-10T00:00:00Z')).visible, false)
  assert.equal(riskIndex30Day(40, '2026', new Date('2026-09-30T00:00:00Z')).visible, true)
  assert.equal(riskIndex30Day(40, 'All', NOW).visible, true)
  assert.equal(rangeDays('2025', NOW), 365)
})

test('Leading Culture Score ignores incidents and SIF, and rewards more reporting', () => {
  const base = leadingCultureScore({ safeRatio: 5, jobStopRate: 50, reports: 5 })
  assert.equal(base, 70 + 7 + 5 + 4)
  assert.ok(leadingCultureScore({ safeRatio: 5, jobStopRate: 50, reports: 25 }) > base)
  assert.equal(leadingCultureScore({ safeRatio: 0, jobStopRate: null, reports: 0, overdueSail: 5 }), 60)
  assert.equal(leadingCultureScore({ safeRatio: 100, jobStopRate: 100, reports: 100 }), 100)
})

test('TrueCost shows "No costs entered yet" and "X of Y incidents costed"', () => {
  assert.equal(trueCostDisplay({ costed: 0, incidents: 4 }).text, 'No costs entered yet')
  assert.equal(trueCostDisplay({ costed: 3, incidents: 9 }).text, '3 of 9 incidents costed')
})
