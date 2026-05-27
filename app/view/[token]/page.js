'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase, getDashboardData } from '@/lib/supabase';

// ============================================================================
// SecureCompanyView
// Public, token-gated read-only dashboard for a single client company.
// Validates the URL token against company_view_tokens, then renders metrics
// computed by getDashboardData() in lib/supabase.js — the SAME function
// that powers the internal portal Dashboard. One source of truth.
// ============================================================================
export default function SecureCompanyView() {
  const params = useParams();
  const token = params?.token;

  const [companyName, setCompanyName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function validateTokenAndLoadData() {
      if (!token) {
        setError('No access token provided');
        setLoading(false);
        return;
      }

      try {
        // 1. Validate token, resolve company
        const { data: tokenData, error: tokenError } = await supabase
          .from('company_view_tokens')
          .select('company_name, is_active')
          .eq('token', token)
          .single();

        if (tokenError || !tokenData) {
          setError('Invalid or expired access link');
          setLoading(false);
          return;
        }

        if (!tokenData.is_active) {
          setError('This access link has been deactivated');
          setLoading(false);
          return;
        }

        setCompanyName(tokenData.company_name);

        // 2. Stamp last-access (non-blocking)
        supabase
          .from('company_view_tokens')
          .update({ last_accessed: new Date().toISOString() })
          .eq('token', token)
          .then(() => {});

        // 3. Pull metrics via the same function the portal Dashboard uses.
        //    'All' filters match the portal default — full company, all locations, all years.
        const dashData = await getDashboardData(tokenData.company_name, 'All', 'All');
        setData(dashData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError('An error occurred loading the dashboard');
        setLoading(false);
      }
    }

    validateTokenAndLoadData();
  }, [token]);

  // -------------------- LOADING --------------------
  if (loading) {
    return (
      <div style={pageBg}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading Dashboard...</div>
          <div style={{ color: '#94a3b8' }}>Validating access...</div>
        </div>
      </div>
    );
  }

  // -------------------- ERROR --------------------
  if (error) {
    return (
      <div style={pageBg}>
        <div style={{
          textAlign: 'center',
          background: '#1e293b',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #ef4444'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '24px', marginBottom: '12px', color: '#ef4444' }}>Access Denied</div>
          <div style={{ color: '#94a3b8' }}>{error}</div>
          <div style={{ marginTop: '24px', fontSize: '14px', color: '#64748b' }}>
            Contact brian@slpalaska.com if you need assistance
          </div>
        </div>
      </div>
    );
  }

  // -------------------- METRICS (adapted to getDashboardData shape) --------------------
  const bbs = data.bbsMetrics || {};
  const leading = data.leadingIndicators || {};
  const lagging = data.laggingIndicators || {};
  const aging = data.aging || {};
  const openItems = data.openItems || [];
  const sif = data.sifMetrics || {};

  const totalIncidents = (lagging.openIncidents || 0) + (lagging.closedIncidents || 0);
  const totalOpen = (lagging.openIncidents || 0) + (lagging.sailOpen || 0);
  const safeRatioDisplay =
    typeof bbs.safeRatio === 'number' ? bbs.safeRatio.toFixed(1) : (bbs.safeRatio || 0);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      padding: '20px',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: '18px', color: 'white', opacity: 0.9 }}>Safety Dashboard</h1>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#5eead4', margin: '8px 0' }}>{companyName}</div>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '6px 16px',
            borderRadius: '20px',
            display: 'inline-block',
            fontSize: '13px'
          }}>
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>

        {/* Alert Banner */}
        {(lagging.openIncidents || 0) > 0 ? (
          <Banner
            color="red"
            icon="🚨"
            label="Action Required:"
            text={`You have ${lagging.openIncidents} open incident(s) and ${lagging.sailOpen || 0} open SAIL item(s) requiring attention.`}
          />
        ) : (lagging.sailOpen || 0) > 0 ? (
          <Banner
            color="amber"
            icon="⚠️"
            label="Attention:"
            text={`You have ${lagging.sailOpen} open SAIL item(s) that need to be addressed.`}
          />
        ) : (
          <Banner
            color="green"
            icon="✅"
            label="Great work!"
            text="No open incidents or overdue items."
          />
        )}

        {/* Hero Score Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <ScoreCard
            label="Safety Culture Index"
            value={data.safetyCultureIndex ?? 0}
            detail="0–100"
            color={
              (data.safetyCultureIndex ?? 0) >= 70 ? '#22c55e'
              : (data.safetyCultureIndex ?? 0) >= 40 ? '#eab308' : '#ef4444'
            }
          />
          <ScoreCard
            label="Predictive Risk"
            value={data.predictiveRiskScore ?? 0}
            detail="Lower is better"
            color={
              (data.predictiveRiskScore ?? 0) <= 30 ? '#22c55e'
              : (data.predictiveRiskScore ?? 0) <= 60 ? '#eab308' : '#ef4444'
            }
          />
          <ScoreCard
            label="Safe / At-Risk Ratio"
            value={`${safeRatioDisplay}:1`}
            detail="Target: 5:1"
            color={parseFloat(safeRatioDisplay) >= 5 ? '#22c55e' : parseFloat(safeRatioDisplay) >= 2 ? '#eab308' : '#ef4444'}
          />
          <ScoreCard
            label="Job Stop Rate"
            value={`${bbs.jobStopRate || 0}%`}
            detail={`${bbs.jobStops || 0} stops`}
            color={(bbs.jobStopRate || 0) >= 50 ? '#22c55e' : '#f97316'}
          />
          <ScoreCard
            label="Open Items"
            value={totalOpen}
            detail="Requiring action"
            color={totalOpen === 0 ? '#22c55e' : totalOpen > 3 ? '#ef4444' : '#eab308'}
          />
          <ScoreCard
            label="Avg Days Open"
            value={aging.avgDaysOpen || 0}
            detail={`${aging.over30Days || 0} > 30d`}
            color={(aging.avgDaysOpen || 0) > 30 ? '#ef4444' : (aging.avgDaysOpen || 0) > 14 ? '#eab308' : '#22c55e'}
          />
        </div>

        {/* Leading / Lagging Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <Panel title="📈 Leading Indicators" gradient="linear-gradient(135deg, #065f46 0%, #047857 100%)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <MetricItem label="BBS Observations" value={leading.bbsObservations || bbs.total || 0} color="#22c55e" />
              <MetricItem label="THA / JSAs" value={leading.thas || 0} color="#22c55e" />
              <MetricItem label="Hazard IDs" value={leading.hazardIds || 0} color="#22c55e" />
              <MetricItem label="Good Catches" value={leading.goodCatches || 0} color="#22c55e" />
              <MetricItem label="STOP Take 5" value={leading.stopTake5 || 0} color="#22c55e" />
              <MetricItem label="HSE Contacts" value={leading.hseContacts || 0} color="#22c55e" />
              <MetricItem label="Toolbox Talks" value={leading.toolboxMeetings || 0} color="#22c55e" />
              <MetricItem label="Safety Meetings" value={leading.safetyMeetings || 0} color="#22c55e" />
            </div>
          </Panel>

          <Panel title="📉 Lagging Indicators" gradient="linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <MetricItem label="Total Incidents" value={totalIncidents} color={totalIncidents > 0 ? '#ef4444' : '#22c55e'} />
              <MetricItem label="Open Incidents" value={lagging.openIncidents || 0} color={(lagging.openIncidents || 0) > 0 ? '#ef4444' : '#22c55e'} />
              <MetricItem label="First Aid" value={lagging.firstAid || 0} color={(lagging.firstAid || 0) > 0 ? '#f97316' : '#22c55e'} />
              <MetricItem label="Recordable" value={lagging.recordable || 0} color={(lagging.recordable || 0) > 0 ? '#ef4444' : '#22c55e'} />
              <MetricItem label="Property Damage" value={lagging.propertyDamage || 0} color={(lagging.propertyDamage || 0) > 0 ? '#f97316' : '#22c55e'} />
              <MetricItem label="SAIL Open" value={lagging.sailOpen || 0} color={(lagging.sailOpen || 0) > 0 ? '#ef4444' : '#22c55e'} />
              <MetricItem label="SAIL Overdue" value={lagging.sailOverdue || 0} color={(lagging.sailOverdue || 0) > 0 ? '#ef4444' : '#22c55e'} />
              <MetricItem label="SIF Potential" value={sif.sifPotentialCount || 0} color={(sif.sifPotentialCount || 0) > 0 ? '#ef4444' : '#22c55e'} />
            </div>
          </Panel>
        </div>

        {/* BBS Breakdown */}
        <Panel title="👀 BBS Observations Breakdown" gradient="linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <MetricItem label="Total" value={bbs.total || 0} color="#3b82f6" />
            <MetricItem label="Safe" value={bbs.safe || 0} color="#22c55e" />
            <MetricItem label="At-Risk" value={bbs.atRisk || 0} color="#ef4444" />
          </div>
        </Panel>

        {/* Open Items (unified: incidents + SAIL + corrective actions) */}
        {openItems.length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '12px 16px', background: '#334155', fontWeight: 600, fontSize: '13px' }}>
              📋 Oldest Open Items
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    <th style={thStyle}>FORM</th>
                    <th style={thStyle}>LOCATION</th>
                    <th style={thStyle}>STATUS</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>DAYS OPEN</th>
                  </tr>
                </thead>
                <tbody>
                  {openItems.slice(0, 15).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={tdStyle}>{item.form || '—'}</td>
                      <td style={tdStyle}>{item.location || '—'}</td>
                      <td style={tdStyle}>
                        <span style={statusPill(item.status)}>{item.status || 'Open'}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        {item.daysOpen ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Areas Needing Focus */}
        {(data.areasNeedingFocus || []).length > 0 && (
          <Panel title="🎯 Areas Needing Focus" gradient="linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.areasNeedingFocus.slice(0, 5).map((area, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#0f172a',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div>
                    <div style={{ color: '#fbbf24', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                      {area.category}
                    </div>
                    <div>{area.issue}</div>
                    {area.topLocation && (
                      <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                        Most often at: {area.topLocation}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', alignSelf: 'center' }}>
                    {area.count}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12px', borderTop: '1px solid #334155', marginTop: '20px' }}>
          <p style={{ margin: 0 }}>AnthroSafe™ Field Driven Safety • © 2026 SLP Alaska, LLC</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px' }}>For questions, contact brian@slpalaska.com</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STYLE HELPERS & SUBCOMPONENTS
// ============================================================================
const pageBg = {
  minHeight: '100vh',
  background: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
};

const thStyle = { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 };
const tdStyle = { padding: '10px 12px' };

function statusPill(status) {
  const s = (status || '').toLowerCase();
  const bg = s.includes('overdue') ? '#7f1d1d'
    : s.includes('draft') ? '#1e40af'
    : '#334155';
  const fg = s.includes('overdue') ? '#fca5a5'
    : s.includes('draft') ? '#bfdbfe'
    : '#e2e8f0';
  return {
    background: bg,
    color: fg,
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 600
  };
}

function Banner({ color, icon, label, text }) {
  const styles = {
    red:   { bg: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', border: '#ef4444' },
    amber: { bg: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)', border: '#f59e0b' },
    green: { bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', border: '#10b981' }
  };
  const s = styles[color] || styles.green;
  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: '10px',
      marginBottom: '20px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <span><strong style={{ color: 'white' }}>{label}</strong> {text}</span>
    </div>
  );
}

function Panel({ title, gradient, children }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{
        padding: '12px 16px',
        background: gradient,
        fontWeight: 600,
        fontSize: '13px'
      }}>
        {title}
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, detail, color }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      borderRadius: '10px',
      padding: '16px',
      textAlign: 'center',
      borderTop: `3px solid ${color}`
    }}>
      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
        {detail}
      </div>
    </div>
  );
}

function MetricItem({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px', background: '#0f172a', borderRadius: '8px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>{label}</div>
    </div>
  );
}
