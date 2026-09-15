import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { getNominees, getNominatedNominees } from '@/lib/nominees'
import { getSettings, requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface ResultRow {
  candidate_sn: number
  candidate_name: string
  vote_count: number
}

interface VoteDetailRow {
  id: number
  voter_phone: string
  candidate_sn: number
  candidate_name: string
  remarks: string | null
  ip_address: string | null
  user_agent: string | null
  location: { cityName?: string; regionName?: string; countryName?: string } | null
  is_proxy: boolean | null
  created_at: string
}

interface HourRow {
  hour: string
  count: number
}

/**
 * Admin results: aggregate tallies + full per-vote audit trail.
 * Query params:
 *   month  cycle label, e.g. "September 2026" (default: current voting month)
 *   all    "1" → aggregate across every cycle
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const settings = await getSettings()
    const monthParam = request.nextUrl.searchParams.get('month')
    const allTime = request.nextUrl.searchParams.get('all') === '1'
    const month = allTime ? null : (monthParam?.trim() || settings.votingMonth).slice(0, 40)

    // Scope everything to the selected cycle
    const tallyRows = month
      ? ((await sql`
          SELECT candidate_sn, candidate_name, COUNT(*)::int AS vote_count
          FROM votes WHERE cycle_month = ${month}
          GROUP BY candidate_sn, candidate_name
        `) as unknown as ResultRow[])
      : ((await sql`
          SELECT candidate_sn, candidate_name, COUNT(*)::int AS vote_count
          FROM votes
          GROUP BY candidate_sn, candidate_name
        `) as unknown as ResultRow[])

    // Standings list only staff currently on the ballot; turnout stays
    // relative to the full roll since every staff member can vote.
    const ballot = await getNominatedNominees()
    const nominees = await getNominees()

    const results = ballot
      .map(({ sn, name }) => {
        const row = tallyRows.find((r) => r.candidate_sn === sn)
        return { sn, name, voteCount: row?.vote_count ?? 0 }
      })
      .sort((a, b) => b.voteCount - a.voteCount || a.sn - b.sn)

    const totalVotes = results.reduce((sum, r) => sum + r.voteCount, 0)
    const leader = results[0]?.voteCount ? results[0] : null

    // Votes per day (for trend chart)
    const dayRows = month
      ? ((await sql`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM votes WHERE cycle_month = ${month}
          GROUP BY 1
          ORDER BY 1 ASC
        `) as unknown as { day: string; count: number }[])
      : ((await sql`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM votes
          GROUP BY 1
          ORDER BY 1 ASC
        `) as unknown as { day: string; count: number }[])

    // Votes per hour of day (for activity chart)
    const hourRows = month
      ? ((await sql`
          SELECT to_char(date_trunc('hour', created_at), 'HH24:00') AS hour, COUNT(*)::int AS count
          FROM votes WHERE cycle_month = ${month}
          GROUP BY date_trunc('hour', created_at)
          ORDER BY date_trunc('hour', created_at) ASC
        `) as unknown as HourRow[])
      : ((await sql`
          SELECT to_char(date_trunc('hour', created_at), 'HH24:00') AS hour, COUNT(*)::int AS count
          FROM votes
          GROUP BY date_trunc('hour', created_at)
          ORDER BY date_trunc('hour', created_at) ASC
        `) as unknown as HourRow[])

    // Full audit trail
    const detailRows = month
      ? ((await sql`
          SELECT id, voter_phone, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy, created_at
          FROM votes WHERE cycle_month = ${month}
          ORDER BY created_at DESC
          LIMIT 500
        `) as unknown as VoteDetailRow[])
      : ((await sql`
          SELECT id, voter_phone, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy, created_at
          FROM votes
          ORDER BY created_at DESC
          LIMIT 500
        `) as unknown as VoteDetailRow[])

    // Turnout + integrity signals
    const proxyCount = detailRows.filter((r) => r.is_proxy === true).length
    const uniqueIps = new Set(detailRows.map((r) => r.ip_address).filter(Boolean)).size
    const turnoutPct = Math.round((totalVotes / Math.max(1, nominees.length)) * 1000) / 10

    return NextResponse.json({
      cycleMonth: allTime ? 'All time' : month,
      totalVotes,
      totalStaff: nominees.length,
      turnoutPct,
      remainingVotes: nominees.length - totalVotes,
      leader,
      proxyCount,
      uniqueIps,
      results,
      perDay: dayRows,
      perHour: hourRows,
      votes: detailRows.map((row) => ({
        id: row.id,
        voterPhone: row.voter_phone,
        voterSn: nominees.find((s) => s.phone === row.voter_phone)?.sn ?? null,
        candidateSn: row.candidate_sn,
        candidateName: row.candidate_name,
        remarks: row.remarks,
        ip: row.ip_address,
        userAgent: row.user_agent,
        location: row.location
          ? [row.location.cityName, row.location.regionName, row.location.countryName]
              .filter(Boolean)
              .join(', ') || null
          : null,
        isProxy: row.is_proxy,
        votedAt: row.created_at,
      })),
    })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Admin results failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to load results.' }, { status: 500 })
  }
}
