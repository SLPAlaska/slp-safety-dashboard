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

// Trend Arrow Component
function TrendArrow({ trend, goodDirection = 'up' }) {
  if (!trend || trend.direction === 'flat') {
    return <span className="trend-arrow flat">→</span>
  }
  const isGood = (trend.direction === goodDirection)
  const arrow = trend.direction === 'up' ? '↑' : '↓'
  return (
    <span className={`trend-arrow ${isGood ? 'good' : 'bad'}`} title={`${trend.percent}% ${trend.direction}`}>
      {arrow} {trend.percent}%
    </span>
  )
}

// Engagement Alert Component
function EngagementAlert({ metrics }) {
  if (!metrics || metrics.engagementStatus === 'active') return null
  
  const alerts = {
    'no-data': { icon: '🚫', text: 'No submissions recorded', color: '#64748b' },
    'critical': { icon: '🚨', text: `No activity in ${metrics.daysSinceLastSubmission} days!`, color: '#ef4444' },
    'warning': { icon: '⚠️', text: `${metrics.daysSinceLastSubmission} days since last submission`, color: '#f97316' },
    'moderate': { icon: '📋', text: `${metrics.daysSinceLastSubmission} days since last activity`, color: '#eab308' }
  }
  
  const alert = alerts[metrics.engagementStatus]
  if (!alert) return null
  
  return (
    <div className="engagement-alert" style={{ background: `${alert.color}22`, borderColor: alert.color }}>
      <span>{alert.icon}</span>
      <span>{alert.text}</span>
    </div>
  )
}

// TrueCost Trend Graph Component
function TrueCostTrendGraph({ monthlyData }) {
  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
        No cost data available for the selected period
      </div>
    )
  }

  const maxCost = Math.max(...monthlyData.map(d => d.total))
  const chartHeight = 200

  return (
    <div style={{ position: 'relative', height: `${chartHeight + 40}px` }}>
      {/* Y-axis labels */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 40, width: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
        <div>{formatMoney(maxCost)}</div>
        <div>{formatMoney(maxCost * 0.75)}</div>
        <div>{formatMoney(maxCost * 0.5)}</div>
        <div>{formatMoney(maxCost * 0.25)}</div>
        <div>$0</div>
      </div>

      {/* Chart area */}
      <div style={{ marginLeft: '70px', marginRight: '10px', height: chartHeight, position: 'relative', borderBottom: '2px solid #e2e8f0', borderLeft: '2px solid #e2e8f0' }}>
        {monthlyData.map((item, index) => {
          const barHeight = maxCost > 0 ? (item.total / maxCost) * chartHeight : 0
          const barWidth = `${(1 / monthlyData.length) * 90}%`
          
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                bottom: 0,
                left: `${(index / monthlyData.length) * 100}%`,
                width: barWidth,
                height: `${barHeight}px`,
                background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              title={`${item.month}: ${formatMoney(item.total)}\nDirect: ${formatMoney(item.direct)}\nIndirect: ${formatMoney(item.indirect)}`}
            />
          )
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ marginLeft: '70px', marginTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
        {monthlyData.map((item, index) => (
          <div key={index} style={{ flex: 1, textAlign: 'center' }}>
            {item.month}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [trueCostData, setTrueCostData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(String(currentYear))
  const [company, setCompany] = useState('All')
  const [location, setLocation] = useState('All')

  const loadData = async () => {
    setLoading(true)
    
    // Load main dashboard data
    const result = await getDashboardData(company, location, year)
    setData(result)
    
    // Load TrueCost data
    await loadTrueCostData()
    
    setLoading(false)
  }

  const loadTrueCostData = async () => {
    try {
      // Build query for incident_costs
      let query = supabase
        .from('incident_costs')
        .select(`
          total_all_costs,
          total_direct_costs,
          total_indirect_costs,
          entry_date,
          incident_id,
          incidents!inner(company_name, location_name, incident_date)
        `)

      // Apply filters
      if (company !== 'All') {
        query = query.eq('incidents.company_name', company)
      }
      if (location !== 'All') {
        query = query.eq('incidents.location_name', location)
      }
      if (year !== 'All') {
        const startDate = `${year}-01-01`
        const endDate = `${year}-12-31`
        query = query.gte('incidents.incident_date', startDate).lte('incidents.incident_date', endDate)
      }

      const { data: costs, error } = await query

      if (error) {
        console.error('Error loading TrueCost data:', error)
        setTrueCostData({ total: 0, average: 0, monthlyTrend: [] })
        return
      }

      // Calculate totals
      const totalCost = costs.reduce((sum, item) => sum + (parseFloat(item.total_all_costs) || 0), 0)
      const averageCost = costs.length > 0 ? totalCost / costs.length : 0

      // Calculate monthly trend
      const monthlyMap = {}
      costs.forEach(item => {
        if (item.incidents?.incident_date) {
          const date = new Date(item.incidents.incident_date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = {
              total: 0,
              direct: 0,
              indirect: 0,
              month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            }
          }
          
          monthlyMap[monthKey].total += parseFloat(item.total_all_costs) || 0
          monthlyMap[monthKey].direct += parseFloat(item.total_direct_costs) || 0
          monthlyMap[monthKey].indirect += parseFloat(item.total_indirect_costs) || 0
        }
      })

      // Convert to array and sort by date
      const monthlyTrend = Object.keys(monthlyMap)
        .sort()
        .slice(-12) // Last 12 months
        .map(key => monthlyMap[key])

      setTrueCostData({
        total: totalCost,
        average: averageCost,
        count: costs.length,
        monthlyTrend
      })

    } catch (error) {
      console.error('Error in loadTrueCostData:', error)
      setTrueCostData({ total: 0, average: 0, monthlyTrend: [] })
    }
  }

  useEffect(() => {
    loadData()
  }, [year, company, location])

  const handlePrint = () => {
    window.print()
  }

  const d = data
  const tc = trueCostData

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

      {/* Engagement Alert Banner */}
      {d && <EngagementAlert metrics={d.engagementMetrics} />}

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

              {/* NEW: 30-Day Risk Forecast */}
              <div className={`score-card forecast`}>
                <div className="score-label">🔮 30-Day Forecast</div>
                <div className={`score-value ${d.riskForecast30Day <= 30 ? 'good' : d.riskForecast30Day <= 60 ? 'warning' : 'danger'}`}>
                  {d.riskForecast30Day || 0}
                </div>
                <div className="score-detail">Predicted risk level</div>
              </div>

              {/* NEW: TrueCost Card */}
              <div className={`score-card truecost`}>
                <div className="score-label">💰 TrueCost™ Total</div>
                <div className="score-value" style={{ fontSize: tc?.total >= 1000000 ? '32px' : '40px' }}>
                  {tc ? formatMoney(tc.total) : '$0'}
                </div>
                <div className="score-detail">
                  {tc?.count || 0} incidents • Avg: {tc ? formatMoney(tc.average) : '$0'}
                </div>
              </div>

              <div className={`score-card safe`}>
                <div className="score-label">
                  Safe/At-Risk Ratio
                  <TrendArrow trend={d.trends?.safeRatio} goodDirection="up" />
                </div>
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
                <div className="score-label">
                  ⚠️ SIF Potential Rate
                  <TrendArrow trend={d.trends?.sifRate} goodDirection="down" />
                </div>
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

            {/* NEW: TrueCost Trend Graph Panel */}
            <div className="panel" style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
              <div className="panel-header" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)' }}>
                💰 TrueCost™ Monthly Trend
              </div>
              <div className="panel-content">
                {tc && <TrueCostTrendGraph monthlyData={tc.monthlyTrend} />}
              </div>
            </div>

            {/* Continue with rest of dashboard panels... */}
            {/* I'll keep the rest of the original code below this comment */}

            {/* Main Grid */}
            <div className="main-grid">
              {/* NEW: Engagement & Activity Panel */}
              <div className="panel">
                <div className="panel-header engagement-header">👥 Engagement & Activity</div>
                <div className="panel-content">
                  <div className="engagement-stats">
                    <div className="engagement-stat">
                      <div className={`engagement-value ${d.engagementMetrics?.engagementStatus === 'active' ? 'good' : d.engagementMetrics?.engagementStatus === 'moderate' ? 'warning' : 'danger'}`}>
                        {d.engagementMetrics?.daysSinceLastSubmission ?? '—'}
                      </div>
                      <div className="engagement-label">Days Since Last Activity</div>
                    </div>
                    <div className="engagement-stat">
                      <div className="engagement-value neutral">{d.engagementMetrics?.uniqueSubmitters || 0}</div>
                      <div className="engagement-label">Active Submitters</div>
                    </div>
                    {d.engagementMetrics?.participationRate !== null && (
                      <div className="engagement-stat">
                        <div className={`engagement-value ${d.engagementMetrics?.participationRate >= 50 ? 'good' : d.engagementMetrics?.participationRate >= 25 ? 'warning' : 'danger'}`}>
                          {d.engagementMetrics?.participationRate}%
                        </div>
                        <div className="engagement-label">Participation Rate</div>
                      </div>
                    )}
                  </div>
                  {d.engagementMetrics?.employeeCount && (
                    <div style={{textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '8px'}}>
                      {d.engagementMetrics?.uniqueSubmitters} of {d.engagementMetrics?.employeeCount} employees have submitted
                    </div>
                  )}
                  <div className="metrics-grid" style={{marginTop: '12px'}}>
                    <div className="metric">
                      <div className="metric-label">Last 7 Days</div>
                      <div className={`metric-value ${d.engagementMetrics?.submissionsLast7Days > 0 ? 'green' : 'red'}`}>
                        {d.engagementMetrics?.submissionsLast7Days || 0}
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Last 30 Days</div>
                      <div className={`metric-value ${d.engagementMetrics?.submissionsLast30Days > 0 ? 'green' : 'red'}`}>
                        {d.engagementMetrics?.submissionsLast30Days || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
                <div className="panel-header">
                  📊 BBS Observations
                  <TrendArrow trend={d.trends?.atRiskBehaviors} goodDirection="down" />
                </div>
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
                <div className="panel-header">
                  📈 Leading Indicators
                  <TrendArrow trend={d.trends?.leadingTotal} goodDirection="up" />
                </div>
                <div className="panel-content">
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">BBS</div><div className="metric-value green">{d.leadingIndicators?.totalBBS || 0}</div></div>
                    <div className="metric"><div className="metric-label">THA/JSA</div><div className="metric-value green">{d.leadingIndicators?.totalTHA || 0}</div></div>
                    <div className="metric"><div className="metric-label">Hazard IDs</div><div className="metric-value green">{d.leadingIndicators?.totalHazardIds || 0}</div></div>
                    <div className="metric"><div className="metric-label">Meetings</div><div className="metric-value green">{d.leadingIndicators?.totalMeetings || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* Lagging Indicators */}
              <div className="panel">
                <div className="panel-header">
                  📉 Lagging Indicators
                  <TrendArrow trend={d.trends?.incidents} goodDirection="down" />
                </div>
                <div className="panel-content">
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Total Incidents</div><div className="metric-value red">{d.laggingIndicators?.totalIncidents || 0}</div></div>
                    <div className="metric"><div className="metric-label">Open</div><div className="metric-value orange">{d.laggingIndicators?.openIncidents || 0}</div></div>
                    <div className="metric"><div className="metric-label">Open SAIL</div><div className="metric-value orange">{d.laggingIndicators?.sailOpen || 0}</div></div>
                    <div className="metric"><div className="metric-label">STKY</div><div className="metric-value purple">{d.laggingIndicators?.stkyCount || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* Near Miss Reporting */}
              <div className="panel">
                <div className="panel-header">⚠️ Near Miss Reporting</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px'}}>
                    <div style={{fontSize: '28px', fontWeight: 700, color: '#f59e0b'}}>{d.nearMissMetrics?.totalReported || 0}</div>
                    <div style={{fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase'}}>Near Misses Reported</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">High-SIF-P</div><div className="metric-value red">{d.nearMissMetrics?.bySeverity?.high || 0}</div></div>
                    <div className="metric"><div className="metric-label">Medium-SIF-P</div><div className="metric-value orange">{d.nearMissMetrics?.bySeverity?.medium || 0}</div></div>
                    <div className="metric"><div className="metric-label">Low</div><div className="metric-value green">{d.nearMissMetrics?.bySeverity?.low || 0}</div></div>
                  </div>
                </div>
              </div>

              {/* LSR Audits */}
              <div className="panel">
                <div className="panel-header">🔍 Life-Saving Rules Audits</div>
                <div className="panel-content">
                  <div style={{textAlign: 'center', marginBottom: '12px'}}>
                    <div style={{fontSize: '28px', fontWeight: 700, color: '#8b5cf6'}}>{d.lsrAuditCounts?.total || 0}</div>
                    <div style={{fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase'}}>Total LSR Audits</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric"><div className="metric-label">Confined Space</div><div className="metric-value purple">{d.lsrAuditCounts?.confinedSpace || 0}</div></div>
                    <div className="metric"><div className="metric-label">Hot Work</div><div className="metric-value purple">{d.lsrAuditCounts?.hotWork || 0}</div></div>
                    <div className="metric"><div className="metric-label">Driving</div><div className="metric-value purple">{d.lsrAuditCounts?.driving || 0}</div></div>
                    <div className="metric"><div className="metric-label">Working at Heights</div><div className="metric-value purple">{d.lsrAuditCounts?.workingAtHeights || 0}</div></div>
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
}}
