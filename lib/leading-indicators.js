// ============================================================================
// lib/leading-indicators.js  (DASHBOARD repo)
//
// Leading indicators that should drive action BEFORE the next incident.
// Server-only: called from /api/dashboard-metrics?section=leading with the
// service-role client, company already enforced by the route.
//
// Windows: last 30 days vs the 30 days before that (Alaska dates).
// computeLeadingIndicators() is pure (rows in, numbers + signals out) so it can be
// tested without a database. fetchLeadingRows() does the reads.
// ============================================================================

const DAY = 86400000
const CLOSED = /^(closed|completed?|verified( effective)?|cancel+ed|void)$/i

export function truthy(v) {
  if (v === true) return true
  if (v === null || v === undefined) return false
  return /^(y|yes|true|1)$/i.test(String(v).trim())
}
const has = (v) => typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined
function dayOf(row, ...cols) {
  for (const c of cols) {
    const v = row?.[c]
    if (v) { const t = Date.parse(String(v).length === 10 ? v + 'T12:00:00Z' : v); if (!Number.isNaN(t)) return t }
  }
  return null
}
function split(rows, now, ...cols) {
  const cur = [], prev = []
  for (const r of rows || []) {
    const t = dayOf(r, ...cols)
    if (t === null) continue
    const age = (now - t) / DAY
    if (age < 0) cur.push(r)
    else if (age <= 30) cur.push(r)
    else if (age <= 60) prev.push(r)
  }
  return { cur, prev }
}
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
function change(cur, prev) {
  if (!prev) return cur ? null : 0
  return Math.round(((cur - prev) / prev) * 100)
}
function isOverdue(due, now) {
  if (!due) return false
  const t = Date.parse(String(due).length === 10 ? due + 'T23:59:59Z' : due)
  return !Number.isNaN(t) && t < now
}
function daysSince(v, now) {
  const t = Date.parse(String(v || '').length === 10 ? v + 'T12:00:00Z' : v)
  return Number.isNaN(t) ? null : Math.floor((now - t) / DAY)
}

export function computeLeadingIndicators(rows, nowMs = Date.now()) {
  const now = nowMs
  const r = rows || {}

  // ---- THA quality -------------------------------------------------------
  const tha = split(r.tha, now, 'date', 'created_at')
  const scored = (xs) => xs.map(x => Number(x.quality_score)).filter(n => Number.isFinite(n) && n > 0)
  const closed30 = tha.cur.filter(x => CLOSED.test(String(x.status || '')))
  const autoClosed30 = closed30.filter(x => /^auto-closed/i.test(String(x.closed_by || '')))
  const withAar30 = closed30.filter(x => has(x.aar_went_well) || has(x.aar_didnt_go_as_planned) || has(x.aar_how_improve))
  const low30 = tha.cur.filter(x => /^[DF]/i.test(String(x.quality_grade || '')))
  const thaOut = {
    count30: tha.cur.length, countPrev: tha.prev.length,
    avgScore30: avg(scored(tha.cur)), avgScorePrev: avg(scored(tha.prev)),
    lowGradePct30: pct(low30.length, tha.cur.length),
    closed30: closed30.length,
    autoClosePct30: pct(autoClosed30.length, closed30.length),
    aarPct30: pct(withAar30.length, closed30.length),
    stopTriggerPct30: pct(tha.cur.filter(x => has(x.stop_work_trigger)).length, tha.cur.length),
  }

  // ---- Near misses / good catches --------------------------------------
  const nm = split(r.nearMiss, now, 'date', 'created_at')
  const nmHigh30 = nm.cur.filter(x => truthy(x.high_energy_present) || /sif|pSIF/i.test(String(x.psif_classification || '')))
  const nmOut = { count30: nm.cur.length, countPrev: nm.prev.length, change: change(nm.cur.length, nm.prev.length), highEnergy30: nmHigh30.length }

  // ---- BBS ---------------------------------------------------------------
  const bbs = split(r.bbs, now, 'observation_date', 'created_at')
  const atRisk = (x) => /at[- ]?risk|unsafe/i.test(`${x.observation_type || ''} ${x.observation_category || ''}`)
  const bbsOut = {
    count30: bbs.cur.length, countPrev: bbs.prev.length, change: change(bbs.cur.length, bbs.prev.length),
    atRiskPct30: pct(bbs.cur.filter(atRisk).length, bbs.cur.length),
    jobStops30: bbs.cur.filter(x => truthy(x.job_stop_required)).length,
    lastDaysAgo: (r.bbs || []).reduce((m, x) => { const d = daysSince(x.observation_date || x.created_at, now); return d === null ? m : (m === null ? d : Math.min(m, d)) }, null),
  }

  // ---- Stop & Take 5 / Hazard IDs ---------------------------------------
  const st5 = split(r.st5, now, 'date', 'created_at')
  const hz = split(r.hazards, now, 'date', 'created_at')
  const st5Out = { count30: st5.cur.length, countPrev: st5.prev.length, change: change(st5.cur.length, st5.prev.length), notSafe30: st5.cur.filter(x => x.safe_to_proceed !== null && x.safe_to_proceed !== undefined && !truthy(x.safe_to_proceed)).length }
  const hzOut = { count30: hz.cur.length, countPrev: hz.prev.length, change: change(hz.cur.length, hz.prev.length), high30: hz.cur.filter(x => /high|extreme|critical/i.test(String(x.threat_level || '')) || truthy(x.high_energy_present)).length }

  // ---- SAIL (all open items) ------------------------------------------
  const sailOpen = (r.sail || []).filter(x => !CLOSED.test(String(x.status || '').trim()))
  const sailOver = sailOpen.filter(x => isOverdue(x.target_completion_date, now))
  const sailOut = {
    open: sailOpen.length, overdue: sailOver.length,
    overdue30: sailOver.filter(x => (daysSince(x.target_completion_date, now) || 0) > 30).length,
    oldestOpenDays: sailOpen.reduce((m, x) => Math.max(m, daysSince(x.date_opened || x.date || x.created_at, now) || 0), 0),
  }

  // ---- Corrective actions (aging) -------------------------------------
  const caOpen = (r.ca || []).filter(x => !CLOSED.test(String(x.status || '').trim()) && !CLOSED.test(String(x.action_status || '').trim()))
  const caDue = (x) => x.due_date || x.target_date
  const caOver = caOpen.filter(x => isOverdue(caDue(x), now))
  const caOut = {
    open: caOpen.length, overdue: caOver.length,
    overdue30: caOver.filter(x => (daysSince(caDue(x), now) || 0) > 30).length,
    oldestOverdueDays: caOver.reduce((m, x) => Math.max(m, daysSince(caDue(x), now) || 0), 0),
    noOwnerEmail: caOpen.filter(x => !/@/.test(String(x.action_owner_email || ''))).length,
    nags7: (r.nags || []).length,
  }

  // ---- Incidents (lagging, for context) -------------------------------
  const inc = split(r.incidents, now, 'incident_date', 'created_at')
  const inc90 = (r.incidents || []).filter(x => { const t = dayOf(x, 'incident_date', 'created_at'); return t !== null && (now - t) / DAY <= 90 })
  const nm90 = (r.nearMiss || []).filter(x => { const t = dayOf(x, 'date', 'created_at'); return t !== null && (now - t) / DAY <= 90 })
  const incOut = {
    count30: inc.cur.length, countPrev: inc.prev.length,
    nearMissPerIncident90: inc90.length ? Math.round((nm90.length / inc90.length) * 10) / 10 : null,
    incidents90: inc90.length, nearMiss90: nm90.length,
  }

  // ---- Signals: what to do this week ----------------------------------
  const s = []
  const add = (severity, key, title, detail, action) => s.push({ severity, key, title, detail, action })
  if (thaOut.count30 === 0 && (thaOut.countPrev > 0 || bbsOut.count30 > 0)) add('high', 'tha-none', 'No THAs in the last 30 days', `Previous 30 days: ${thaOut.countPrev}.`, 'Confirm crews are writing THAs on the portal before work starts.')
  if (thaOut.avgScore30 !== null && thaOut.avgScore30 < 70) add('high', 'tha-quality', `THA quality is low (avg ${thaOut.avgScore30}/100)`, 'THAs are listing hazards without matching controls for each step.', 'Supervisor spot-checks 3 THAs this week, on site, with the crew: how could someone get hurt on each step, and what stops it?')
  else if (thaOut.avgScore30 !== null && thaOut.avgScorePrev !== null && thaOut.avgScorePrev - thaOut.avgScore30 >= 8) add('medium', 'tha-drop', `THA quality is falling (${thaOut.avgScorePrev} → ${thaOut.avgScore30})`, 'Down 8+ points against the previous 30 days.', 'Review the lowest-scoring THAs at the next toolbox talk.')
  if ((thaOut.lowGradePct30 ?? 0) >= 25) add('high', 'tha-low-grade', `${thaOut.lowGradePct30}% of THAs graded D or F`, 'Canned or copy-paste THAs: these are the jobs most likely to get someone hurt.', 'Pull the D/F THAs, find the crews, and coach in the field, not by email.')
  if (thaOut.closed30 >= 5 && (thaOut.aarPct30 ?? 100) < 50) add('medium', 'tha-aar', `Only ${thaOut.aarPct30}% of closed THAs have an after-action review`, `${thaOut.autoClosePct30 ?? 0}% were auto-closed at 48 hours. Lessons from the job are being lost.`, 'Crew leads close their own THAs at end of shift and answer the 3 after-action questions.')
  if (nmOut.count30 === 0 && (thaOut.count30 > 0 || bbsOut.count30 > 0)) add('high', 'nm-none', 'No near misses reported in 30 days', 'Work is happening but nothing is being reported. Silence is not safety.', 'Ask each crew for one good catch this week and recognise the first ones in public.')
  else if (nmOut.countPrev >= 5 && (nmOut.change ?? 0) <= -40) add('medium', 'nm-drop', `Near-miss reporting down ${Math.abs(nmOut.change)}%`, `${nmOut.countPrev} → ${nmOut.count30} against the previous 30 days.`, 'Find out why: fear of blame, no time, or no signal. Fix that reason.')
  if (nmOut.highEnergy30 > 0) add('high', 'nm-high-energy', `${nmOut.highEnergy30} high-energy / SIF-potential near miss${nmOut.highEnergy30 === 1 ? '' : 'es'}`, 'These are the precursors to serious injuries and fatalities.', 'Review each one with the crew. Is there a direct control (guard, isolation, barrier) or only a procedure?')
  if (hzOut.high30 > 0) add('medium', 'hz-high', `${hzOut.high30} high-threat hazard${hzOut.high30 === 1 ? '' : 's'} reported`, 'Confirm each has a fix in SAIL with an owner and date.', 'Check SAIL for an open item against each high-threat hazard.')
  if (bbsOut.count30 === 0 && (bbsOut.countPrev > 0 || thaOut.count30 > 0)) add('medium', 'bbs-none', 'No BBS observations in 30 days', bbsOut.lastDaysAgo !== null ? `Last one ${bbsOut.lastDaysAgo} days ago.` : 'None on record.', 'Each supervisor does 2 observations this week and talks with the worker.')
  else if ((bbsOut.atRiskPct30 ?? 0) >= 30) add('medium', 'bbs-at-risk', `${bbsOut.atRiskPct30}% of BBS observations were at-risk`, 'At-risk behaviour is common in the field right now.', 'Find the top at-risk category and fix the condition behind it.')
  if (sailOut.overdue > 0) add(sailOut.overdue >= 5 || sailOut.overdue30 > 0 ? 'high' : 'medium', 'sail-overdue', `${sailOut.overdue} SAIL item${sailOut.overdue === 1 ? '' : 's'} overdue`, sailOut.overdue30 ? `${sailOut.overdue30} more than 30 days late.` : 'Hazards that someone agreed to fix are still there.', 'Each owner gives a new date or closes it this week.')
  if (caOut.overdue > 0) add(caOut.overdue30 > 0 ? 'high' : 'medium', 'ca-overdue', `${caOut.overdue} corrective action${caOut.overdue === 1 ? '' : 's'} overdue`, `${caOut.overdue30} more than 30 days late; oldest ${caOut.oldestOverdueDays} days. Owners are emailed daily until closed.`, 'Managers: ask each owner for the close date today.')
  if (caOut.noOwnerEmail > 0) add('low', 'ca-no-owner', `${caOut.noOwnerEmail} open corrective action${caOut.noOwnerEmail === 1 ? ' has' : 's have'} no owner email`, 'Nobody is being reminded about these.', 'Assign an owner with an email address in the investigation.')
  if (incOut.count30 > incOut.countPrev && incOut.count30 >= 2 && ((nmOut.change ?? 0) < 0 || (bbsOut.change ?? 0) < 0 || (thaOut.avgScorePrev !== null && thaOut.avgScore30 !== null && thaOut.avgScore30 < thaOut.avgScorePrev))) add('high', 'lead-lag', 'Incidents are rising while leading indicators fall', `Incidents ${incOut.countPrev} → ${incOut.count30} in 30 days.`, 'Stand-down or field leadership visit: THA quality, near-miss reporting and BBS are the early warning.')
  if (incOut.incidents90 > 0 && incOut.nearMissPerIncident90 !== null && incOut.nearMissPerIncident90 < 3) add('medium', 'nm-ratio', `Only ${incOut.nearMissPerIncident90} near miss${incOut.nearMissPerIncident90 === 1 ? '' : 'es'} reported per incident (90 days)`, 'Healthy reporting cultures report many near misses for every incident.', 'Make near-miss reporting easy and blame-free; follow up every one.')

  const weight = { high: 12, medium: 6, low: 2 }
  const order = { high: 0, medium: 1, low: 2 }
  s.sort((a, b) => order[a.severity] - order[b.severity])
  const index = Math.max(0, 100 - s.reduce((t, x) => t + weight[x.severity], 0))
  const band = index >= 85 ? 'Strong' : index >= 65 ? 'Watch' : index >= 40 ? 'At risk' : 'Act now'

  return { generatedAt: new Date(now).toISOString(), index, band, signals: s, tha: thaOut, nearMiss: nmOut, bbs: bbsOut, st5: st5Out, hazards: hzOut, sail: sailOut, ca: caOut, incidents: incOut }
}

// --------------------------------------------------------------------------
// Reads (service role). Company is exact-match on each table's own column.
// --------------------------------------------------------------------------
const SOURCES = {
  tha:       { table: 'tha_assessments',      col: 'company',        date: 'created_at', select: 'company,date,created_at,status,closed_by,quality_score,quality_grade,aar_went_well,aar_didnt_go_as_planned,aar_how_improve,stop_work_trigger' },
  nearMiss:  { table: 'good_catch_near_miss', col: 'company',        date: 'created_at', select: 'company,date,created_at,high_energy_present,psif_classification', days: 100 },
  bbs:       { table: 'bbs_observations',     col: 'client_company', date: 'created_at', select: 'client_company,observation_date,created_at,observation_type,observation_category,job_stop_required' },
  st5:       { table: 'stop_take_5',          col: 'company',        date: 'created_at', select: 'company,date,created_at,safe_to_proceed' },
  hazards:   { table: 'hazard_id_reports',    col: 'company',        date: 'created_at', select: 'company,date,created_at,threat_level,high_energy_present' },
  incidents: { table: 'incidents',            col: 'company_name',   date: 'created_at', select: 'company_name,incident_date,created_at', days: 100 },
}

async function pageAll(q) {
  const out = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await q().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function fetchLeadingRows(admin, company = 'All', nowMs = Date.now()) {
  const rows = {}
  const errors = []
  await Promise.all(Object.entries(SOURCES).map(async ([key, src]) => {
    const since = new Date(nowMs - (src.days || 65) * DAY).toISOString()
    try {
      rows[key] = await pageAll(() => {
        let q = admin.from(src.table).select(src.select).gte(src.date, since).order(src.date, { ascending: false })
        if (company !== 'All') q = q.eq(src.col, company)
        return q
      })
    } catch (e) { rows[key] = []; errors.push(`${src.table}: ${e.message || e}`) }
  }))

  try {
    rows.sail = await pageAll(() => {
      let q = admin.from('sail_log').select('client_company,status,target_completion_date,date_opened,date,created_at').order('created_at', { ascending: false })
      if (company !== 'All') q = q.eq('client_company', company)
      return q
    })
  } catch (e) { rows.sail = []; errors.push('sail_log: ' + (e.message || e)) }

  try {
    const cas = await pageAll(() => admin.from('investigation_corrective_actions')
      .select('id,incident_id,status,action_status,due_date,target_date,action_owner_email').order('id'))
    const incIds = [...new Set(cas.map(c => c.incident_id).filter(Boolean))]
    const incMap = new Map()
    for (let i = 0; i < incIds.length; i += 200) {
      const chunk = incIds.slice(i, i + 200)
      const uuids = chunk.filter(x => /^[0-9a-f-]{36}$/i.test(x))
      const nums = chunk.filter(x => !/^[0-9a-f-]{36}$/i.test(x))
      if (nums.length) { const { data } = await admin.from('incidents').select('id,incident_id,company_name').in('incident_id', nums); (data || []).forEach(d => incMap.set(d.incident_id, d.company_name)) }
      if (uuids.length) { const { data } = await admin.from('incidents').select('id,incident_id,company_name').in('id', uuids); (data || []).forEach(d => incMap.set(d.id, d.company_name)) }
    }
    // Orphan CAs (incident deleted) are not counted for any company.
    rows.ca = cas.filter(c => incMap.has(c.incident_id) && (company === 'All' || incMap.get(c.incident_id) === company))
      .map(c => ({ ...c, _company: incMap.get(c.incident_id) }))
    const caIds = new Set(rows.ca.map(c => c.id))
    const { data: nags } = await admin.from('ca_nag_log').select('ca_id,nag_date')
      .eq('mode', 'live').eq('status', 'sent').gte('created_at', new Date(nowMs - 7 * DAY).toISOString())
    rows.nags = (nags || []).filter(n => caIds.has(n.ca_id))
  } catch (e) { rows.ca = rows.ca || []; rows.nags = []; errors.push('corrective actions: ' + (e.message || e)) }

  return { rows, errors }
}

export async function getLeadingIndicators(admin, company = 'All', nowMs = Date.now()) {
  const { rows, errors } = await fetchLeadingRows(admin, company, nowMs)
  const result = computeLeadingIndicators(rows, nowMs)
  result.company = company
  result.errors = errors

  // All companies: rank who needs attention first (each company computed on its own rows).
  if (company === 'All') {
    const byCo = new Map()
    const push = (key, name, row) => {
      if (!name) return
      if (!byCo.has(name)) byCo.set(name, { tha: [], nearMiss: [], bbs: [], st5: [], hazards: [], incidents: [], sail: [], ca: [], nags: [] })
      byCo.get(name)[key].push(row)
    }
    for (const [key, src] of Object.entries(SOURCES)) for (const r of rows[key] || []) push(key, r[src.col], r)
    for (const r of rows.sail || []) push('sail', r.client_company, r)
    for (const r of rows.ca || []) push('ca', r._company, r)
    result.companies = [...byCo.entries()]
      .map(([name, rs]) => { const c = computeLeadingIndicators(rs, nowMs); return { company: name, index: c.index, band: c.band, high: c.signals.filter(x => x.severity === 'high').length, top: c.signals[0]?.title || null, thaAvg: c.tha.avgScore30, nearMiss30: c.nearMiss.count30, sailOverdue: c.sail.overdue, caOverdue: c.ca.overdue } })
      .filter(c => c.thaAvg !== null || c.nearMiss30 > 0 || c.sailOverdue > 0 || c.caOverdue > 0)
      .sort((a, b) => a.index - b.index)
      .slice(0, 12)
  }
  return result
}
