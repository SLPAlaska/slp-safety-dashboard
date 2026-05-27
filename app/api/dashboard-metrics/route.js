// ============================================================================
// app/api/dashboard-metrics/route.js
//
// PORTAL REPO ONLY (SLPAlaska/slp-safety-portal).
//
// Server-side endpoint that exposes getDashboardData() to authenticated
// internal callers — specifically the Supabase Edge Function that sends
// the Monday weekly emails.
//
// This is the bridge that lets the email use the SAME metrics logic as
// the portal Dashboard and the external view page. One source of truth.
//
// Auth: shared secret in `x-dashboard-secret` header. Set both:
//   - Vercel:   DASHBOARD_API_SECRET (Project Settings → Environment Variables)
//   - Supabase: DASHBOARD_API_SECRET (Edge Function secret, set via CLI)
// Use the SAME random value in both places.
//
// Usage:
//   GET /api/dashboard-metrics?company=MagTec%20Alaska&year=2026
//   Headers: x-dashboard-secret: <secret>
//
// Returns the full getDashboardData() response as JSON, or 401/500 on error.
// ============================================================================
import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/supabase';

// Force Node.js runtime (not Edge) so we can use the full supabase-js client
// the same way the in-browser Dashboard does.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // metrics queries can take a while; allow up to 60s

export async function GET(request) {
  // ---- Auth ----
  const provided = request.headers.get('x-dashboard-secret');
  const expected = process.env.DASHBOARD_API_SECRET;

  if (!expected) {
    console.error('[dashboard-metrics] DASHBOARD_API_SECRET env var not set on Vercel');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- Params ----
  const { searchParams } = new URL(request.url);
  const company = searchParams.get('company') || 'All';
  const location = searchParams.get('location') || 'All';
  const year = searchParams.get('year') || 'All';

  // ---- Compute ----
  try {
    const data = await getDashboardData(company, location, year);
    return NextResponse.json(data, {
      headers: {
        // Don't let Vercel/CDN cache — metrics should always be fresh.
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err) {
    console.error('[dashboard-metrics] error for', company, year, err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
