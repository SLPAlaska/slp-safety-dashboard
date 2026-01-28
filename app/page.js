'use client'

import { useState, useEffect } from 'react'
import { supabase, getDashboardData } from '../lib/supabase'

const COMPANIES = ['All', 'A-C Electric', 'AKE-Line', 'Apache Corp.', 'Armstrong Oil & Gas', 'ASRC Energy Services', 'CCI-Industrial', 'Chosen Construction', 'CINGSA', 'Coho Enterprises', 'Conam Construction', 'ConocoPhillips', 'Five Star Oilfield Services', 'Fox Energy Services', 'G.A. West', 'GBR Equipment', 'GLM Energy Services', 'Graham Industrial Coatings', 'Harvest Midstream', 'Hilcorp Alaska', 'MagTec Alaska', 'Merkes Builders', 'Nordic-Calista', 'Parker TRS', 'Peninsula Paving', 'Pollard Wireline', 'Ridgeline Oilfield Services', 'Santos', 'Summit Excavation', 'Yellowjacket']

const LOCATIONS = ['All', 'Kenai', 'CIO', 'Beaver Creek', 'Swanson River', 'Ninilchik', 'Nikiski', 'Other Kenai Asset', 'Deadhorse', 'Prudhoe Bay', 'Kuparuk', 'Alpine', 'Willow', 'ENI', 'PIKKA', 'Point Thompson', 'North Star Island', 'Endicott', 'Badami', 'Other North Slope']

const currentYear = new Date().getFullYear()
const YEARS = [String(currentYear), String(currentYear - 1), String(currentYear - 2), 'All']

function formatMoney(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M'
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(1) + 'K'
  return '$' + Math.round(amount).toLocaleString()
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(String(currentYear))
  const [company, setCompany] = useState('All')
  const [location, setLocation] = useState('All')

  const loadData = async () => {
    setLoading(true)
    const result = await getDashboardData(company, location, year)
    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [year, company, location])

  const handlePrint = () => {
    window.print()
  }

  const d = data

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <img src="/Logo.png" alt="SLP Alaska Logo" style={{height: '60px', marginRight: '15px'}} />
          <div>
            <h1>Predictive Safety Analytics</h1>
            <div className="header-subtitle">Real-Time Leading & Lagging Indicators</div>
          </div>
        </div>
        <div className="filters">
          <div className="filter-group">
            <span className="filter-label">Year</span>
            <select className="filter-select year-select" value={year} onChange={(e) => setYear(e.target.value)}>
              {YEARS.map(y => <option key={y} value={y}>{y === 'All' ? 'All Time' : y}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Company</span>
            <select className="filter-select" value={company} onChange={(e) => setCompany(e.target.value)}>
              {COMPANIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Companies' : c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Location</span>
            <select className="filter-select" value={location} onChange={(e) => setLocation(e.target.value)}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l === 'All' ? 'All Locations' : l}</option>)}
            </select>
          </div>
          <button className="refresh-btn" onClick={loadData}>🔄 Refresh</button>
          <button className="print-btn" onClick={handlePrint}>🖨️ Print</button>
        </div>
      </div>

      {/* Year Banner */}
      <div className="year-banner">
        Showing data for: <strong>{year === 'All' ? 'All Time' : year}</strong>
        {company !== 'All' && <> | Company: <strong>{company}</strong></>}
        {location !== 'All' && <> | Location: <strong>{location}</strong></>}
        {d && d.fromCache && (
          <span className="cache-indicator cached">⚡ Cached ({d.cacheAge}m ago)</span>
        )}
      </div>

      <div className="container">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading predictive analytics...</p>
          </div>
        ) : !d ? (
          <div className="loading">
            <p style={{color: '#ef4444'}}>Error: No data available for this filter combination.</p>
            <button className="refresh-btn" onClick={loadData} style={{marginTop: '10px'}}>Retry</button>
          </div>
        ) : (
          <>
            {/* Score Cards - Row 1 */}
            <div className="score-row">
              <div className={`score-card sci`}>
                <div className="score-label">Safety Culture Index</div>
                <div className={`score-value ${d.safetyCultureIndex >= 70 ? 'good' : d.safetyCultureIndex >= 50 ? 'warning' : 'danger'}`}>
                  {d.safetyCultureIndex}
                </div>
                <div className="score-detail">Target: 70+</div>
              </div>

              <div className={`score-card risk`}>
                <div className="score-label">Predictive Risk Score</div>
                <div className={`score-value ${d.predictiveRiskScore <= 30 ? 'good' : d.predictiveRiskScore <= 60 ? 'warning' : 'danger'}`}>
                  {d.predictiveRiskScore}
                </div>
                <div className="score-detail">Lower is better</div>
              </div>

              <div className={`score-card safe`}>
                <div className="score-label">Safe/At-Risk Ratio</div>
                <div className={`score-value ${d.bbsMetrics?.safeRatio >= 5 ? 'good' : d.bbsMetrics?.safeRatio >= 2 ? 'warning' : 'danger'}`}>
                  {d.bbsMetrics?.safeRatio || 0}:1
                </div>
                <div className="score-detail">Target: 5:1</div>
              </div>

              <div className={`score-card warning`}>
                <div className="score-label">Job Stop Rate</div>
                <div className={`score-value ${d.bbsMetrics?.jobStopRate >= 50 ? 'good' : d.bbsMetrics?.jobStopRate >= 25 ? 'warning' : 'neutral'}`}>
                  {d.bbsMetrics?.jobStopRate || 0}%
                </div>
                <div className="score-detail">{d.bbsMetrics?.jobStops || 0} stops</div>
              </div>

              <div className={`score-card sif`}>
                <div className="score-label">⚠️ SIF Potential Rate</div>
                <div className={`score-value ${d.sifMetrics?.sifPotentialRate <= 10 ? 'good' : d.sifMetrics?.sifPotentialRate <= 25 ? 'warning' : 'danger'}`}>
                  {d.sifMetrics?.sifPotentialRate || 0}%
                </div>
                <div className="score-detail">{d.sifMetrics?.sifPotentialCount || 0} of {d.sifMetrics?.totalEvents || 0} events</div>
              </div>

              <div className={`score-card energy`}>
                <div className="score-label">🛡️ Control Quality</div>
                <div className={`score-value ${d.energySourceMetrics?.controlHierarchyScore >= 60 ? 'good' : d.energySourceMetrics?.controlHierarchyScore >= 40 ? 'warning' : 'danger'}`}>
                  {d.energySourceMetrics?.controlHierarchyScore || 0}
                </div>
                <div className="score-detail">Higher = better controls</div>
              </div>

              <div className={`score-card safe`}>
                <div className="score-label">Near Misses</div>
                <div className={`score-value ${d.nearMissMetrics?.totalReported >= 5 ? 'good' : d.nearMissMetrics?.totalReported >= 2 ? 'warning' : 'neutral'}`}>
                  {d.nearMissMetrics?.totalReported || 0}
                </div>
                <div className="score-detail">More = better culture</div>
              </div>

              <div className={`score-card ${d.aging?.over30Days > 0 ? 'danger' : 'safe'}`}>
                <div className="score-label">Open Items</div>
                <div className={`score-value ${(d.laggingIndicators?.sailOpen + d.laggingIndicators?.openIncidents) === 0 ? 'good' : 'warning'}`}>
                  {(d.laggingIndicators?.sailOpen || 0) + (d.laggingIndicators?.openIncidents || 0)}
                </div>
                <div className="score-detail">{d.laggingIndicators?.sailOverdue || 0} overdue</div>
              </div>

              <div className={`score-card leadlag`}>
                <div className="score-label">📊 Lead/Lag Ratio</div>
                <div className={`score-value ${d.leadLagRatio >= 10 ? 'good' : d.leadLagRatio >= 5 ? 'warning' : 'danger'}`}>
                  {d.leadLagRatio || 0}:1
                </div>
                <div className="score-detail">Target: 10:1+</div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
              {/* Energy Source Analytics */}
              <div className="panel">
                <div className="panel-header energy-header">⚡ Energy Source Analytics</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px'}}>
                    <div style={{fontSize: '28px', fontWeight: 700, color: '#a78bfa'}}>{d.energySourceMetrics?.totalObservations || 0}</div>
                    <div style={{fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase'}}>Energy Sources Identified</div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase'}}>Energy Types Encountered</div>
                  {Object.entries(d.energySourceMetrics?.byEnergyType || {}).map(([type, count]) => (
                    <div key={type} className="energy-bar-container">
                      <div className="energy-bar-label"><span>{type}</span><span>{count}</span></div>
                      <div className="energy-bar">
                        <div className="energy-bar-fill" style={{
                          width: `${Math.min(100, (count / Math.max(...Object.values(d.energySourceMetrics?.byEnergyType || {1:1}))) * 100)}%`,
                          background: type === 'Gravity' ? '#ef4444' : type === 'Motion' ? '#f97316' : type === 'Mechanical' ? '#eab308' : type === 'Electrical' ? '#facc15' : type === 'Pressure' ? '#22c55e' : type === 'Chemical' ? '#14b8a6' : type === 'Temperature' ? '#3b82f6' : '#8b5cf6'
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SIF Potential Analytics */}
              <div className="panel">
                <div className="panel-header sif-header">☠️ SIF Potential (STKY) Analytics</div>
                <div className="panel-content">
                  <div className="sif-rate-display">
                    <div className="sif-rate-value">{d.sifMetrics?.sifPotentialRate || 0}%</div>
                    <div className="sif-rate-label">SIF Potential Rate</div>
                    <div style={{fontSize: '11px', color: '#94a3b8', marginTop: '4px'}}>{d.sifMetrics?.sifPotentialCount || 0} of {d.sifMetrics?.totalEvents || 0} events had SIF potential</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">✓ Effective</div><div className="metric-value green">{d.sifMetrics?.directControlStatus?.effective || 0}</div></div>
                    <div className="metric"><div className="metric-label">✗ Failed</div><div className="metric-value red">{d.sifMetrics?.directControlStatus?.failed || 0}</div></div>
                    <div className="metric"><div className="metric-label">⚠ Alt Only</div><div className="metric-value yellow">{d.sifMetrics?.directControlStatus?.alternativeOnly || 0}</div></div>
                    <div className="metric"><div className="metric-label">✗ None</div><div className="metric-value red">{d.sifMetrics?.directControlStatus?.none || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* BBS Observations */}
              <div className="panel">
                <div className="panel-header">📊 BBS Observations</div>
                <div className="panel-content">
                  <div className="bbs-ratio">
                    <div className="ratio-item"><div className="ratio-value" style={{color: '#22c55e'}}>{d.bbsMetrics?.safe || 0}</div><div className="ratio-label">Safe</div></div>
                    <div className="ratio-divider">:</div>
                    <div className="ratio-item"><div className="ratio-value" style={{color: '#ef4444'}}>{d.bbsMetrics?.atRisk || 0}</div><div className="ratio-label">At-Risk</div></div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Total Observations</div><div className="metric-value orange">{d.bbsMetrics?.total || 0}</div></div>
                    <div className="metric"><div className="metric-label">Job Stops</div><div className="metric-value red">{d.bbsMetrics?.jobStops || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* Leading Indicators */}
              <div className="panel">
                <div className="panel-header">📈 Leading Indicators</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#064e3b', borderRadius: '8px'}}>
                    <div style={{fontSize: '24px', fontWeight: 700, color: '#10b981'}}>{d.totalLeadingIndicators || 0}</div>
                    <div style={{fontSize: '9px', color: '#6ee7b7', textTransform: 'uppercase'}}>Total Leading Activities</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">HSE Contacts</div><div className="metric-value teal">{d.leadingIndicators?.hseContacts || 0}</div></div>
                    <div className="metric"><div className="metric-label">THA/JSAs</div><div className="metric-value teal">{d.leadingIndicators?.thas || 0}</div></div>
                    <div className="metric"><div className="metric-label">Safety Meetings</div><div className="metric-value teal">{d.leadingIndicators?.safetyMeetings || 0}</div></div>
                    <div className="metric"><div className="metric-label">Toolbox Meetings</div><div className="metric-value teal">{d.leadingIndicators?.toolboxMeetings || 0}</div></div>
                    <div className="metric"><div className="metric-label">STOP & Take 5</div><div className="metric-value teal">{d.leadingIndicators?.stopTake5 || 0}</div></div>
                    <div className="metric"><div className="metric-label">Risk Conversations</div><div className="metric-value teal">{d.leadingIndicators?.riskConversations || 0}</div></div>
                    <div className="metric"><div className="metric-label">MBWA</div><div className="metric-value teal">{d.leadingIndicators?.mbwa || 0}</div></div>
                    <div className="metric"><div className="metric-label">EHS Field Evals</div><div className="metric-value teal">{d.leadingIndicators?.ehsFieldEvals || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* Lagging Indicators */}
              <div className="panel">
                <div className="panel-header">📉 Lagging Indicators</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#7f1d1d', borderRadius: '8px'}}>
                    <div style={{fontSize: '24px', fontWeight: 700, color: '#fca5a5'}}>{d.totalLaggingIndicators || 0}</div>
                    <div style={{fontSize: '9px', color: '#fecaca', textTransform: 'uppercase'}}>Total Lagging Events</div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase'}}>Incidents</div>
                  <div className="status-row" style={{marginBottom: '10px'}}>
                    <div className="status-item open"><div className="metric-value red">{d.laggingIndicators?.openIncidents || 0}</div><div className="metric-label">Open</div></div>
                    <div className="status-item closed"><div className="metric-value green">{d.laggingIndicators?.closedIncidents || 0}</div><div className="metric-label">Closed</div></div>
                  </div>
                  <div className="metrics-grid" style={{marginBottom: '10px'}}>
                    <div className="metric"><div className="metric-label">First Aid</div><div className="metric-value yellow">{d.laggingIndicators?.firstAid || 0}</div></div>
                    <div className="metric"><div className="metric-label">Recordable</div><div className="metric-value orange">{d.laggingIndicators?.recordable || 0}</div></div>
                    <div className="metric"><div className="metric-label">Lost Time</div><div className="metric-value red">{d.laggingIndicators?.lostTime || 0}</div></div>
                    <div className="metric"><div className="metric-label">Property Damage</div><div className="metric-value orange">{d.laggingIndicators?.propertyDamage || 0}</div></div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase'}}>SAIL Log</div>
                  <div className="status-row">
                    <div className="status-item open"><div className="metric-value red">{d.laggingIndicators?.sailOpen || 0}</div><div className="metric-label">Open</div></div>
                    <div className="status-item critical"><div className="metric-value red">{d.laggingIndicators?.sailCritical || 0}</div><div className="metric-label">Critical</div></div>
                    <div className="status-item overdue"><div className="metric-value orange">{d.laggingIndicators?.sailOverdue || 0}</div><div className="metric-label">Overdue</div></div>
                  </div>
                </div>
              </div>

              {/* Aging Metrics */}
              <div className="panel">
                <div className="panel-header">⏰ Aging Metrics</div>
                <div className="panel-content">
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Avg Days Open</div><div className="metric-value blue">{d.aging?.avgDaysOpen || 0}</div></div>
                    <div className="metric"><div className="metric-label">Over 30 Days</div><div className="metric-value yellow">{d.aging?.over30Days || 0}</div></div>
                    <div className="metric"><div className="metric-label">Over 60 Days</div><div className="metric-value orange">{d.aging?.over60Days || 0}</div></div>
                    <div className="metric"><div className="metric-label">Over 90 Days</div><div className="metric-value red">{d.aging?.over90Days || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* LSR Audit Summary Panel */}
              <div className="panel">
                <div className="panel-header lsr-header">🛡️ LSR Audit Summary</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#1e1b4b', borderRadius: '8px'}}>
                    <div style={{fontSize: '24px', fontWeight: 700, color: '#818cf8'}}>{d.lsrAuditCounts?.total || 0}</div>
                    <div style={{fontSize: '9px', color: '#a5b4fc', textTransform: 'uppercase'}}>Total LSR Audits</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Confined Space</div><div className="metric-value purple">{d.lsrAuditCounts?.confinedSpace || 0}</div></div>
                    <div className="metric"><div className="metric-label">Driving</div><div className="metric-value purple">{d.lsrAuditCounts?.driving || 0}</div></div>
                    <div className="metric"><div className="metric-label">Energy Isolation</div><div className="metric-value purple">{d.lsrAuditCounts?.energyIsolation || 0}</div></div>
                    <div className="metric"><div className="metric-label">Fall Protection</div><div className="metric-value purple">{d.lsrAuditCounts?.fallProtection || 0}</div></div>
                    <div className="metric"><div className="metric-label">Lifting Ops</div><div className="metric-value purple">{d.lsrAuditCounts?.liftingOperations || 0}</div></div>
                    <div className="metric"><div className="metric-label">Line of Fire</div><div className="metric-value purple">{d.lsrAuditCounts?.lineOfFire || 0}</div></div>
                    <div className="metric"><div className="metric-label">Work Permits</div><div className="metric-value purple">{d.lsrAuditCounts?.workPermits || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* Inspections Summary Panel */}
              <div className="panel">
                <div className="panel-header inspection-header">🔍 Inspections Summary</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#164e63', borderRadius: '8px'}}>
                    <div style={{fontSize: '24px', fontWeight: 700, color: '#22d3ee'}}>{d.totalInspections || 0}</div>
                    <div style={{fontSize: '9px', color: '#67e8f9', textTransform: 'uppercase'}}>Total Inspections</div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase'}}>Monthly Equipment</div>
                  <div className="metrics-grid" style={{marginBottom: '10px'}}>
                    <div className="metric"><div className="metric-label">Fire Ext.</div><div className="metric-value cyan">{d.inspectionCounts?.fireExtinguisher || 0}</div></div>
                    <div className="metric"><div className="metric-label">Eyewash</div><div className="metric-value cyan">{d.inspectionCounts?.eyewash || 0}</div></div>
                    <div className="metric"><div className="metric-label">First Aid</div><div className="metric-value cyan">{d.inspectionCounts?.firstAid || 0}</div></div>
                    <div className="metric"><div className="metric-label">AED</div><div className="metric-value cyan">{d.inspectionCounts?.aed || 0}</div></div>
                    <div className="metric"><div className="metric-label">Ladders</div><div className="metric-value cyan">{d.inspectionCounts?.ladder || 0}</div></div>
                    <div className="metric"><div className="metric-label">Harness</div><div className="metric-value cyan">{d.inspectionCounts?.harness || 0}</div></div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase'}}>Rigging & Lifting</div>
                  <div className="metrics-grid" style={{marginBottom: '10px'}}>
                    <div className="metric"><div className="metric-label">Lanyard/SRL</div><div className="metric-value cyan">{d.inspectionCounts?.lanyard || 0}</div></div>
                    <div className="metric"><div className="metric-label">Shackles</div><div className="metric-value cyan">{d.inspectionCounts?.shackle || 0}</div></div>
                    <div className="metric"><div className="metric-label">Slings</div><div className="metric-value cyan">{d.inspectionCounts?.sling || 0}</div></div>
                    <div className="metric"><div className="metric-label">Wire Rope</div><div className="metric-value cyan">{d.inspectionCounts?.wireRope || 0}</div></div>
                    <div className="metric"><div className="metric-label">Chain Hoist</div><div className="metric-value cyan">{d.inspectionCounts?.chainHoist || 0}</div></div>
                  </div>
                  <div style={{fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase'}}>Vehicles & Equipment</div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Vehicles</div><div className="metric-value cyan">{d.inspectionCounts?.vehicle || 0}</div></div>
                    <div className="metric"><div className="metric-label">Forklifts</div><div className="metric-value cyan">{d.inspectionCounts?.forklift || 0}</div></div>
                    <div className="metric"><div className="metric-label">Cranes</div><div className="metric-value cyan">{d.inspectionCounts?.crane || 0}</div></div>
                    <div className="metric"><div className="metric-label">Heavy Equip</div><div className="metric-value cyan">{d.inspectionCounts?.heavyEquip || 0}</div></div>
                    <div className="metric"><div className="metric-label">Scaffolds</div><div className="metric-value cyan">{d.inspectionCounts?.scaffold || 0}</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Open Items Table */}
            <div className="panel" style={{marginTop: '16px'}}>
              <div className="panel-header">🔴 Oldest Open Items</div>
              <div className="panel-content">
                <div className="scrollable">
                  {(!d.openItems || d.openItems.length === 0) ? (
                    <p style={{color: '#64748b', textAlign: 'center', padding: '20px'}}>No open items - Great job!</p>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Form</th><th>Company</th><th>Location</th><th>Status</th><th>Days</th></tr></thead>
                      <tbody>
                        {d.openItems.map((item, i) => (
                          <tr key={i}>
                            <td>{item.form}</td>
                            <td>{item.company}</td>
                            <td>{item.location}</td>
                            <td><span className="badge badge-open">{item.status}</span></td>
                            <td><span className={`days ${item.daysOpen > 90 ? 'days-critical' : item.daysOpen > 30 ? 'days-warning' : 'days-ok'}`}>{item.daysOpen}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Areas Needing Focus */}
            <div className="panel" style={{marginTop: '16px'}}>
              <div className="panel-header">⚠️ Areas Needing Focus (LSR Audits)</div>
              <div className="panel-content">
                <div className="scrollable">
                  {(!d.areasNeedingFocus || d.areasNeedingFocus.length === 0) ? (
                    <div style={{textAlign: 'center', color: '#64748b', padding: '20px'}}>No issues identified</div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Category</th><th>Issue</th><th>Count</th><th>Location</th></tr></thead>
                      <tbody>
                        {d.areasNeedingFocus.map((focus, i) => (
                          <tr key={i}>
                            <td style={{color: '#f97316', fontWeight: 600}}>{focus.category}</td>
                            <td style={{fontSize: '11px'}}>{focus.issue}</td>
                            <td><span style={{fontWeight: 'bold', color: focus.count >= 3 ? '#ef4444' : focus.count >= 2 ? '#f97316' : '#eab308'}}>{focus.count}</span></td>
                            <td style={{fontSize: '11px'}}>{focus.topLocation || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="last-updated">
              Last Updated: {d.timestamp ? new Date(d.timestamp).toLocaleString() : 'N/A'} | {d.fromCache ? `Cache age: ${d.cacheAge || 0} minutes` : 'Live data'}
            </div>
          </>
        )}
      </div>

      <div className="footer">
        Powered by Predictive Safety Analytics™ | © 2026 SLP Alaska
      </div>
    </div>
  )
}
