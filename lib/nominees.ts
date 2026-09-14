import { sql } from '@/lib/db'
import { normalizePhone, staffList } from '@/lib/staff'

export interface Nominee {
  sn: number
  name: string
  phone: string
}

let ready: Promise<void> | null = null

/**
 * Ensures the nominees table exists and is seeded from the original static
 * roll in lib/staff.ts. Idempotent and memoised per server instance, so the
 * first DB-backed call performs the migration and every later call is free.
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
      const countRows = (await sql`SELECT COUNT(*)::int AS n FROM nominees`) as unknown as { n: number }[]
      if ((countRows[0]?.n ?? 0) === 0) {
        // Seed from the original static roll, preserving S/Ns
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
    return (await sql`SELECT sn, name, phone FROM nominees ORDER BY sn ASC`) as unknown as Nominee[]
  } catch (error) {
    console.error('Nominees load failed, using static roll:', error instanceof Error ? error.message : error)
    return staffList
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

export async function addNominee(nameRaw: string, phoneRaw: string): Promise<AddNomineeResult> {
  const name = nameRaw.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Name must be between 2 and 80 characters.', status: 400 }
  }
  const phone = normalizePhone(phoneRaw)
  if (!phone) {
    return { ok: false, error: 'Enter a valid 11-digit Nigerian phone number, e.g. 08031234567.', status: 400 }
  }

  try {
    await ensureNomineesTable()
    const rows = (await sql`
      INSERT INTO nominees (name, phone) VALUES (${name}, ${phone})
      RETURNING sn, name, phone
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
export async function updateNominee(sn: number, nameRaw: string, phoneRaw: string): Promise<UpdateNomineeResult> {
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

  try {
    await ensureNomineesTable()
    const rows = (await sql`
      UPDATE nominees SET name = ${name}, phone = ${phone}
      WHERE sn = ${sn}
      RETURNING sn, name, phone
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

export type RemoveNomineeResult = { ok: true } | { ok: false; error: string; status: 400 | 404 | 409 | 500 }

/**
 * Removes a nominee by S/N. Refuses while the nominee still has votes
 * recorded, so tallies and the audit trail stay consistent.
 */
export async function removeNominee(sn: number): Promise<RemoveNomineeResult> {
  if (!Number.isFinite(sn)) {
    return { ok: false, error: 'Invalid nominee S/N.', status: 400 }
  }
  try {
    await ensureNomineesTable()
    const voteRows = (await sql`SELECT COUNT(*)::int AS n FROM votes WHERE candidate_sn = ${sn}`) as unknown as { n: number }[]
    const votes = voteRows[0]?.n ?? 0
    if (votes > 0) {
      return { ok: false, error: `This nominee has ${votes} vote(s) recorded. Delete their votes first.`, status: 409 }
    }
    const deleted = (await sql`DELETE FROM nominees WHERE sn = ${sn} RETURNING sn`) as unknown as { sn: number }[]
    if (deleted.length === 0) {
      return { ok: false, error: 'Nominee not found.', status: 404 }
    }
    return { ok: true }
  } catch (error) {
    console.error('Remove nominee failed:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not remove the nominee. Please try again.', status: 500 }
  }
}
