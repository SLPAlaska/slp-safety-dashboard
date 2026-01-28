'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iypezirwdlqpptjpeeyf.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cGV6aXJ3ZGxxcHB0anBlZXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Nzg3NzYsImV4cCI6MjA4NDI1NDc3Nn0.rfTN8fi9rd6o5rX-scAg9I1BbC-UjM8WoWEXDbrYJD4'
);

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
        // Validate token and get company name
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

        // Update last accessed timestamp
        await supabase
          .from('company_view_tokens')
          .update({ last_accessed: new Date().toISOString() })
          .eq('token', token);

        // Load company data
        const companyData = await loadCompanyData(tokenData.company_name);
        setData(companyData);
        setLoading(false);

      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred loading the dashboard');
        setLoading(false);
      }
    }

    validateTokenAndLoadData();
  }, [token]);

  async function loadCompanyData(company) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: incidents },
      { data: bbsObs },
      { data: sailItems },
      { data: hazardIds },
      { data: goodCatch },
      { data: thas },
      { data: safetyMeetings }
    ] = await Promise.all([
      supabase.from('incidents').select('*').eq('company_name', company),
      supabase.from('bbs_observations').select('*').or(`company.eq.${company},company_name.eq.${company},client_company.eq.${company}`),
      supabase.from('sail_log').select('*').or(`company.eq.${company},company_name.eq.${company}`),
      supabase.from('hazard_id_reports').select('*').or(`company.eq.${company},company_name.eq.${company},client_company.eq.${company}`),
      supabase.from('good_catch_near_miss').select('*').or(`company.eq.${company},company_name.eq.${company},client_company.eq.${company}`),
      supabase.from('tha_submissions').select('*').or(`company.eq.${company},company_name.eq.${company},client_company.eq.${company}`),
      supabase.from('safety_meetings').select('*').or(`company.eq.${company},company_name.eq.${company},client_company.eq.${company}`)
    ]);

    const safeObs = (bbsObs || []).filter(b => b.observation_type === 'Safe').length;
    const atRiskObs = (bbsObs || []).filter(b => b.observation_type === 'At-Risk').length;
    const jobStops = (bbsObs || []).filter(b => b.job_stop === true || b.job_stop === 'Yes').length;
    const openSail = (sailItems || []).filter(s => ['Open', 'In Progress', 'Pending'].includes(s.status)).length;
    const openIncidents = (incidents || []).filter(i => i.status !== 'Closed').length;

    // Last 7 days data
    const recentBBS = (bbsObs || []).filter(b => new Date(b.created_at) >= new Date(sevenDaysAgo)).length;
    const recentIncidents = (incidents || []).filter(i => new Date(i.incident_date) >= new Date(sevenDaysAgo)).length;

    return {
      incidents: incidents || [],
      bbsObs: bbsObs || [],
      sailItems: sailItems || [],
      hazardIds: hazardIds || [],
      goodCatch: goodCatch || [],
      thas: thas || [],
      safetyMeetings: safetyMeetings || [],
      metrics: {
        totalBBS: (bbsObs || []).length,
        safeObs,
        atRiskObs,
        jobStops,
        safeRatio: atRiskObs > 0 ? (safeObs / atRiskObs).toFixed(1) : safeObs,
        jobStopRate: (bbsObs || []).length > 0 ? Math.round((jobStops / (bbsObs || []).length) * 100) : 0,
        totalIncidents: (incidents || []).length,
        openIncidents,
        totalSail: (sailItems || []).length,
        openSail,
        totalHazardIds: (hazardIds || []).length,
        totalGoodCatch: (goodCatch || []).length,
        totalTHAs: (thas || []).length,
        totalMeetings: (safetyMeetings || []).length,
        recentBBS,
        recentIncidents
      }
    };
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#0f172a', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading Dashboard...</div>
          <div style={{ color: '#94a3b8' }}>Validating access...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#0f172a', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
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

  const m = data.metrics;

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
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Alert Box */}
        {m.openIncidents > 0 ? (
          <div style={{
            padding: '16px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
            border: '1px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>🚨</span>
            <span><strong style={{ color: 'white' }}>Action Required:</strong> You have {m.openIncidents} open incident(s) and {m.openSail} open SAIL item(s) requiring attention.</span>
          </div>
        ) : m.openSail > 0 ? (
          <div style={{
            padding: '16px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)',
            border: '1px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <span><strong style={{ color: 'white' }}>Attention:</strong> You have {m.openSail} open SAIL item(s) that need to be addressed.</span>
          </div>
        ) : (
          <div style={{
            padding: '16px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
            border: '1px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>✅</span>
            <span><strong style={{ color: 'white' }}>Great work!</strong> No open incidents or overdue items.</span>
          </div>
        )}

        {/* Score Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '12px',
          marginBottom: '20px'
        }}>
          <ScoreCard 
            label="Safe/At-Risk Ratio" 
            value={`${m.safeRatio}:1`} 
            detail="Target: 5:1"
            color={parseFloat(m.safeRatio) >= 5 ? '#22c55e' : parseFloat(m.safeRatio) >= 2 ? '#eab308' : '#ef4444'}
          />
          <ScoreCard 
            label="Job Stop Rate" 
            value={`${m.jobStopRate}%`} 
            detail={`${m.jobStops} stops`}
            color={m.jobStopRate >= 50 ? '#22c55e' : '#f97316'}
          />
          <ScoreCard 
            label="Near Misses" 
            value={m.totalGoodCatch} 
            detail="All time"
            color="#f97316"
          />
          <ScoreCard 
            label="Open Items" 
            value={m.openSail + m.openIncidents} 
            detail="Requiring action"
            color={m.openSail + m.openIncidents === 0 ? '#22c55e' : m.openSail + m.openIncidents > 3 ? '#ef4444' : '#eab308'}
          />
          <ScoreCard 
            label="Incidents" 
            value={m.totalIncidents} 
            detail="All time"
            color={m.totalIncidents === 0 ? '#22c55e' : '#ef4444'}
          />
        </div>

        {/* Panels Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Leading Indicators */}
          <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              fontWeight: 600,
              fontSize: '13px'
            }}>
              📈 Leading Indicators
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <MetricItem label="BBS Observations" value={m.totalBBS} color="#22c55e" />
                <MetricItem label="THA/JSAs" value={m.totalTHAs} color="#22c55e" />
                <MetricItem label="Hazard IDs" value={m.totalHazardIds} color="#22c55e" />
                <MetricItem label="Safety Meetings" value={m.totalMeetings} color="#22c55e" />
              </div>
            </div>
          </div>

          {/* Lagging Indicators */}
          <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)',
              fontWeight: 600,
              fontSize: '13px'
            }}>
              📉 Lagging Indicators
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <MetricItem label="Incidents" value={m.totalIncidents} color={m.totalIncidents > 0 ? '#ef4444' : '#22c55e'} />
                <MetricItem label="Open Incidents" value={m.openIncidents} color={m.openIncidents > 0 ? '#ef4444' : '#22c55e'} />
                <MetricItem label="Open SAIL" value={m.openSail} color={m.openSail > 0 ? '#ef4444' : '#22c55e'} />
                <MetricItem label="Total SAIL" value={m.totalSail} color="#f97316" />
              </div>
            </div>
          </div>
        </div>

        {/* BBS Breakdown */}
        <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ 
            padding: '12px 16px', 
            background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
            fontWeight: 600,
            fontSize: '13px'
          }}>
            👀 BBS Observations Breakdown
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <MetricItem label="Safe Observations" value={m.safeObs} color="#22c55e" />
              <MetricItem label="At-Risk Observations" value={m.atRiskObs} color="#ef4444" />
            </div>
          </div>
        </div>

        {/* Recent Incidents Table */}
        {data.incidents.filter(i => i.status !== 'Closed').length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '12px 16px', background: '#334155', fontWeight: 600, fontSize: '13px' }}>
              🚨 Open Incidents
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>DATE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>DESCRIPTION</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidents.filter(i => i.status !== 'Closed').slice(0, 10).map((incident, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px 12px' }}>{new Date(incident.incident_date).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 12px' }}>{incident.brief_description || incident.detailed_description?.substring(0, 60) || 'N/A'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          background: '#7f1d1d', 
                          color: '#fca5a5', 
                          padding: '3px 10px', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          {incident.status || 'Open'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Open SAIL Items Table */}
        {data.sailItems.filter(s => ['Open', 'In Progress', 'Pending'].includes(s.status)).length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '12px 16px', background: '#334155', fontWeight: 600, fontSize: '13px' }}>
              📋 Open SAIL Items
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>DATE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>DESCRIPTION</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sailItems.filter(s => ['Open', 'In Progress', 'Pending'].includes(s.status)).slice(0, 10).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px 12px' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 12px' }}>{item.action_description?.substring(0, 60) || item.description?.substring(0, 60) || 'N/A'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          background: '#7f1d1d', 
                          color: '#fca5a5', 
                          padding: '3px 10px', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          {item.status || 'Open'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12px', borderTop: '1px solid #334155', marginTop: '20px' }}>
          <p style={{ margin: 0 }}>Powered by Predictive Safety Analytics™ © 2026 SLP Alaska, LLC</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px' }}>For questions, contact brian@slpalaska.com</p>
        </div>
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
      <div style={{ fontSize: '32px', fontWeight: 700, color }}>
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
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>{label}</div>
    </div>
  );
}
