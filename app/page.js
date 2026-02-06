'use client'

import { useState, useEffect } from 'react'
import { supabase, getDashboardData } from '../lib/supabase'
import { getCurrentUser, signOut, getCompanyAccess } from '../lib/auth'

const COMPANIES = ['All', 'A-C Electric', 'AKE-Line', 'Apache Corp.', 'Armstrong Oil & Gas', 'ASRC Energy Services', 'CCI-Industrial', 'Chosen Construction', 'CINGSA', 'Coho Enterprises', 'Conam Construction', 'ConocoPhillips', 'Five Star Oilfield Services', 'Fox Energy Services', 'G.A. West', 'GBR Equipment', 'GLM Energy Services', 'Graham Industrial Coatings', 'Harvest Midstream', 'Hilcorp Alaska', 'MagTec Alaska', 'Merkes Builders', 'Nordic-Calista', 'Parker TRS', 'Peninsula Paving', 'Pollard Wireline', 'Ridgeline Oilfield Services', 'Santos', 'Summit Excavation', 'Yellowjacket']

const LOCATIONS = ['All', 'Kenai', 'CIO', 'Beaver Creek', 'Swanson River', 'Ninilchik', 'Nikiski', 'Other Kenai Asset', 'Deadhorse', 'Prudhoe Bay', 'Kuparuk', 'Alpine', 'Willow', 'ENI', 'PIKKA', 'Point Thompson', 'North Star Island', 'Endicott', 'Badami', 'Other North Slope']

const currentYear = new Date().getFullYear()
const YEARS = [String(currentYear), String(currentYear - 1), String(currentYear - 2), 'All']

function formatMoney(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M'
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(1) + 'K'
  return '$' + Math.round(amount).toLocaleString()
}

// ============================================================================
// AREAS NEEDING FOCUS - CONSTANTS
// ============================================================================
const SEVERITY_COLORS = {
  high: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  medium: { bg: '#78350f', text: '#fcd34d', border: '#f59e0b' },
  low: { bg: '#1e3a5f', text: '#93c5fd', border: '#3b82f6' }
}

const SOURCE_ICONS = {
  'LSR Audit': '🔍',
  'BBS Observation': '👀',
  'Near Miss/Good Catch': '⚠️',
  'Incident': '🚨',
  'SAIL Log': '📋',
  'Hazard ID': '⚡',
  'Inspection': '🔧',
  'Corrective Action': '✅',
  'Property Damage': '💥'
}

// ============================================================================
// AREAS NEEDING FOCUS COMPONENT
// ============================================================================
function AreasNeedingFocus({ data }) {
  const [filter, setFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  
  const focusAreas = data?.areasNeedingFocus || []
  
  // Get unique sources for filter
  const sources = [...new Set(focusAreas.map(f => f.source))]
  
  // Apply filters
  const filteredAreas = focusAreas.filter(area => {
    if (filter !== 'all' && area.source !== filter) return false
    if (severityFilter !== 'all' && area.severity !== severityFilter) return false
    return true
  })

  // Count by source for summary
  const countBySource = {}
  focusAreas.forEach(area => {
    countBySource[area.source] = (countBySource[area.source] || 0) + 1
  })

  // Count by severity
  const highCount = focusAreas.filter(a => a.severity === 'high').length
  const mediumCount = focusAreas.filter(a => a.severity === 'medium').length
  const lowCount = focusAreas.filter(a => a.severity === 'low').length

  return (
    <div className="panel" style={{ marginTop: '16px' }}>
      <div className="panel-header" style={{ 
        background: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <span>⚠️ Areas Needing Focus ({focusAreas.length} items from {sources.length} sources)</span>
        
        {/* Quick severity summary */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
          <span style={{ 
            background: SEVERITY_COLORS.high.bg, 
            color: SEVERITY_COLORS.high.text,
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 600
          }}>
            🔴 {highCount} High
          </span>
          <span style={{ 
            background: SEVERITY_COLORS.medium.bg, 
            color: SEVERITY_COLORS.medium.text,
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 600
          }}>
            🟡 {mediumCount} Med
          </span>
          <span style={{ 
            background: SEVERITY_COLORS.low.bg, 
            color: SEVERITY_COLORS.low.text,
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 600
          }}>
            🔵 {lowCount} Low
          </span>
        </div>
      </div>
      
      <div className="panel-content">
        {/* Source Summary Cards */}
        {Object.keys(countBySource).length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {Object.entries(countBySource).map(([source, count]) => (
              <div
                key={source}
                onClick={() => setFilter(filter === source ? 'all' : source)}
                style={{
                  background: filter === source ? '#f97316' : '#0f172a',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: filter === source ? '1px solid #fb923c' : '1px solid #334155',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '16px' }}>{SOURCE_ICONS[source] || '📊'}</div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  color: filter === source ? '#fff' : '#f97316'
                }}>
                  {count}
                </div>
                <div style={{ 
                  fontSize: '8px', 
                  color: filter === source ? '#fff' : '#64748b',
                  textTransform: 'uppercase'
                }}>
                  {source}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '12px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>FILTER BY:</span>
          
          {/* Source Filter */}
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#e2e8f0'
            }}
          >
            <option value="all">All Sources</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          
          {/* Severity Filter */}
          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#e2e8f0'
            }}
          >
            <option value="all">All Severities</option>
            <option value="high">High Only</option>
            <option value="medium">Medium Only</option>
            <option value="low">Low Only</option>
          </select>
          
          {(filter !== 'all' || severityFilter !== 'all') && (
            <button
              onClick={() => { setFilter('all'); setSeverityFilter('all'); }}
              style={{
                background: '#334155',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
          
          <span style={{ fontSize: '10px', color: '#64748b', marginLeft: 'auto' }}>
            Showing {filteredAreas.length} of {focusAreas.length}
          </span>
        </div>

        {/* Focus Areas Table */}
        <div className="scrollable" style={{ maxHeight: '400px' }}>
          {filteredAreas.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>
              {focusAreas.length === 0 
                ? '✅ No issues identified - Great job!' 
                : 'No items match the selected filters'}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Issue</th>
                  <th style={{ width: '50px' }}>Count</th>
                  <th>Severity</th>
                  <th>Top Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredAreas.map((focus, i) => {
                  const severityColors = SEVERITY_COLORS[focus.severity] || SEVERITY_COLORS.low
                  
                  return (
                    <tr key={i} style={{ 
                      borderLeft: `3px solid ${severityColors.border}`,
                    }}>
                      <td style={{ textAlign: 'center', fontSize: '14px' }}>
                        {SOURCE_ICONS[focus.source] || '📊'}
                      </td>
                      <td style={{ 
                        fontSize: '10px', 
                        color: '#94a3b8',
                        whiteSpace: 'nowrap'
                      }}>
                        {focus.source}
                      </td>
                      <td style={{ 
                        color: '#f97316', 
                        fontWeight: 600,
                        fontSize: '11px'
                      }}>
                        {focus.category}
                      </td>
                      <td style={{ fontSize: '11px', maxWidth: '250px' }}>
                        {focus.issue}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontWeight: 'bold', 
                          fontSize: '14px',
                          color: focus.count >= 5 ? '#ef4444' : focus.count >= 3 ? '#f97316' : '#eab308'
                        }}>
                          {focus.count}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          background: severityColors.bg,
                          color: severityColors.text,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '9px',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {focus.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {focus.topLocation}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Legend */}
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '12px', 
          borderTop: '1px solid #334155',
          fontSize: '9px',
          color: '#64748b',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <span><strong>Data Sources:</strong></span>
          {Object.entries(SOURCE_ICONS).map(([source, icon]) => (
            <span key={source}>{icon} {source}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// INJURY PROBABILITY GAUGE
// ============================================================================
function InjuryProbabilityGauge({ data }) {
  const calculateProbability = () => {
    let baseProbability = 5
    const total = data?.bbsMetrics?.total || 0
    const atRisk = data?.bbsMetrics?.atRisk || 0
    const atRiskRate = total > 0 ? (atRisk / total) * 100 : 0
    if (atRiskRate > 30) baseProbability *= 1.5
    else if (atRiskRate > 20) baseProbability *= 1.3
    else if (atRiskRate < 5) baseProbability *= 0.8
    
    const leadingTotal = (data?.leadingIndicators?.bbsObservations || 0) + (data?.leadingIndicators?.thas || 0) + (data?.leadingIndicators?.safetyMeetings || 0) + (data?.leadingIndicators?.hazardIds || 0)
    if (leadingTotal >= 50) baseProbability *= 0.6
    else if (leadingTotal >= 20) baseProbability *= 0.8
    else if (leadingTotal < 5) baseProbability *= 1.5
    
    const sifRate = data?.sifMetrics?.sifPotentialRate || 0
    if (sifRate > 20) baseProbability *= 1.4
    else if (sifRate > 10) baseProbability *= 1.2
    
    const openItems = data?.aging?.over30Days || 0
    if (openItems > 10) baseProbability *= 1.3
    else if (openItems > 5) baseProbability *= 1.15
    
    const daysSince = data?.engagementMetrics?.daysSinceLastSubmission || 0
    if (daysSince > 14) baseProbability *= 1.4
    else if (daysSince > 7) baseProbability *= 1.2
    
    return Math.min(95, Math.max(1, Math.round(baseProbability)))
  }
  
  const probability = calculateProbability()
  const riskLevel = probability >= 25 ? 'High' : probability >= 15 ? 'Elevated' : probability >= 8 ? 'Moderate' : 'Low'
  const color = probability >= 25 ? '#dc2626' : probability >= 15 ? '#f97316' : probability >= 8 ? '#eab308' : '#22c55e'
  const rotation = (probability / 100) * 180 - 90

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
        🎯 30-Day Injury Probability
      </div>
      <div className="panel-content" style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '180px', height: '100px', margin: '0 auto 12px' }}>
          <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 60 35" fill="none" stroke="#22c55e" strokeWidth="16" strokeLinecap="round" />
            <path d="M 60 35 A 80 80 0 0 1 100 20" fill="none" stroke="#eab308" strokeWidth="16" />
            <path d="M 100 20 A 80 80 0 0 1 140 35" fill="none" stroke="#f97316" strokeWidth="16" />
            <path d="M 140 35 A 80 80 0 0 1 180 100" fill="none" stroke="#dc2626" strokeWidth="16" strokeLinecap="round" />
            <line x1="100" y1="100" x2="100" y2="35" stroke={color} strokeWidth="3" strokeLinecap="round" transform={`rotate(${rotation}, 100, 100)`} />
            <circle cx="100" cy="100" r="6" fill={color} />
          </svg>
        </div>
        <div style={{ fontSize: '42px', fontWeight: 700, color, lineHeight: 1 }}>{probability}%</div>
        <div style={{ display: 'inline-block', marginTop: '8px', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: `${color}22`, color }}>{riskLevel} Risk</div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>95% CI: {Math.max(1, probability - 10)}% - {Math.min(95, probability + 10)}%</div>
      </div>
    </div>
  )
}

// ============================================================================
// SIF POTENTIAL PREDICTOR
// ============================================================================
function SIFPotentialPredictor({ data }) {
  const calculateSIFScore = () => {
    let score = 0
    const factors = []
    const recommendations = []
    
    const energyTypes = data?.energySourceMetrics?.byEnergyType || {}
    const highEnergy = ['Gravity', 'Electrical', 'Pressure', 'Mechanical']
    highEnergy.forEach(type => {
      if ((energyTypes[type] || 0) > 10) { score += 15; factors.push(`High ${type} energy exposure`) }
    })
    
    const controlScore = data?.energySourceMetrics?.controlHierarchyScore || 50
    if (controlScore < 40) { score += 20; factors.push('Weak control hierarchy'); recommendations.push({ priority: 'High', action: 'Upgrade to engineering controls' }) }
    
    const sifCount = data?.sifMetrics?.sifPotentialCount || 0
    if (sifCount > 5) { score += 25; factors.push(`${sifCount} SIF-potential events`) }
    else if (sifCount > 2) { score += 15; factors.push(`${sifCount} SIF-potential events`) }
    
    const lsrIssues = data?.areasNeedingFocus?.filter(a => a.source === 'LSR Audit') || []
    if (lsrIssues.length > 3) { score += 20; factors.push(`${lsrIssues.length} LSR compliance gaps`); recommendations.push({ priority: 'Critical', action: 'Address Life-Saving Rule violations' }) }
    
    return { score: Math.min(100, score), factors, recommendations }
  }
  
  const sif = calculateSIFScore()
  const level = sif.score >= 60 ? 'Critical' : sif.score >= 40 ? 'High' : sif.score >= 20 ? 'Moderate' : 'Low'
  const color = sif.score >= 60 ? '#dc2626' : sif.score >= 40 ? '#f97316' : sif.score >= 20 ? '#eab308' : '#22c55e'

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)' }}>☠️ SIF Potential Predictor</div>
      <div className="panel-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: `conic-gradient(${color} ${sif.score * 3.6}deg, #1e293b ${sif.score * 3.6}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color }}>{sif.score}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color }}>{level} SIF Risk</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Serious Injury/Fatality Potential</div>
          </div>
        </div>
        {sif.factors.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Risk Factors:</div>
            {sif.factors.slice(0, 3).map((f, i) => (<div key={i} style={{ fontSize: '10px', color: '#f97316', padding: '2px 0' }}>⚠️ {f}</div>))}
          </div>
        )}
        {sif.recommendations.length > 0 && (
          <div style={{ background: '#0f172a', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '9px', color: '#22c55e', marginBottom: '4px' }}>RECOMMENDED ACTIONS</div>
            {sif.recommendations.map((r, i) => (<div key={i} style={{ fontSize: '10px', color: '#94a3b8' }}><span style={{ color: r.priority === 'Critical' ? '#ef4444' : '#f97316' }}>{r.priority}:</span> {r.action}</div>))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// LOCATION RISK HEAT MAP
// ============================================================================
function LocationRiskHeatMap({ data }) {
  const buildLocationRisk = () => {
    const locationRisks = {}
    ;(data?.openItems || []).forEach(item => {
      const loc = item.location || 'Unknown'
      if (!locationRisks[loc]) locationRisks[loc] = { incidents: 0, atRisk: 0, sif: 0, openItems: 0 }
      locationRisks[loc].openItems++
    })
    return Object.entries(locationRisks).map(([location, d]) => ({
      location, ...d,
      riskScore: Math.min(100, (d.incidents * 20) + (d.sif * 30) + (d.atRisk * 5) + (d.openItems * 10))
    })).sort((a, b) => b.riskScore - a.riskScore).slice(0, 6)
  }
  
  const locations = buildLocationRisk()
  const getColor = (score) => score >= 60 ? '#dc2626' : score >= 40 ? '#f97316' : score >= 20 ? '#eab308' : '#22c55e'

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)' }}>🗺️ Location Risk Heat Map</div>
      <div className="panel-content">
        {locations.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#22c55e', padding: '20px' }}>✅ No high-risk locations identified</div>
        ) : (
          locations.map((loc, i) => (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{loc.location}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: getColor(loc.riskScore) }}>{loc.riskScore}</span>
              </div>
              <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${loc.riskScore}%`, background: getColor(loc.riskScore), borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                <span>📋 {loc.openItems} open</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// COMPLIANCE DASHBOARD
// ============================================================================
function ComplianceDashboard({ data }) {
  const [activeTab, setActiveTab] = useState('lsr')
  const lsrIssues = data?.areasNeedingFocus?.filter(a => a.source === 'LSR Audit') || []
  const totalLsrAudits = data?.lsrAuditCounts?.total || 0
  const totalIssues = lsrIssues.reduce((sum, i) => sum + i.count, 0)
  const lsrCompliance = totalLsrAudits > 0 ? Math.round(((totalLsrAudits - totalIssues) / totalLsrAudits) * 100) : 100
  
  const lsrCategories = [
    { name: 'Confined Space', count: data?.lsrAuditCounts?.confinedSpace || 0 },
    { name: 'Driving', count: data?.lsrAuditCounts?.driving || 0 },
    { name: 'Energy Isolation', count: data?.lsrAuditCounts?.energyIsolation || 0 },
    { name: 'Fall Protection', count: data?.lsrAuditCounts?.fallProtection || 0 },
    { name: 'Lifting Operations', count: data?.lsrAuditCounts?.liftingOperations || 0 },
    { name: 'Line of Fire', count: data?.lsrAuditCounts?.lineOfFire || 0 },
    { name: 'Work Permits', count: data?.lsrAuditCounts?.workPermits || 0 },
  ].filter(c => c.count > 0)

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)' }}>✅ Compliance Dashboard</div>
      <div className="panel-content">
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button onClick={() => setActiveTab('lsr')} style={{ flex: 1, padding: '6px', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', background: activeTab === 'lsr' ? '#059669' : '#1e293b', color: activeTab === 'lsr' ? '#fff' : '#94a3b8' }}>Life-Saving Rules</button>
          <button onClick={() => setActiveTab('inspection')} style={{ flex: 1, padding: '6px', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', background: activeTab === 'inspection' ? '#059669' : '#1e293b', color: activeTab === 'inspection' ? '#fff' : '#94a3b8' }}>Inspections</button>
        </div>
        {activeTab === 'lsr' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: lsrCompliance >= 80 ? '#22c55e' : lsrCompliance >= 60 ? '#eab308' : '#ef4444' }}>{lsrCompliance}%</div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>LSR Compliance Rate</div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>{totalLsrAudits} audits • {totalIssues} issues</div>
            </div>
            <div className="metrics-grid">
              {lsrCategories.map(cat => {
                const catIssues = lsrIssues.filter(i => i.category.includes(cat.name)).length
                const catCompliance = cat.count > 0 ? Math.round(((cat.count - catIssues) / cat.count) * 100) : 100
                return (<div key={cat.name} className="metric"><div className="metric-label">{cat.name}</div><div className="metric-value" style={{ color: catCompliance >= 80 ? '#22c55e' : catCompliance >= 60 ? '#eab308' : '#ef4444' }}>{catCompliance}%</div></div>)
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: '#22d3ee' }}>{data?.totalInspections || 0}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>Total Inspections</div>
            </div>
            <div className="metrics-grid">
              <div className="metric"><div className="metric-label">Fire Ext.</div><div className="metric-value cyan">{data?.inspectionCounts?.fireExtinguisher || 0}</div></div>
              <div className="metric"><div className="metric-label">Eyewash</div><div className="metric-value cyan">{data?.inspectionCounts?.eyewash || 0}</div></div>
              <div className="metric"><div className="metric-label">Harness</div><div className="metric-value cyan">{data?.inspectionCounts?.harness || 0}</div></div>
              <div className="metric"><div className="metric-label">Vehicle</div><div className="metric-value cyan">{data?.inspectionCounts?.vehicle || 0}</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// INCIDENT RECURRENCE PATTERNS
// ============================================================================
function IncidentRecurrencePanel({ data }) {
  const analyzePatterns = () => {
    const openItems = data?.openItems || []
    if (openItems.length < 2) return { patterns: [], risk: 'Insufficient Data' }
    const patterns = []
    const byForm = {}, byLocation = {}
    openItems.forEach(item => {
      const form = item.form || 'Unknown'
      const loc = item.location || 'Unknown'
      byForm[form] = (byForm[form] || 0) + 1
      byLocation[loc] = (byLocation[loc] || 0) + 1
    })
    Object.entries(byForm).forEach(([form, count]) => { if (count >= 2) patterns.push({ pattern: `${form} items`, count, recommendation: `Prioritize ${form} closure` }) })
    Object.entries(byLocation).forEach(([loc, count]) => { if (count >= 2) patterns.push({ pattern: `Items at ${loc}`, count, recommendation: `Site focus for ${loc}` }) })
    return { patterns: patterns.sort((a, b) => b.count - a.count).slice(0, 4), risk: patterns.length > 3 ? 'High' : patterns.length > 1 ? 'Medium' : 'Low' }
  }
  
  const analysis = analyzePatterns()
  const riskColor = analysis.risk === 'High' ? '#dc2626' : analysis.risk === 'Medium' ? '#f97316' : '#22c55e'

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #831843 0%, #be185d 100%)' }}>🔄 Recurrence Patterns</div>
      <div className="panel-content">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '16px', background: `${riskColor}22`, color: riskColor, fontSize: '11px', fontWeight: 600 }}>{analysis.risk} Risk</span>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>{analysis.patterns.length} pattern(s) identified</div>
        </div>
        {analysis.patterns.length > 0 ? (
          analysis.patterns.map((p, i) => (
            <div key={i} style={{ padding: '8px', background: '#0f172a', borderRadius: '6px', marginBottom: '6px', borderLeft: '3px solid #f97316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{p.pattern}</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: '#78350f', color: '#fcd34d' }}>{p.count}x</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>💡 {p.recommendation}</div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#22c55e', padding: '16px' }}>✅ No significant patterns</div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// LEADING INDICATOR CASCADE
// ============================================================================
function LeadingIndicatorCascade({ data }) {
  const leading = data?.leadingIndicators || {}
  const totalLeading = (leading.bbsObservations || 0) + (leading.thas || 0) + (leading.safetyMeetings || 0) + (leading.toolboxMeetings || 0) + (leading.hazardIds || 0) + (leading.hseContacts || 0)
  const totalLagging = (data?.laggingIndicators?.openIncidents || 0) + (data?.laggingIndicators?.closedIncidents || 0)
  const ratio = totalLagging > 0 ? Math.round((totalLeading / totalLagging) * 10) / 10 : totalLeading
  const effectiveness = totalLeading + totalLagging > 0 ? Math.round((totalLeading / (totalLeading + totalLagging)) * 100) : 100
  const ratioColor = ratio >= 10 ? '#22c55e' : ratio >= 5 ? '#eab308' : '#ef4444'
  const status = ratio >= 10 ? 'Excellent' : ratio >= 5 ? 'Good' : ratio >= 2 ? 'Needs Improvement' : 'Critical'

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' }}>📈 Leading Indicator Effectiveness</div>
      <div className="panel-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', padding: '10px', background: '#0f172a', borderRadius: '6px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: ratioColor }}>{ratio}:1</div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Lead/Lag Ratio</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: '#0f172a', borderRadius: '6px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: effectiveness >= 70 ? '#22c55e' : '#eab308' }}>{effectiveness}%</div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Intervention Rate</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', background: `${ratioColor}22`, color: ratioColor, fontSize: '10px', fontWeight: 600 }}>{status}</span>
        </div>
        <div className="metrics-grid">
          <div className="metric"><div className="metric-label">BBS</div><div className="metric-value green">{leading.bbsObservations || 0}</div></div>
          <div className="metric"><div className="metric-label">THA/JSA</div><div className="metric-value green">{leading.thas || 0}</div></div>
          <div className="metric"><div className="metric-label">Meetings</div><div className="metric-value green">{(leading.safetyMeetings || 0) + (leading.toolboxMeetings || 0)}</div></div>
          <div className="metric"><div className="metric-label">Hazard IDs</div><div className="metric-value green">{leading.hazardIds || 0}</div></div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// RISK FORECAST TIMELINE
// ============================================================================
function RiskForecastTimeline({ data }) {
  const forecast = data?.riskForecast30Day || 0
  const level = forecast >= 70 ? 'Critical' : forecast >= 50 ? 'High' : forecast >= 30 ? 'Elevated' : 'Low'
  const color = forecast >= 70 ? '#dc2626' : forecast >= 50 ? '#f97316' : forecast >= 30 ? '#eab308' : '#22c55e'
  const recommendations = []
  if (data?.engagementMetrics?.daysSinceLastSubmission > 7) recommendations.push({ priority: 'High', action: 'Increase safety engagement', detail: `${data.engagementMetrics.daysSinceLastSubmission} days since last activity` })
  if (data?.aging?.avgDaysOpen > 30) recommendations.push({ priority: 'Medium', action: 'Close aging items', detail: `Average age: ${data.aging.avgDaysOpen} days` })
  if (data?.trends?.atRiskBehaviors?.direction === 'up') recommendations.push({ priority: 'High', action: 'Address rising at-risk behaviors', detail: `Up ${data.trends.atRiskBehaviors.percent}%` })

  return (
    <div className="panel">
      <div className="panel-header" style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)' }}>🔮 Risk Forecast Details</div>
      <div className="panel-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: `${color}22`, borderRadius: '8px', border: `1px solid ${color}44`, marginBottom: '12px' }}>
          <div style={{ fontSize: '42px', fontWeight: 700, color, lineHeight: 1 }}>{forecast}</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color }}>{level} Risk</div>
            <div style={{ fontSize: '10px', color: `${color}cc` }}>Projected for next 30 days</div>
          </div>
        </div>
        {recommendations.length > 0 && (
          <>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Recommended Actions:</div>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ padding: '8px', background: '#0f172a', borderRadius: '6px', marginBottom: '6px', borderLeft: `3px solid ${rec.priority === 'High' ? '#f97316' : '#eab308'}` }}>
                <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 500 }}>{rec.action}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{rec.detail}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TREND ARROW COMPONENT
// ============================================================================
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

// ============================================================================
// ENGAGEMENT ALERT COMPONENT
// ============================================================================
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

// ============================================================================
// TRUECOST TREND GRAPH COMPONENT
// ============================================================================
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

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [trueCostData, setTrueCostData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(String(currentYear))
  const [company, setCompany] = useState('All')
  const [location, setLocation] = useState('All')
  
  // Auth state
  const [authLoading, setAuthLoading] = useState(true)
  const [userAccess, setUserAccess] = useState(null) // { company, isAdmin, email }
  const [userName, setUserName] = useState('')

  // Check auth on mount
  useEffect(() => {
    checkAuth()
    
    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login'
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])

  const checkAuth = async () => {
    const result = await getCurrentUser()
    
    if (!result || !result.authorized) {
      // Not logged in or not authorized → redirect to login
      window.location.href = '/login'
      return
    }
    
    setUserAccess(result.access)
    setUserName(result.user.email)
    
    // If client user, lock company filter to their company
    if (!result.access.isAdmin) {
      setCompany(result.access.company)
    }
    
    setAuthLoading(false)
  }

  // Companies list - filtered for client users
  const availableCompanies = userAccess?.isAdmin 
    ? COMPANIES 
    : [userAccess?.company].filter(Boolean)

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
    if (!authLoading && userAccess) {
      loadData()
    }
  }, [year, company, location, authLoading])

  const handlePrint = () => {
    window.print()
  }

  const d = data
  const tc = trueCostData

  return (
    <div>
      {/* Auth Loading */}
      {authLoading ? (
        <div style={{ 
          minHeight: '100vh', 
          background: '#0f172a', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="spinner"></div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Verifying access...</p>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <img src="/Logo.png" alt="SLP Alaska Logo" style={{height: '60px', marginRight: '15px'}} />
          <div>
            <h1>AnthroSafe™ Powered by Field Driven Data™</h1>
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
          {userAccess?.isAdmin ? (
            <div className="filter-group">
              <span className="filter-label">Company</span>
              <select className="filter-select" value={company} onChange={(e) => setCompany(e.target.value)}>
                {COMPANIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Companies' : c}</option>)}
              </select>
            </div>
          ) : (
            <div className="filter-group">
              <span className="filter-label">Company</span>
              <div style={{ 
                padding: '6px 12px', 
                background: '#0f766e', 
                borderRadius: '6px', 
                color: '#5eead4', 
                fontSize: '13px', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🔒 {company}
              </div>
            </div>
          )}
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

      {/* User Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 20px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: '12px'
      }}>
        <div style={{ color: '#64748b' }}>
          Logged in as <span style={{ color: '#5eead4', fontWeight: 600 }}>{userName}</span>
          {userAccess?.isAdmin && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#7c3aed', color: 'white', borderRadius: '10px', fontSize: '10px', fontWeight: 600 }}>ADMIN</span>}
          {!userAccess?.isAdmin && <span style={{ marginLeft: '8px', color: '#94a3b8' }}>| {company}</span>}
        </div>
        <button 
          onClick={signOut}
          style={{
            background: 'none',
            border: '1px solid #475569',
            color: '#94a3b8',
            padding: '4px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444' }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#475569'; e.target.style.color = '#94a3b8' }}
        >
          Sign Out
        </button>
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

              {/* 30-Day Risk Forecast */}
              <div className={`score-card forecast`}>
                <div className="score-label">🔮 30-Day Forecast</div>
                <div className={`score-value ${d.riskForecast30Day <= 30 ? 'good' : d.riskForecast30Day <= 60 ? 'warning' : 'danger'}`}>
                  {d.riskForecast30Day || 0}
                </div>
                <div className="score-detail">Predicted risk level</div>
              </div>

              {/* TrueCost Card */}
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

            {/* TrueCost Trend Graph Panel */}
            <div className="panel" style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
              <div className="panel-header" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)' }}>
                💰 TrueCost™ Monthly Trend
              </div>
              <div className="panel-content">
                {tc && <TrueCostTrendGraph monthlyData={tc.monthlyTrend} />}
              </div>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
              {/* Engagement & Activity Panel */}
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
                    <div className="metric"><div className="metric-label">BBS</div><div className="metric-value green">{d.leadingIndicators?.bbsObservations || 0}</div></div>
                    <div className="metric"><div className="metric-label">THA/JSA</div><div className="metric-value green">{d.leadingIndicators?.thas || 0}</div></div>
                    <div className="metric"><div className="metric-label">Hazard IDs</div><div className="metric-value green">{d.leadingIndicators?.hazardIds || 0}</div></div>
                    <div className="metric"><div className="metric-label">Meetings</div><div className="metric-value green">{(d.leadingIndicators?.safetyMeetings || 0) + (d.leadingIndicators?.toolboxMeetings || 0)}</div></div>
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
                    <div className="metric"><div className="metric-label">Total Incidents</div><div className="metric-value red">{(d.laggingIndicators?.openIncidents || 0) + (d.laggingIndicators?.closedIncidents || 0)}</div></div>
                    <div className="metric"><div className="metric-label">Open</div><div className="metric-value orange">{d.laggingIndicators?.openIncidents || 0}</div></div>
                    <div className="metric"><div className="metric-label">Open SAIL</div><div className="metric-value orange">{d.laggingIndicators?.sailOpen || 0}</div></div>
                    <div className="metric"><div className="metric-label">Property Damage</div><div className="metric-value purple">{d.laggingIndicators?.propertyDamage || 0}</div></div>
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
                    <div className="metric"><div className="metric-label">Driving</div><div className="metric-value purple">{d.lsrAuditCounts?.driving || 0}</div></div>
                    <div className="metric"><div className="metric-label">Energy Isolation</div><div className="metric-value purple">{d.lsrAuditCounts?.energyIsolation || 0}</div></div>
                    <div className="metric"><div className="metric-label">Fall Protection / Heights</div><div className="metric-value purple">{d.lsrAuditCounts?.fallProtection || 0}</div></div>
                    <div className="metric"><div className="metric-label">Lifting Ops</div><div className="metric-value purple">{d.lsrAuditCounts?.liftingOperations || 0}</div></div>
                    <div className="metric"><div className="metric-label">Line of Fire</div><div className="metric-value purple">{d.lsrAuditCounts?.lineOfFire || 0}</div></div>
                    <div className="metric"><div className="metric-label">Work Permits / Hot Work</div><div className="metric-value purple">{d.lsrAuditCounts?.workPermits || 0}</div></div>
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

            {/* ================================================================
                ADVANCED ANALYTICS - Predictive Modeling & Risk Assessment
                ================================================================ */}
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 700, 
                color: '#e2e8f0', 
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🧠</span> Advanced Predictive Analytics
              </div>
              <div className="main-grid">
                <InjuryProbabilityGauge data={d} />
                <SIFPotentialPredictor data={d} />
                <RiskForecastTimeline data={d} />
                <ComplianceDashboard data={d} />
                <LeadingIndicatorCascade data={d} />
                <LocationRiskHeatMap data={d} />
                <IncidentRecurrencePanel data={d} />
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

            {/* ================================================================
                AREAS NEEDING FOCUS - Using the new component
                ================================================================ */}
            <AreasNeedingFocus data={d} />

            <div className="last-updated">
              Last Updated: {d.timestamp ? new Date(d.timestamp).toLocaleString() : 'N/A'} | {d.fromCache ? `Cache age: ${d.cacheAge || 0} minutes` : 'Live data'}
            </div>
          </>
        )}
      </div>

      <div className="footer">
        AnthroSafe™ Powered by Field Driven Data™ | © 2026 SLP Alaska
      </div>
    </>
    )}
    </div>
  )
}
