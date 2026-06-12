// ============================================================================
// app/api/dashboard-metrics/route.js  (DASHBOARD repo)
//
// THE single server-side data source for all dashboard metrics.
// Runs with the service role, so the browser no longer needs (or gets)
// direct database read access.
//
// Three ways in, checked in order:
//   1. x-dashboard-secret header  — internal callers (weekly email function)
//   2. Authorization: Bearer <supabase access token> — logged-in dashboard
//      users. Company access is derived SERVER-SIDE from their email via
//      lib/auth rules; non-admins are forced to their own company regardless
//      of what the query string asks for.
//   3. ?token=<view token>       — client share links. Validated against
//      company_view_tokens; company forced to the token's company.
//
// Modes:
//   default            → { company, data: getDashboardData(...) }
//   ?section=truecost  → { company, rows: incident_costs join incidents }
// ============================================================================
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDashboardData } from '@/lib/supabase';
import { getCompanyAccess } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iypezirwdlqpptjpeeyf.supabase.co';

function adminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let company = searchParams.get('company') || 'All';
  const location = searchParams.get('location') || 'All';
  const year = searchParams.get('year') || 'All';
  const section = searchParams.get('section') || null;
  const viewToken = searchParams.get('token') || null;

  // ---------------- AUTH (one of three) ----------------
  const secret = request.headers.get('x-dashboard-secret');
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  let authorized = false;

  if (secret && process.env.DASHBOARD_API_SECRET && secret === process.env.DASHBOARD_API_SECRET) {
    // Mode 1: internal caller — full access, company as requested
    authorized = true;

  } else if (bearer) {
    // Mode 2: logged-in dashboard user
    try {
      const admin = adminClient();
      const { data: { user }, error } = await admin.auth.getUser(bearer);
      if (error || !user?.email) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const access = getCompanyAccess(user.email);
      if (!access) {
        return NextResponse.json({ error: 'No dashboard access for this account' }, { status: 403 });
      }
      if (!access.isAdmin) {
        company = access.company; // server-side tenant enforcement
      }
      authorized = true;
    } catch (e) {
      return NextResponse.json({ error: 'Session check failed' }, { status: 401 });
    }

  } else if (viewToken) {
    // Mode 3: client share link
    try {
      const admin = adminClient();
      const { data: tokenData, error } = await admin
        .from('company_view_tokens')
        .select('company_name, is_active')
        .eq('token', viewToken)
        .maybeSingle();
      if (error || !tokenData) {
        return NextResponse.json({ error: 'Invalid or expired access link' }, { status: 403 });
      }
      if (!tokenData.is_active) {
        return NextResponse.json({ error: 'This access link has been deactivated' }, { status: 403 });
      }
      company = tokenData.company_name; // token's company, always
      authorized = true;
      // Non-blocking last-access stamp
      admin.from('company_view_tokens')
        .update({ last_accessed: new Date().toISOString() })
        .eq('token', viewToken)
        .then(() => {});
    } catch (e) {
      return NextResponse.json({ error: 'Token check failed' }, { status: 403 });
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---------------- DATA ----------------
  try {
    if (section === 'truecost') {
      const admin = adminClient();
      let query = admin
        .from('incident_costs')
        .select(`
          total_all_costs,
          total_direct_costs,
          total_indirect_costs,
          entry_date,
          incident_id,
          incidents!inner(company_name, location_name, incident_date)
        `);
      if (company !== 'All') query = query.eq('incidents.company_name', company);
      if (location !== 'All') query = query.eq('incidents.location_name', location);
      if (year !== 'All') {
        query = query.gte('incidents.incident_date', `${year}-01-01`)
                     .lte('incidents.incident_date', `${year}-12-31`);
      }
      const { data: rows, error } = await query;
      if (error) throw error;
      return NextResponse.json({ company, rows: rows || [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    const data = await getDashboardData(company, location, year);
    return NextResponse.json({ company, data }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (err) {
    console.error('[dashboard-metrics] error for', company, year, err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
