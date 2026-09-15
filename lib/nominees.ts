import { sql } from '@/lib/db'
import { normalizePhone, staffList } from '@/lib/staff'

export interface Nominee {
  sn: number
  name: string
  phone: string
  division: string | null
  nominated: boolean
}

let ready: Promise<void> | null = null

/**
 * Ensures the nominees table exists, adds the `nominated` flag when missing,
 * and seeds from the original static roll in lib/staff.ts. Idempotent and
 * memoised per server instance, so the first DB-backed call performs the
 * migration and every later call is free.
 *
 * New staff default to nominated = false: every staff member can vote, but
 * only those an admin explicitly nominates appear on the public ballot.
 */
async function ensureNomineesTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS nominees (
          sn SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      // Migration for existing installs: add the nomination flag + division.
      await sql`ALTER TABLE nominees ADD COLUMN IF NOT EXISTS nominated BOOLEAN NOT NULL DEFAULT false`
      await sql`ALTER TABLE nominees ADD COLUMN IF NOT EXISTS division TEXT`

      const countRows = (await sql`SELECT COUNT(*)::int AS n FROM nominees`) as unknown as { n: number }[]
      if ((countRows[0]?.n ?? 0) === 0) {
        // Seed from the original static roll, preserving S/Ns (not nominated by default)
        const values: unknown[] = []
        const tuples = staffList.map((m) => {
          values.push(m.sn, m.name, m.phone)
          const i = values.length - 2
          return `($${i}, $${i + 1}, $${i + 2})`
        })
        await sql.query(
          `INSERT INTO nominees (sn, name, phone) VALUES ${tuples.join(', ')} ON CONFLICT (sn) DO NOTHING`,
          values,
        )
        // Keep the sequence ahead of the seeded S/Ns
        await sql`SELECT setval(pg_get_serial_sequence('nominees', 'sn'), (SELECT COALESCE(MAX(sn), 1) FROM nominees))`
      }
    })().catch((error) => {
      ready = null // allow a retry on the next call
      throw error
    })
  }
  return ready
}

/**
 * The full nominal roll from the database. Falls back to the original static
 * list if the database is unreachable, so voting keeps working.
 */
export async function getNominees(): Promise<Nominee[]> {
  try {
    await ensureNomineesTable()
    return (await sql`SELECT sn, name, phone, division, nominated FROM nominees ORDER BY sn ASC`) as unknown as Nominee[]
  } catch (error) {
    console.error('Nominees load failed, using static roll:', error instanceof Error ? error.message : error)
    return staffList.map((m) => ({ ...m, division: null, nominated: false }))
  }
}

/**
 * Only the nominated staff — the names shown on the public ballot and front
 * page. Admin-managed via the Staff tab.
 */
export async function getNominatedNominees(): Promise<Nominee[]> {
  const list = await getNominees()
  return list.filter((member) => member.nominated)
}

/** Distinct divisions currently assigned on the roll, alphabetical. */
export async function getDivisions(): Promise<string[]> {
  try {
    await ensureNomineesTable()
    const rows = (await sql`
      SELECT DISTINCT division AS name FROM nominees WHERE division IS NOT NULL AND division <> ''
      ORDER BY name ASC
    `) as unknown as { name: string }[]
    return rows.map((r) => r.name)
  } catch (error) {
    console.error('Divisions load failed:', error instanceof Error ? error.message : error)
    return []
  }
}

/** Look up a nominee by voter-supplied phone number (any common format). */
export async function findNomineeByPhone(raw: string): Promise<Nominee | undefined> {
  const normalized = normalizePhone(raw)
  if (!normalized) return undefined
  const list = await getNominees()
  return list.find((member) => member.phone === normalized)
}

export type AddNomineeResult =
  | { ok: true; nominee: Nominee }
  | { ok: false; error: string; status: 400 | 409 | 500 }

export async function addNominee(nameRaw: string, phoneRaw: string, divisionRaw?: string): Promise<AddNomineeResult> {
  const name = nameRaw.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Name must be between 2 and 80 characters.', status: 400 }
  }
  const phone = normalizePhone(phoneRaw)
  if (!phone) {
    return { ok: false, error: 'Enter a valid 11-digit Nigerian phone number, e.g. 08031234567.', status: 400 }
  }
  const division = (divisionRaw ?? '').trim().slice(0, 60) || null

  try {
    await ensureNomineesTable()
    const rows = (await sql`
      INSERT INTO nominees (name, phone, division) VALUES (${name}, ${phone}, ${division})
      RETURNING sn, name, phone, division, nominated
    `) as unknown as Nominee[]
    return { ok: true, nominee: rows[0] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('duplicate key') || message.includes('unique')) {
      return { ok: false, error: 'That phone number is already on the nominal roll.', status: 409 }
    }
    console.error('Add nominee failed:', message)
    return { ok: false, error: 'Could not add the nominee. Please try again.', status: 500 }
  }
}

export type UpdateNomineeResult =
  | { ok: true; nominee: Nominee }
  | { ok: false; error: string; status: 400 | 404 | 409 | 500 }

/**
 * Edits a nominee's name and/or phone. Votes already cast are tied to the
 * phone number used at vote time, so they are intentionally left untouched.
 */
export async function updateNominee(sn: number, nameRaw: string, phoneRaw: string, divisionRaw?: string): Promise<UpdateNomineeResult> {
  if (!Number.isFinite(sn)) {
    return { ok: false, error: 'Invalid nominee S/N.', status: 400 }
  }
  const name = nameRaw.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Name must be between 2 and 80 characters.', status: 400 }
  }
  const phone = normalizePhone(phoneRaw)
  if (!phone) {
    return { ok: false, error: 'Enter a valid 11-digit Nigerian phone number, e.g. 08031234567.', status: 400 }
  }
  const division = (divisionRaw ?? '').trim().slice(0, 60) || null

  try {
    await ensureNomineesTable()
    const rows = (await sql`
      UPDATE nominees SET name = ${name}, phone = ${phone}, division = ${division}
      WHERE sn = ${sn}
      RETURNING sn, name, phone, division, nominated
    `) as unknown as Nominee[]
    if (rows.length === 0) {
      return { ok: false, error: 'Nominee not found.', status: 404 }
    }
    return { ok: true, nominee: rows[0] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('duplicate key') || message.includes('unique')) {
      return { ok: false, error: 'That phone number is already on the nominal roll.', status: 409 }
    }
    console.error('Update nominee failed:', message)
    return { ok: false, error: 'Could not update the nominee. Please try again.', status: 500 }
  }
}

export type SetNominatedResult =
  | { ok: true; nominee: Nominee }
  | { ok: false; error: string; status: 400 | 404 | 500 }

/**
 * Assigns a staff member to a division (empty string clears it). The division
 * decides who they can vote for in the division vote and who can vote for them.
 */
export async function setNomineeDivision(sn: number, divisionRaw: string): Promise<SetNominatedResult> {
  if (!Number.isFinite(sn)) {
    return { ok: false, error: 'Invalid staff S/N.', status: 400 }
  }
  const division = (divisionRaw ?? '').trim().slice(0, 60) || null
  try {
    await ensureNomineesTable()
    const rows = (await sql`
      UPDATE nominees SET division = ${division}
      WHERE sn = ${sn}
      RETURNING sn, name, phone, division, nominated
    `) as unknown as Nominee[]
    if (rows.length === 0) {
      return { ok: false, error: 'Staff member not found.', status: 404 }
    }
    return { ok: true, nominee: rows[0] }
  } catch (error) {
    console.error('Set division failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not update the division. Please try again.', status: 500 }
  }
}

/**
 * Flags (or unflags) a staff member for the public ballot. Votes already
 * received are kept — withdrawing a nomination only hides the staff member
 * from the ballot; their past tallies stay on record.
 */
export async function setNominated(sn: number, nominated: boolean): Promise<SetNominatedResult> {
  if (!Number.isFinite(sn)) {
    return { ok: false, error: 'Invalid staff S/N.', status: 400 }
  }
  try {
    await ensureNomineesTable()
    const rows = (await sql`
      UPDATE nominees SET nominated = ${nominated}
      WHERE sn = ${sn}
      RETURNING sn, name, phone, division, nominated
    `) as unknown as Nominee[]
    if (rows.length === 0) {
      return { ok: false, error: 'Staff member not found.', status: 404 }
    }
    return { ok: true, nominee: rows[0] }
  } catch (error) {
    console.error('Set nominated failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not update the nomination. Please try again.', status: 500 }
  }
}

export type RemoveNomineeResult = { ok: true } | { ok: false; error: string; status: 400 | 404 | 409 | 500 }

/**
 * Removes a staff member by S/N. Refuses while they still have votes
 * recorded, so tallies and the audit trail stay consistent.
 */
export async function removeNominee(sn: number): Promise<RemoveNomineeResult> {
  if (!Number.isFinite(sn)) {
    return { ok: false, error: 'Invalid staff S/N.', status: 400 }
  }
  try {
    await ensureNomineesTable()
    const voteRows = (await sql`SELECT COUNT(*)::int AS n FROM votes WHERE candidate_sn = ${sn}`) as unknown as { n: number }[]
    const votes = voteRows[0]?.n ?? 0
    if (votes > 0) {
      return { ok: false, error: `This staff member has ${votes} vote(s) recorded. Delete their votes first.`, status: 409 }
    }
    const deleted = (await sql`DELETE FROM nominees WHERE sn = ${sn} RETURNING sn`) as unknown as { sn: number }[]
    if (deleted.length === 0) {
      return { ok: false, error: 'Staff member not found.', status: 404 }
    }
    return { ok: true }
  } catch (error) {
    console.error('Remove nominee failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not remove the staff member. Please try again.', status: 500 }
  }
}
