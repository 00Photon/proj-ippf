import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { getNominees } from '@/lib/nominees'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 200

interface VoteRow {
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

/**
 * GET /api/admin/votes — paginated, searchable audit trail.
 * Query params:
 *   page     1-based page number (default 1)
 *   pageSize rows per page, 1–200 (default 25)
 *   search   matches phone / candidate name / remarks / IP / location
 *   proxy    "1" → only flagged votes, "0" → only clean, absent → all
 *   all      "1" → no pagination, returns every match (for CSV export)
 *
 * Search runs in Postgres (ILIKE across voter_phone, candidate_name,
 * remarks, ip_address and the location JSONB) with bound parameters,
 * so it scales with cycle size and is injection-safe.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const params = request.nextUrl.searchParams
    const search = (params.get('search') ?? '').trim().slice(0, 100)
    const proxyParam = params.get('proxy')
    const proxyFilter: boolean | null = proxyParam === '1' ? true : proxyParam === '0' ? false : null
    const wantsAll = params.get('all') === '1'

    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(params.get('pageSize') ?? '25', 10) || 25))
    const requestedPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const offset = (requestedPage - 1) * pageSize

    // Build a WHERE fragment with positional placeholders ($1, $2, …)
    const fragments: string[] = []
    const bind: (string | boolean)[] = []
    if (search) {
      bind.push(`%${search}%`)
      const p = `$${bind.length}`
      fragments.push(
        `(voter_phone ILIKE ${p} OR candidate_name ILIKE ${p} OR remarks ILIKE ${p} OR ip_address ILIKE ${p} OR location::text ILIKE ${p})`,
      )
    }
    if (proxyFilter !== null) {
      bind.push(proxyFilter)
      fragments.push(`is_proxy = $${bind.length}`)
    }
    const whereClause = fragments.length ? `WHERE ${fragments.join(' AND ')}` : ''

    const countRows = (await sql.query(
      `SELECT COUNT(*)::int AS total FROM votes ${whereClause}`,
      bind,
    )) as unknown as { total: number }[]
    const total = countRows[0]?.total ?? 0

    const dataText = wantsAll
      ? `SELECT id, voter_phone, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy, created_at FROM votes ${whereClause} ORDER BY created_at DESC, id DESC`
      : `SELECT id, voter_phone, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy, created_at FROM votes ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}`

    const rows = (await sql.query(dataText, bind)) as unknown as VoteRow[]
    const nominees = await getNominees()

    const votes = rows.map((row) => ({
      id: row.id,
      voterPhone: row.voter_phone,
      voterSn: nominees.find((s) => s.phone === row.voter_phone)?.sn ?? null,
      candidateSn: row.candidate_sn,
      candidateName: row.candidate_name,
      remarks: row.remarks,
      ip: row.ip_address,
      userAgent: row.user_agent,
      location: row.location
        ? [row.location.cityName, row.location.regionName, row.location.countryName].filter(Boolean).join(', ') || null
        : null,
      isProxy: row.is_proxy === true,
      votedAt: row.created_at,
    }))

    if (wantsAll) {
      return NextResponse.json({ total, votes })
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return NextResponse.json({
      votes,
      total,
      page: Math.min(requestedPage, totalPages),
      pageSize,
      totalPages,
    })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Paginated votes fetch failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to load votes.' }, { status: 500 })
  }
}
