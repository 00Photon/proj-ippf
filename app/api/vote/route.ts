import { NextResponse, type NextRequest } from 'next/server'
import { sql, type VoteRow } from '@/lib/db'
import { normalizePhone } from '@/lib/staff'
import { findNomineeByPhone, getNominees } from '@/lib/nominees'
import { formatLocation, getAuditInfo, lookupIpLocation } from '@/lib/audit'
import { getSettings } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface VotePayload {
  phone?: unknown
  candidateSn?: unknown
  remarks?: unknown
}

export async function POST(request: NextRequest) {
  let body: VotePayload
  try {
    body = (await request.json()) as VotePayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // 0. Voting must be open
  const settings = await getSettings()
  if (!settings.votingOpen) {
    return NextResponse.json(
      { error: `Voting is currently closed. Ballot: ${settings.votingMonth}.` },
      { status: 403 },
    )
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : ''
  const candidateSn = typeof body.candidateSn === 'number' ? body.candidateSn : NaN
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim().slice(0, 500) : ''

  // 1. Verify the voter is on the nominal roll
  const voter = await findNomineeByPhone(phoneRaw)
  if (!voter) {
    return NextResponse.json(
      { error: 'Phone number not recognised. You must be on the approved IPPIS nominal roll to vote.' },
      { status: 403 },
    )
  }

  // 2. Validate the candidate
  const nominees = await getNominees()
  const candidate = nominees.find((member) => member.sn === candidateSn)
  if (!candidate) {
    return NextResponse.json({ error: 'Please select a valid nominee.' }, { status: 400 })
  }

  // 3. Record the vote — voter_phone is UNIQUE, so a second vote fails at DB level.
  //    Audit capture (IP, user agent, rough location) happens first but never
  //    blocks or fails a vote.
  try {
    const audit = getAuditInfo(request)
    const location = await lookupIpLocation(audit.ip)
    const locationJson = location ? JSON.stringify(location) : null

    const inserted = (await sql`
      INSERT INTO votes (voter_phone, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy, cycle_month)
      VALUES (${voter.phone}, ${candidate.sn}, ${candidate.name}, ${remarks || null}, ${audit.ip}, ${audit.userAgent}, ${locationJson}::jsonb, ${location?.isProxy ?? false}, ${settings.votingMonth})
      RETURNING id, created_at
    `) as VoteRow[]
    return NextResponse.json({
      ok: true,
      message: 'Vote submitted securely.',
      vote: inserted[0],
      voter: { name: voter.name, phone: normalizePhone(voter.phone) },
      candidate: { sn: candidate.sn, name: candidate.name },
      audit: {
        ip: audit.ip,
        location: formatLocation(location),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json(
        { error: `This phone number has already voted in the ${settings.votingMonth} cycle. One staff, one vote per cycle.` },
        { status: 409 },
      )
    }
    console.error('Vote submission failed:', message)
    return NextResponse.json(
      { error: 'Something went wrong while recording your vote. Please try again.' },
      { status: 500 },
    )
  }
}
