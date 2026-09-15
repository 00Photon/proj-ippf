import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { findNomineeByPhone } from '@/lib/nominees'
import { hasDivisionVoted } from '@/lib/divisions'
import { getSettings } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Verifies a phone number against the nominal roll and reports whether
 * that phone has already voted, so the UI can block duplicate attempts.
 * GET /api/verify?phone=0803...
 */
export async function GET(request: NextRequest) {
  const phoneRaw = request.nextUrl.searchParams.get('phone') ?? ''
  const voter = await findNomineeByPhone(phoneRaw)

  if (!voter) {
    return NextResponse.json(
      { valid: false, reason: 'not_on_roll' },
      { status: 404 },
    )
  }

  let hasVoted = false
  let hasVotedDivision = false
  try {
    const settings = await getSettings()
    // Only the active cycle locks a voter — a new cycle resets eligibility
    const rows = (await sql`
      SELECT id FROM votes WHERE voter_phone = ${voter.phone} AND cycle_month = ${settings.votingMonth} LIMIT 1
    `) as { id: number }[]
    hasVoted = rows.length > 0
    hasVotedDivision = await hasDivisionVoted(voter.phone, settings.votingMonth)
  } catch (error) {
    console.error('Verify lookup failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Verification temporarily unavailable.' }, { status: 500 })
  }

  return NextResponse.json({
    valid: true,
    hasVoted,
    hasVotedDivision,
    voter: { sn: voter.sn, name: voter.name, division: voter.division ?? null },
  })
}
