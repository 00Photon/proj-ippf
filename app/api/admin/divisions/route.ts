import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import {
  getDivisionCycles,
  getDivisionStandings,
  getDivisionVotes,
  nominateDivisionWinners,
} from '@/lib/divisions'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Admin division-vote dashboard data.
 * Query params:
 *   month  cycle label (absent → all cycles)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const month = (request.nextUrl.searchParams.get('month') ?? '').trim().slice(0, 40) || null

    const [standings, votes, cycles] = await Promise.all([
      getDivisionStandings(month),
      getDivisionVotes(month),
      getDivisionCycles(),
    ])

    const rows = votes.map((row) => ({
      id: row.id,
      voterPhone: row.voter_phone,
      candidateSn: row.candidate_sn,
      candidateName: row.candidate_name,
      division: row.division,
      remarks: row.remarks,
      ip: row.ip_address,
      location: row.location
        ? [row.location.cityName, row.location.regionName, row.location.countryName].filter(Boolean).join(', ') || null
        : null,
      userAgent: row.user_agent,
      isProxy: row.is_proxy === true,
      votedAt: row.created_at,
    }))

    return NextResponse.json({ standings, votes: rows, cycles })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Admin divisions fetch failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to load division data.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/divisions — close division voting and nominate each
 * division's top vote-getter for the general ballot (idempotent).
 * Body: { cycleMonth: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    let body: { cycleMonth?: unknown }
    try {
      body = (await request.json()) as { cycleMonth?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }
    if (typeof body.cycleMonth !== 'string' || !body.cycleMonth.trim()) {
      return NextResponse.json({ error: 'cycleMonth is required.' }, { status: 400 })
    }
    const cycleMonth = body.cycleMonth.trim().slice(0, 40)

    const { nominated } = await nominateDivisionWinners(cycleMonth)

    // Closing division voting is part of the same action, per the phase flow
    await sql`INSERT INTO settings (key, value) VALUES ('division_open', 'false') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`

    return NextResponse.json({ ok: true, nominated })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Nominate division winners failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to nominate division winners.' }, { status: 500 })
  }
}
