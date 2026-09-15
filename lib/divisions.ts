import { sql } from '@/lib/db'
import { normalizePhone } from '@/lib/staff'
import { findNomineeByPhone, getNominees } from '@/lib/nominees'
import { getSettings, type AppSettings } from '@/lib/admin-auth'

/**
 * Division votes let each division choose their own nominee: every staff
 * member can vote within their division, and the division's top vote-getter
 * is automatically nominated for the general ballot when division voting
 * closes (or live, if the admin keeps it open alongside the general vote).
 */

export interface DivisionVoteRow {
  id: number
  voter_phone: string
  candidate_sn: number
  candidate_name: string
  division: string
  remarks: string | null
  ip_address: string | null
  user_agent: string | null
  location: { cityName?: string; regionName?: string; countryName?: string } | null
  is_proxy: boolean | null
  created_at: string
}

let ready: Promise<void> | null = null

async function ensureDivisionVotesTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS division_votes (
          id SERIAL PRIMARY KEY,
          voter_phone TEXT NOT NULL,
          cycle_month TEXT NOT NULL DEFAULT 'September 2026',
          division TEXT NOT NULL,
          candidate_sn INT NOT NULL,
          candidate_name TEXT NOT NULL,
          remarks TEXT,
          ip_address TEXT,
          user_agent TEXT,
          location JSONB,
          is_proxy BOOLEAN,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS division_votes_cycle_div_idx ON division_votes (cycle_month, division)`
      // One division vote per phone per cycle
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS division_votes_phone_cycle_unique_idx ON division_votes (voter_phone, cycle_month)`
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export async function ensureDivisionSchema(): Promise<void> {
  return ensureDivisionVotesTable()
}

/** Has the given phone already cast a division vote in this cycle? */
export async function hasDivisionVoted(phone: string, cycleMonth: string): Promise<boolean> {
  await ensureDivisionSchema()
  const rows = (await sql`
    SELECT id FROM division_votes WHERE voter_phone = ${phone} AND cycle_month = ${cycleMonth} LIMIT 1
  `) as unknown as { id: number }[]
  return rows.length > 0
}

export type DivisionVoteResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 403 | 409 | 500 }

/**
 * Records a division vote. The voter's division (from the roll) must match
 * the candidate's division — divisions only vote for their own staff.
 */
export async function recordDivisionVote(payload: {
  phoneRaw: string
  candidateSn: number
  remarks: string
  cycleMonth: string
  ip: string | null
  userAgent: string | null
  location: unknown
  isProxy: boolean
}): Promise<DivisionVoteResult> {
  await ensureDivisionSchema()

  const voter = await findNomineeByPhone(payload.phoneRaw)
  if (!voter) {
    return { ok: false, error: 'Phone number not recognised. You must be on the approved IPPIS nominal roll to vote.', status: 403 }
  }
  if (!voter.division) {
    return { ok: false, error: 'Your division is not set on the nominal roll. Contact the admin.', status: 403 }
  }

  const nominees = await getNominees()
  const candidate = nominees.find((member) => member.sn === payload.candidateSn)
  if (!candidate) {
    return { ok: false, error: 'Please select a valid staff member.', status: 400 }
  }
  if (!candidate.division || candidate.division !== voter.division) {
    return { ok: false, error: `You can only vote for staff in your own division (${voter.division}).`, status: 403 }
  }

  try {
    await sql`
      INSERT INTO division_votes (voter_phone, cycle_month, division, candidate_sn, candidate_name, remarks, ip_address, user_agent, location, is_proxy)
      VALUES (${voter.phone}, ${payload.cycleMonth}, ${voter.division}, ${candidate.sn}, ${candidate.name}, ${payload.remarks || null}, ${payload.ip}, ${payload.userAgent}, ${payload.location ? JSON.stringify(payload.location) : null}::jsonb, ${payload.isProxy})
    `
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('duplicate key') || message.includes('unique')) {
      return { ok: false, error: `This phone number has already voted in the ${payload.cycleMonth} division vote. One staff, one division vote per cycle.`, status: 409 }
    }
    console.error('Division vote insert failed:', message)
    return { ok: false, error: 'Something went wrong while recording your division vote. Please try again.', status: 500 }
  }
}

export interface DivisionStanding {
  division: string
  totalVotes: number
  voters: number
  leader: { sn: number; name: string; voteCount: number } | null
  results: { sn: number; name: string; voteCount: number }[]
}

/** Tallies per division for a cycle (or all cycles when month is null). */
export async function getDivisionStandings(month: string | null): Promise<DivisionStanding[]> {
  await ensureDivisionSchema()
  const nominees = await getNominees()

  const tallyRows = month
    ? ((await sql`
        SELECT division, candidate_sn, candidate_name, COUNT(*)::int AS vote_count
        FROM division_votes WHERE cycle_month = ${month}
        GROUP BY division, candidate_sn, candidate_name
      `) as unknown as { division: string; candidate_sn: number; candidate_name: string; vote_count: number }[])
    : ((await sql`
        SELECT division, candidate_sn, candidate_name, COUNT(*)::int AS vote_count
        FROM division_votes
        GROUP BY division, candidate_sn, candidate_name
      `) as unknown as { division: string; candidate_sn: number; candidate_name: string; vote_count: number }[])

  const byDivision = new Map<string, DivisionStanding>()
  for (const row of tallyRows) {
    let entry = byDivision.get(row.division)
    if (!entry) {
      entry = { division: row.division, totalVotes: 0, voters: 0, leader: null, results: [] }
      byDivision.set(row.division, entry)
    }
    entry.totalVotes += row.vote_count
    entry.results.push({ sn: row.candidate_sn, name: row.candidate_name, voteCount: row.vote_count })
  }

  // Staff roster per division, so empty divisions still appear with 0 votes
  for (const member of nominees) {
    if (!member.division) continue
    if (!byDivision.has(member.division)) {
      byDivision.set(member.division, { division: member.division, totalVotes: 0, voters: 0, leader: null, results: [] })
    }
  }

  for (const entry of byDivision.values()) {
    entry.results.sort((a, b) => b.voteCount - a.voteCount || a.sn - b.sn)
    entry.voters = entry.results.reduce((sum, r) => sum + r.voteCount, 0)
    entry.leader = entry.results[0]?.voteCount ? entry.results[0] : null
  }

  return [...byDivision.values()].sort((a, b) => a.division.localeCompare(b.division))
}

/**
 * Nominates each division's top vote-getter for the general ballot.
 * Idempotent. Ties are broken by S/N (same rule as the standings UI).
 */
export async function nominateDivisionWinners(cycleMonth: string): Promise<{ nominated: { division: string; sn: number; name: string }[] }> {
  await ensureDivisionSchema()
  const standings = await getDivisionStandings(cycleMonth)
  const nominated: { division: string; sn: number; name: string }[] = []

  for (const entry of standings) {
    if (!entry.leader) continue
    await sql`UPDATE nominees SET nominated = true WHERE sn = ${entry.leader.sn}`
    nominated.push({ division: entry.division, sn: entry.leader.sn, name: entry.leader.name })
  }
  return { nominated }
}

/** Division votes audit rows for admin, scoped like getDivisionStandings. */
export async function getDivisionVotes(month: string | null, limit = 500): Promise<DivisionVoteRow[]> {
  await ensureDivisionSchema()
  return month
    ? ((await sql`
        SELECT id, voter_phone, candidate_sn, candidate_name, division, remarks, ip_address, user_agent, location, is_proxy, created_at
        FROM division_votes WHERE cycle_month = ${month}
        ORDER BY created_at DESC LIMIT ${limit}
      `) as unknown as DivisionVoteRow[])
    : ((await sql`
        SELECT id, voter_phone, candidate_sn, candidate_name, division, remarks, ip_address, user_agent, location, is_proxy, created_at
        FROM division_votes
        ORDER BY created_at DESC LIMIT ${limit}
      `) as unknown as DivisionVoteRow[])
}

export interface DivisionCycleInfo {
  month: string
  votes: number
  isCurrent: boolean
}

export async function getDivisionCycles(): Promise<DivisionCycleInfo[]> {
  await ensureDivisionSchema()
  const settings: AppSettings = await getSettings()
  const rows = (await sql`
    SELECT cycle_month AS month, COUNT(*)::int AS votes
    FROM division_votes
    GROUP BY cycle_month
    ORDER BY MIN(created_at) DESC
  `) as unknown as { month: string; votes: number }[]
  const cycles: DivisionCycleInfo[] = rows.map((r) => ({ month: r.month, votes: r.votes, isCurrent: r.month === settings.votingMonth }))
  if (!cycles.some((c) => c.isCurrent)) {
    cycles.unshift({ month: settings.votingMonth, votes: 0, isCurrent: true })
  }
  return cycles
}

/** Phone numbers that already division-voted in this cycle (for admin roll). */
export async function getDivisionVoterPhones(): Promise<Set<string>> {
  await ensureDivisionSchema()
  const rows = (await sql`SELECT voter_phone FROM division_votes`) as unknown as { voter_phone: string }[]
  return new Set(rows.map((r) => r.voter_phone))
}
