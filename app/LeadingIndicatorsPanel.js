'use client'

// Leading Indicators: what to act on this week, before the next incident.
// Data: /api/dashboard-metrics?section=leading (server-side, company enforced).
// Steel/blue only; red/amber appear only as status markers.

const STEEL = { navy: '#1e3a5f', steel: '#2d5a87', light: '#5b8fc7', pale: '#cfe0f3', ink: '#0f1b2d', card: '#13233a', line: '#2b4566' }
const SEV = {
  high:   { label: 'ACT NOW', color: '#f87171', bar: '#dc2626' },
  medium: { label: 'WATCH',   color: '#fbbf24', bar: '#d97706' },
  low:    { label: 'NOTE',    color: '#93c5fd', bar: '#5b8fc7' },
}

function Delta({ cur, prev, goodUp = true, suffix = '' }) {
  if (prev === null || prev === undefined || cur === null || cur === undefined) return null
  const diff = cur - prev
  if (diff === 0) return <span style={{ color: '#94a3b8', fontSize: 11 }}> → same</span>
  const good = goodUp ? diff > 0 : diff < 0
  return <span style={{ color: good ? '#86efac' : '#fca5a5', fontSize: 11, fontWeight: 700 }}> {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{suffix}</span>
}

function Tile({ label, value, sub, warn }) {
  return (
    <div style={{ background: STEEL.ink, border: `1px solid ${warn ? '#b45309' : STEEL.line}`, borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: '#8fb3dc' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? '#fbbf24' : '#e6eef8', marginTop: 2 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function LeadingIndicatorsPanel({ leading, loading, error, onPickCompany }) {
  if (loading) return <div className="panel" style={{ marginBottom: 16 }}><div className="panel-content" style={{ color: '#94a3b8' }}>Loading leading indicators…</div></div>
  if (error) return <div className="panel" style={{ marginBottom: 16 }}><div className="panel-content" style={{ color: '#fca5a5' }}>Leading indicators unavailable: {error}</div></div>
  if (!leading) return null
  const L = leading
  const bandColor = L.index >= 85 ? '#86efac' : L.index >= 65 ? '#93c5fd' : L.index >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div className="panel" style={{ marginBottom: 16, border: `1px solid ${STEEL.line}` }}>
      <div className="panel-header" style={{ background: `linear-gradient(135deg, ${STEEL.navy} 0%, ${STEEL.steel} 100%)`, color: '#ffffff', fontSize: 14 }}>
        Leading Indicators — act before the next incident
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: STEEL.pale }}>Last 30 days vs previous 30 • {L.company === 'All' ? 'All companies' : L.company}</span>
      </div>
      <div className="panel-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 16, alignItems: 'start' }} className="li-top">
          <div style={{ background: STEEL.ink, border: `1px solid ${STEEL.line}`, borderRadius: 10, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#8fb3dc', letterSpacing: 0.6 }}>LEADING INDICATOR HEALTH</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: bandColor, lineHeight: 1.1, marginTop: 6 }}>{L.index}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: bandColor }}>{L.band}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{L.signals.length} signal{L.signals.length === 1 ? '' : 's'} • {L.signals.filter(s => s.severity === 'high').length} need action now</div>
          </div>
          <div>
            {L.signals.length === 0 ? (
              <div style={{ padding: 14, color: '#86efac', background: STEEL.ink, borderRadius: 8, border: `1px solid ${STEEL.line}` }}>No warning signals. Keep THA quality, near-miss reporting and observations where they are.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {L.signals.slice(0, 8).map(s => (
                  <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '6px 1fr', background: STEEL.ink, borderRadius: 8, overflow: 'hidden', border: `1px solid ${STEEL.line}` }}>
                    <div style={{ background: SEV[s.severity].bar }} />
                    <div style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: SEV[s.severity].color, letterSpacing: 0.6 }}>{SEV[s.severity].label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#e6eef8' }}>{s.title}</span>
                      </div>
                      {s.detail && <div style={{ fontSize: 12, color: '#a8bdd6', marginTop: 2 }}>{s.detail}</div>}
                      <div style={{ fontSize: 12, color: STEEL.pale, marginTop: 4 }}><strong style={{ color: '#ffffff' }}>Do this:</strong> {s.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 14 }}>
          <Tile label="THA quality (avg)" value={L.tha.avgScore30 === null ? '—' : `${L.tha.avgScore30}/100`} sub={<>{L.tha.count30} THAs<Delta cur={L.tha.avgScore30} prev={L.tha.avgScorePrev} /></>} warn={L.tha.avgScore30 !== null && L.tha.avgScore30 < 70} />
          <Tile label="THAs graded D/F" value={L.tha.lowGradePct30 === null ? '—' : `${L.tha.lowGradePct30}%`} sub="canned / copy-paste" warn={(L.tha.lowGradePct30 ?? 0) >= 25} />
          <Tile label="After-action reviews" value={L.tha.aarPct30 === null ? '—' : `${L.tha.aarPct30}%`} sub={L.tha.autoClosePct30 === null ? 'of closed THAs' : `${L.tha.autoClosePct30}% auto-closed`} warn={(L.tha.autoClosePct30 ?? 0) >= 40} />
          <Tile label="Near misses" value={L.nearMiss.count30} sub={<>prev {L.nearMiss.countPrev}<Delta cur={L.nearMiss.count30} prev={L.nearMiss.countPrev} /></>} warn={L.nearMiss.count30 === 0} />
          <Tile label="High-energy near misses" value={L.nearMiss.highEnergy30} sub="SIF precursors" warn={L.nearMiss.highEnergy30 > 0} />
          <Tile label="BBS observations" value={L.bbs.count30} sub={L.bbs.atRiskPct30 === null ? `prev ${L.bbs.countPrev}` : `${L.bbs.atRiskPct30}% at-risk`} warn={L.bbs.count30 === 0} />
          <Tile label="Stop & Take 5" value={L.st5.count30} sub={<>prev {L.st5.countPrev}<Delta cur={L.st5.count30} prev={L.st5.countPrev} /></>} />
          <Tile label="Hazard IDs" value={L.hazards.count30} sub={`${L.hazards.high30} high-threat`} warn={L.hazards.high30 > 0} />
          <Tile label="SAIL overdue" value={L.sail.overdue} sub={`${L.sail.open} open • ${L.sail.overdue30} >30 days`} warn={L.sail.overdue > 0} />
          <Tile label="Corrective actions overdue" value={L.ca.overdue} sub={`${L.ca.open} open • oldest ${L.ca.oldestOverdueDays}d • ${L.ca.nags7} reminders/7d`} warn={L.ca.overdue > 0} />
          <Tile label="Near misses per incident" value={L.incidents.nearMissPerIncident90 ?? '—'} sub={`90 days: ${L.incidents.nearMiss90} NM / ${L.incidents.incidents90} inc`} warn={L.incidents.nearMissPerIncident90 !== null && L.incidents.nearMissPerIncident90 < 3} />
          <Tile label="Incidents (lagging)" value={L.incidents.count30} sub={<>prev {L.incidents.countPrev}<Delta cur={L.incidents.count30} prev={L.incidents.countPrev} goodUp={false} /></>} />
        </div>

        {Array.isArray(L.companies) && L.companies.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#8fb3dc', letterSpacing: 0.6, marginBottom: 6 }}>COMPANIES TO LOOK AT FIRST (lowest leading-indicator health)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Company</th><th>Health</th><th>Act-now signals</th><th>Top signal</th><th>THA avg</th><th>Near misses 30d</th><th>SAIL overdue</th><th>CA overdue</th></tr></thead>
                <tbody>
                  {L.companies.map(c => (
                    <tr key={c.company} style={{ cursor: onPickCompany ? 'pointer' : 'default' }} onClick={() => onPickCompany && onPickCompany(c.company)}>
                      <td>{c.company}</td>
                      <td style={{ fontWeight: 800, color: c.index >= 85 ? '#86efac' : c.index >= 65 ? '#93c5fd' : c.index >= 40 ? '#fbbf24' : '#f87171' }}>{c.index} {c.band}</td>
                      <td>{c.high}</td>
                      <td style={{ color: '#a8bdd6' }}>{c.top || '—'}</td>
                      <td>{c.thaAvg ?? '—'}</td>
                      <td>{c.nearMiss30}</td>
                      <td>{c.sailOverdue}</td>
                      <td>{c.caOverdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {Array.isArray(L.errors) && L.errors.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>Some sources could not be read: {L.errors.join('; ')}</div>}
      </div>
      <style>{`@media (max-width: 720px) { .li-top { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
