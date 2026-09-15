import { NextResponse, type NextRequest } from 'next/server'
import { recordDivisionVote } from '@/lib/divisions'
import { formatLocation, getAuditInfo, lookupIpLocation } from '@/lib/audit'
import { getSettings } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface DivisionVotePayload {
  phone?: unknown
  candidateSn?: unknown
  remarks?: unknown
}

export async function POST(request: NextRequest) {
  let body: DivisionVotePayload
  try {
    body = (await request.json()) as DivisionVotePayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // 0. Division voting must be open
  const settings = await getSettings()
  if (!settings.divisionOpen) {
    return NextResponse.json(
      { error: `Division voting is currently closed. Cycle: ${settings.votingMonth}.` },
      { status: 403 },
    )
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : ''
  const candidateSn = typeof body.candidateSn === 'number' ? body.candidateSn : NaN
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim().slice(0, 500) : ''

  if (!Number.isFinite(candidateSn)) {
    return NextResponse.json({ error: 'Please select a staff member from your division.' }, { status: 400 })
  }

  // Audit capture happens first but never blocks or fails a vote.
  const audit = getAuditInfo(request)
  const location = await lookupIpLocation(audit.ip)

  const result = await recordDivisionVote({
    phoneRaw,
    candidateSn,
    remarks,
    cycleMonth: settings.votingMonth,
    ip: audit.ip,
    userAgent: audit.userAgent,
    location,
    isProxy: location?.isProxy ?? false,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    message: 'Division vote submitted securely.',
    audit: {
      ip: audit.ip,
      location: formatLocation(location),
    },
  })
}
