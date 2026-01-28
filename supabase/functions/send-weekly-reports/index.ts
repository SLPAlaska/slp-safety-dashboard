// Supabase Edge Function: send-weekly-reports
// Deploy to: supabase/functions/send-weekly-reports/index.ts
// 
// This function runs every Monday at 6:00 AM Alaska time
// and sends weekly safety reports to all active recipients

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

// Get date range for last 7 days
function getLastWeekRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startFormatted: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    endFormatted: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

// Fetch company data
async function getCompanyData(companyName: string, startDate: string, endDate: string) {
  // Dashboard metrics
  const [
    { data: incidents },
    { data: sailItems },
    { data: hazardIds },
    { data: bbsObs },
    { data: goodCatch },
    { data: thas },
    { data: safetyMeetings }
  ] = await Promise.all([
    supabase.from('incidents')
      .select('*')
      .eq('company_name', companyName)
      .gte('incident_date', startDate)
      .lte('incident_date', endDate),
    supabase.from('sail_log')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabase.from('hazard_id_reports')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName},client_company.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabase.from('bbs_observations')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName},client_company.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabase.from('good_catch_near_miss')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName},client_company.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabase.from('tha_submissions')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName},client_company.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabase.from('safety_meetings')
      .select('*')
      .or(`company.eq.${companyName},company_name.eq.${companyName},client_company.eq.${companyName}`)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
  ])

  // Get all-time open items for SAIL
  const { data: openSailItems } = await supabase
    .from('sail_log')
    .select('*')
    .or(`company.eq.${companyName},company_name.eq.${companyName}`)
    .in('status', ['Open', 'In Progress', 'Pending'])

  // Get all-time open incidents
  const { data: openIncidents } = await supabase
    .from('incidents')
    .select('*')
    .eq('company_name', companyName)
    .not('status', 'eq', 'Closed')

  // Calculate BBS metrics
  const safeObs = (bbsObs || []).filter(b => b.observation_type === 'Safe').length
  const atRiskObs = (bbsObs || []).filter(b => b.observation_type === 'At-Risk').length
  const jobStops = (bbsObs || []).filter(b => b.job_stop === true || b.job_stop === 'Yes').length

  return {
    incidents: incidents || [],
    sailItems: sailItems || [],
    openSailItems: openSailItems || [],
    hazardIds: hazardIds || [],
    bbsObs: bbsObs || [],
    goodCatch: goodCatch || [],
    thas: thas || [],
    safetyMeetings: safetyMeetings || [],
    openIncidents: openIncidents || [],
    metrics: {
      totalIncidents: (incidents || []).length,
      totalSail: (sailItems || []).length,
      openSail: (openSailItems || []).length,
      totalHazardIds: (hazardIds || []).length,
      totalBBS: (bbsObs || []).length,
      safeObs,
      atRiskObs,
      jobStops,
      safeRatio: atRiskObs > 0 ? (safeObs / atRiskObs).toFixed(1) : safeObs,
      totalGoodCatch: (goodCatch || []).length,
      totalTHAs: (thas || []).length,
      totalMeetings: (safetyMeetings || []).length,
      openIncidents: (openIncidents || []).length
    }
  }
}

// Generate HTML email - Dashboard Style
function generateEmailHTML(companyName: string, data: any, dateRange: any) {
  const m = data.metrics
  
  // Calculate additional metrics
  const safeRatioNum = parseFloat(m.safeRatio) || 0
  const jobStopRate = m.totalBBS > 0 ? Math.round((m.jobStops / m.totalBBS) * 100) : 0

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Safety Report - ${companyName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #e2e8f0; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%); padding: 24px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; color: white; }
    .header .company { font-size: 28px; font-weight: 700; color: #5eead4; margin: 8px 0; }
    .header .date-range { background: rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 20px; display: inline-block; font-size: 13px; color: white; }
    
    /* Score Cards Grid */
    .score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .score-card { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 10px; padding: 16px; text-align: center; border-top: 3px solid #3b82f6; }
    .score-card.green { border-top-color: #22c55e; }
    .score-card.red { border-top-color: #ef4444; }
    .score-card.yellow { border-top-color: #eab308; }
    .score-card.purple { border-top-color: #a855f7; }
    .score-card.cyan { border-top-color: #06b6d4; }
    .score-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .score-value { font-size: 32px; font-weight: 700; }
    .score-value.good { color: #22c55e; }
    .score-value.warning { color: #eab308; }
    .score-value.danger { color: #ef4444; }
    .score-value.neutral { color: #f97316; }
    .score-detail { font-size: 10px; color: #64748b; margin-top: 4px; }
    
    /* Alert Box */
    .alert-box { padding: 16px 20px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
    .alert-box.success { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border: 1px solid #10b981; }
    .alert-box.warning { background: linear-gradient(135deg, #713f12 0%, #854d0e 100%); border: 1px solid #f59e0b; }
    .alert-box.danger { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); border: 1px solid #ef4444; }
    .alert-icon { font-size: 24px; }
    .alert-text { font-size: 14px; }
    .alert-text strong { color: white; }
    
    /* Panels */
    .panel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
    .panel { background: #1e293b; border-radius: 10px; overflow: hidden; }
    .panel-header { padding: 12px 16px; font-size: 13px; font-weight: 600; color: white; }
    .panel-header.green { background: linear-gradient(135deg, #065f46 0%, #047857 100%); }
    .panel-header.red { background: linear-gradient(135deg, #991b1b 0%, #b91c1c 100%); }
    .panel-header.blue { background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%); }
    .panel-header.purple { background: linear-gradient(135deg, #6b21a8 0%, #7c3aed 100%); }
    .panel-header.cyan { background: linear-gradient(135deg, #155e75 0%, #0891b2 100%); }
    .panel-header.orange { background: linear-gradient(135deg, #c2410c 0%, #ea580c 100%); }
    .panel-content { padding: 16px; }
    
    /* Metrics inside panels */
    .metrics-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .metric-item { text-align: center; padding: 10px; background: #0f172a; border-radius: 8px; }
    .metric-value { font-size: 24px; font-weight: 700; color: #f97316; }
    .metric-value.green { color: #22c55e; }
    .metric-value.red { color: #ef4444; }
    .metric-label { font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    
    /* Tables */
    .table-container { background: #1e293b; border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
    .table-header { padding: 12px 16px; font-size: 13px; font-weight: 600; background: #334155; color: white; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0f172a; color: #94a3b8; padding: 10px 12px; text-align: left; font-weight: 500; text-transform: uppercase; font-size: 10px; }
    td { padding: 10px 12px; border-bottom: 1px solid #334155; color: #e2e8f0; }
    tr:hover { background: #334155; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .status.open { background: #7f1d1d; color: #fca5a5; }
    .status.closed { background: #064e3b; color: #6ee7b7; }
    .status.safe { background: #064e3b; color: #6ee7b7; }
    .status.at-risk { background: #7f1d1d; color: #fca5a5; }
    .empty-state { text-align: center; padding: 24px; color: #64748b; font-style: italic; }
    
    /* Footer */
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; margin-top: 20px; }
    .footer a { color: #5eead4; text-decoration: none; }
    .footer .brand { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 8px; }
    
    /* Responsive */
    @media (max-width: 600px) {
      .score-grid { grid-template-columns: repeat(2, 1fr); }
      .panel-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Weekly Safety Report</h1>
      <div class="company">${companyName}</div>
      <div class="date-range">📅 ${dateRange.startFormatted} - ${dateRange.endFormatted}</div>
    </div>
    
    <!-- Alert Box -->
    ${m.openIncidents > 0 ? `
    <div class="alert-box danger">
      <span class="alert-icon">🚨</span>
      <span class="alert-text"><strong>Action Required:</strong> You have ${m.openIncidents} open incident(s) and ${m.openSail} open SAIL item(s) requiring attention.</span>
    </div>
    ` : m.openSail > 0 ? `
    <div class="alert-box warning">
      <span class="alert-icon">⚠️</span>
      <span class="alert-text"><strong>Attention:</strong> You have ${m.openSail} open SAIL item(s) that need to be addressed.</span>
    </div>
    ` : `
    <div class="alert-box success">
      <span class="alert-icon">✅</span>
      <span class="alert-text"><strong>Great work!</strong> No open incidents or overdue items. Keep up the excellent safety culture!</span>
    </div>
    `}
    
    <!-- Score Cards -->
    <div class="score-grid">
      <div class="score-card ${safeRatioNum >= 5 ? 'green' : safeRatioNum >= 2 ? 'yellow' : 'red'}">
        <div class="score-label">Safe/At-Risk Ratio</div>
        <div class="score-value ${safeRatioNum >= 5 ? 'good' : safeRatioNum >= 2 ? 'warning' : 'danger'}">${m.safeRatio}:1</div>
        <div class="score-detail">Target: 5:1</div>
      </div>
      <div class="score-card ${jobStopRate >= 50 ? 'green' : jobStopRate >= 25 ? 'yellow' : 'purple'}">
        <div class="score-label">Job Stop Rate</div>
        <div class="score-value ${jobStopRate >= 50 ? 'good' : 'neutral'}">${jobStopRate}%</div>
        <div class="score-detail">${m.jobStops} stops</div>
      </div>
      <div class="score-card cyan">
        <div class="score-label">Near Misses</div>
        <div class="score-value neutral">${m.totalGoodCatch}</div>
        <div class="score-detail">This week</div>
      </div>
      <div class="score-card ${m.openSail > 3 ? 'red' : m.openSail > 0 ? 'yellow' : 'green'}">
        <div class="score-label">Open Items</div>
        <div class="score-value ${m.openSail === 0 ? 'good' : m.openSail > 3 ? 'danger' : 'warning'}">${m.openSail + m.openIncidents}</div>
        <div class="score-detail">Requiring action</div>
      </div>
      <div class="score-card ${m.totalIncidents > 0 ? 'red' : 'green'}">
        <div class="score-label">Incidents</div>
        <div class="score-value ${m.totalIncidents === 0 ? 'good' : 'danger'}">${m.totalIncidents}</div>
        <div class="score-detail">This week</div>
      </div>
    </div>

    <!-- Leading & Lagging Panels -->
    <div class="panel-grid">
      <div class="panel">
        <div class="panel-header green">📈 Leading Indicators</div>
        <div class="panel-content">
          <div class="metrics-row">
            <div class="metric-item">
              <div class="metric-value green">${m.totalBBS}</div>
              <div class="metric-label">BBS Observations</div>
            </div>
            <div class="metric-item">
              <div class="metric-value green">${m.totalTHAs}</div>
              <div class="metric-label">THA/JSAs</div>
            </div>
            <div class="metric-item">
              <div class="metric-value green">${m.totalHazardIds}</div>
              <div class="metric-label">Hazard IDs</div>
            </div>
            <div class="metric-item">
              <div class="metric-value green">${m.totalMeetings}</div>
              <div class="metric-label">Safety Meetings</div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header red">📉 Lagging Indicators</div>
        <div class="panel-content">
          <div class="metrics-row">
            <div class="metric-item">
              <div class="metric-value ${m.totalIncidents > 0 ? 'red' : 'green'}">${m.totalIncidents}</div>
              <div class="metric-label">Incidents</div>
            </div>
            <div class="metric-item">
              <div class="metric-value ${m.openIncidents > 0 ? 'red' : 'green'}">${m.openIncidents}</div>
              <div class="metric-label">Open Incidents</div>
            </div>
            <div class="metric-item">
              <div class="metric-value ${m.openSail > 0 ? 'red' : 'green'}">${m.openSail}</div>
              <div class="metric-label">Open SAIL</div>
            </div>
            <div class="metric-item">
              <div class="metric-value">${m.totalSail}</div>
              <div class="metric-label">SAIL This Week</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BBS Breakdown -->
    <div class="panel" style="margin-bottom: 16px;">
      <div class="panel-header blue">👀 BBS Observations Breakdown</div>
      <div class="panel-content">
        <div class="metrics-row">
          <div class="metric-item">
            <div class="metric-value green">${m.safeObs}</div>
            <div class="metric-label">Safe Observations</div>
          </div>
          <div class="metric-item">
            <div class="metric-value red">${m.atRiskObs}</div>
            <div class="metric-label">At-Risk Observations</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Incidents Table -->
    ${data.incidents.length > 0 ? `
    <div class="table-container">
      <div class="table-header">🚨 Incidents This Week</div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          ${data.incidents.map((i: any) => `
          <tr>
            <td>${new Date(i.incident_date).toLocaleDateString()}</td>
            <td>${i.brief_description || i.detailed_description?.substring(0, 80) || 'N/A'}</td>
            <td><span class="status ${i.status?.toLowerCase() === 'closed' ? 'closed' : 'open'}">${i.status || 'Open'}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Open SAIL Items -->
    ${data.openSailItems.length > 0 ? `
    <div class="table-container">
      <div class="table-header">📋 Open SAIL Items (Requires Action)</div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>
          ${data.openSailItems.slice(0, 10).map((s: any) => `
          <tr>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td>${s.action_description?.substring(0, 50) || s.description?.substring(0, 50) || 'N/A'}...</td>
            <td>${s.priority || 'Normal'}</td>
            <td><span class="status open">${s.status || 'Open'}</span></td>
          </tr>
          `).join('')}
          ${data.openSailItems.length > 10 ? `<tr><td colspan="4" style="text-align:center; color:#64748b;">...and ${data.openSailItems.length - 10} more items</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Hazard IDs -->
    ${data.hazardIds.length > 0 ? `
    <div class="table-container">
      <div class="table-header">⚠️ Hazard Identifications This Week</div>
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Hazard</th></tr></thead>
        <tbody>
          ${data.hazardIds.slice(0, 5).map((h: any) => `
          <tr>
            <td>${new Date(h.created_at).toLocaleDateString()}</td>
            <td>${h.location || h.location_name || 'N/A'}</td>
            <td>${h.hazard_description?.substring(0, 60) || h.description?.substring(0, 60) || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- BBS Observations Table -->
    ${data.bbsObs.length > 0 ? `
    <div class="table-container">
      <div class="table-header">👀 BBS Observations This Week</div>
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Type</th><th>Category</th></tr></thead>
        <tbody>
          ${data.bbsObs.slice(0, 8).map((b: any) => `
          <tr>
            <td>${new Date(b.observation_date || b.created_at).toLocaleDateString()}</td>
            <td>${b.location || b.location_name || 'N/A'}</td>
            <td><span class="status ${b.observation_type === 'Safe' ? 'safe' : 'at-risk'}">${b.observation_type || 'N/A'}</span></td>
            <td>${b.behavior_category || b.category || 'N/A'}</td>
          </tr>
          `).join('')}
          ${data.bbsObs.length > 8 ? `<tr><td colspan="4" style="text-align:center; color:#64748b;">...and ${data.bbsObs.length - 8} more</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Good Catch -->
    ${data.goodCatch.length > 0 ? `
    <div class="table-container">
      <div class="table-header">🎯 Good Catch / Near Miss Reports</div>
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Description</th></tr></thead>
        <tbody>
          ${data.goodCatch.map((g: any) => `
          <tr>
            <td>${new Date(g.created_at).toLocaleDateString()}</td>
            <td>${g.location || g.location_name || 'N/A'}</td>
            <td>${g.description?.substring(0, 70) || g.event_description?.substring(0, 70) || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="brand">SLP Alaska Safety Management</div>
      <p>View your full interactive dashboard at <a href="https://slp-safety.vercel.app">slp-safety.vercel.app</a></p>
      <p style="margin-top: 12px; font-size: 11px;">
        Please do not reply to this email. For questions, contact brian@slpalaska.com
      </p>
    </div>
  </div>
</body>
</html>
`
}

// Send email via Resend
async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'SLP Safety Reports <onboarding@resend.dev>',
      to,
      subject,
      html
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  return await response.json()
}

serve(async (req) => {
  try {
    // Allow manual trigger via POST or scheduled via GET
    const dateRange = getLastWeekRange()

    // Get all active recipients grouped by company
    const { data: recipients, error } = await supabase
      .from('email_recipients')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    // Group recipients by company
    const companiesMap = new Map<string, string[]>()
    for (const r of recipients || []) {
      const emails = companiesMap.get(r.company_name) || []
      emails.push(r.email)
      companiesMap.set(r.company_name, emails)
    }

    const results = []

    // =========================================================
    // TEST MODE: Only send to Brian for review
    // Set to false to send to actual recipients
    // =========================================================
    const TEST_MODE = true
    const TEST_EMAIL = 'brian@slpalaska.com'

    // Helper function to add delay between API calls
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Process each company
    let companyIndex = 0
    for (const [companyName, emails] of companiesMap) {
      try {
        // Add delay between emails to avoid rate limiting (except for first one)
        if (companyIndex > 0) {
          await delay(1500) // 1.5 second delay between emails
        }
        companyIndex++

        // TEST MODE: Only send to Brian | LIVE MODE: Send to all + Brian
        const allRecipients = TEST_MODE 
          ? [TEST_EMAIL] 
          : [...emails, 'brian@slpalaska.com']

        // Get company data
        const data = await getCompanyData(companyName, dateRange.start, dateRange.end)

        // Generate email
        const html = generateEmailHTML(companyName, data, dateRange)
        const subject = `Weekly Safety Report - ${companyName} (${dateRange.startFormatted} - ${dateRange.endFormatted})`

        // Send email
        const result = await sendEmail(allRecipients, subject, html)

        results.push({
          company: companyName,
          recipients: allRecipients.length,
          status: 'sent',
          id: result.id
        })

        console.log(`✓ Sent report to ${companyName} (${allRecipients.length} recipients)`)

      } catch (err: any) {
        results.push({
          company: companyName,
          status: 'error',
          error: err.message
        })
        console.error(`✗ Error sending to ${companyName}:`, err.message)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dateRange,
        companiesProcessed: results.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
