import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getNominees } from '@/lib/nominees'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Admin staff endpoint: the full nominal roll including phone numbers,
 * plus how many votes each staff member has received, whether they have
 * voted themselves, and whether they are on the public ballot (`nominated`).
 */
export async function GET() {
  try {
    await requireAdmin()

    const receivedRows = (await sql`
      SELECT candidate_sn, COUNT(*)::int AS count
      FROM votes
      GROUP BY candidate_sn
    `) as unknown as { candidate_sn: number; count: number }[]

    const votedRows = (await sql`
      SELECT voter_phone FROM votes
    `) as unknown as { voter_phone: string }[]
    const voters = new Set(votedRows.map((r) => r.voter_phone))

    const nominees = await getNominees()

    const staff = nominees.map(({ sn, name, phone, division, nominated }) => ({
      sn,
      name,
      phone,
      division,
      nominated,
      votesReceived: receivedRows.find((r) => r.candidate_sn === sn)?.count ?? 0,
      hasVoted: voters.has(phone),
    }))

    return NextResponse.json({
      total: staff.length,
      nominatedCount: staff.filter((s) => s.nominated).length,
      votedCount: staff.filter((s) => s.hasVoted).length,
      divisionCount: staff.filter((s) => s.division).length,
      staff,
    })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Admin staff fetch failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to load staff.' }, { status: 500 })
  }
}
