import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'

let _sql: ReturnType<typeof neon> | null = null
function db() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!)
  return _sql
}

export interface AdminRow {
  id: number
  username: string
  password_hash: string
  failed_attempts: number
  locked_until: string | null
}

export interface SessionRow {
  id: number
  token: string
  admin_id: number
  expires_at: string
}

const SESSION_COOKIE = 'ippis_admin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 8 // 8 hours

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: true; admin: { id: number; username: string } } | { ok: false; error: string }> {
  const cleanUser = username.trim().toLowerCase()
  const rows = (await db()`SELECT * FROM admins WHERE username = ${cleanUser} LIMIT 1`) as unknown as AdminRow[]
  const admin = rows[0] as AdminRow | undefined

  const now = new Date()
  if (admin?.locked_until && new Date(admin.locked_until) > now) {
    const mins = Math.ceil((new Date(admin.locked_until).getTime() - now.getTime()) / 60000)
    return { ok: false, error: `Account locked. Try again in ${mins} minute(s).` }
  }

  const valid = admin ? verifyPassword(password, admin.password_hash) : false
  if (!admin || !valid) {
    if (admin) {
      const attempts = admin.failed_attempts + 1
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      await db()`UPDATE admins SET failed_attempts = ${attempts}, locked_until = ${lockedUntil} WHERE id = ${admin.id}`
    }
    return { ok: false, error: 'Invalid username or password.' }
  }

  await db()`UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ${admin.id}`

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db()`INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (${tokenHash}, ${admin.id}, ${expiresAt})`

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return { ok: true, admin: { id: admin.id, username: admin.username } }
}

export async function logout(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db()`DELETE FROM admin_sessions WHERE token = ${hashToken(token)}`
  }
  store.delete(SESSION_COOKIE)
}

/** Returns the admin for the current session cookie, or null. */
export async function getAdminFromSession(): Promise<{ id: number; username: string } | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const rows = (await db()`SELECT a.id, a.username FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token = ${hashToken(token)} AND s.expires_at > NOW() LIMIT 1`) as unknown as { id: number; username: string }[]
  return rows[0] ?? null
}

/** Requires a valid admin session; throws a 401-shaped object otherwise. */
export async function requireAdmin(): Promise<{ id: number; username: string }> {
  const admin = await getAdminFromSession()
  if (!admin) {
    const err = new Error('Unauthorised') as Error & { status?: number }
    err.status = 401
    throw err
  }
  return admin
}

export async function changePassword(
  adminId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const rows = (await db()`SELECT * FROM admins WHERE id = ${adminId} LIMIT 1`) as unknown as AdminRow[]
  const admin = rows[0]
  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    return { ok: false, error: 'Current password is incorrect.' }
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return { ok: false, error: 'New password must be at least 10 characters.' }
  }
  const newHash = hashPassword(newPassword)
  await db()`UPDATE admins SET password_hash = ${newHash} WHERE id = ${adminId}`
  // Invalidate all other sessions after a password change
  await db()`DELETE FROM admin_sessions WHERE admin_id = ${adminId}`
  return { ok: true }
}

export interface AppSettings {
  votingOpen: boolean
  divisionOpen: boolean
  votingMonth: string
}

export async function getSettings(): Promise<AppSettings> {
  const rows = (await db()`SELECT key, value FROM settings`) as unknown as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    votingOpen: (map.voting_open ?? 'true') === 'true',
    divisionOpen: (map.division_open ?? 'false') === 'true',
    votingMonth: map.voting_month ?? 'September 2026',
  }
}

export interface CycleInfo {
  month: string
  votes: number
  firstVoteAt: string | null
  lastVoteAt: string | null
  isCurrent: boolean
}

/**
 * Every voting cycle that exists in the data (past + current), newest first.
 * Derived from the votes table, so a cycle only appears once it has votes —
 * the current cycle always appears because it is read from settings.
 */
export async function getCycles(): Promise<CycleInfo[]> {
  const settings = await getSettings()
  const rows = (await db()`
    SELECT cycle_month AS month, COUNT(*)::int AS votes,
           MIN(created_at) AS first_vote_at, MAX(created_at) AS last_vote_at
    FROM votes
    GROUP BY cycle_month
    ORDER BY MIN(created_at) DESC
  `) as unknown as { month: string; votes: number; first_vote_at: string | null; last_vote_at: string | null }[]

  const cycles: CycleInfo[] = rows.map((r) => ({
    month: r.month,
    votes: r.votes,
    firstVoteAt: r.first_vote_at,
    lastVoteAt: r.last_vote_at,
    isCurrent: r.month === settings.votingMonth,
  }))
  if (!cycles.some((c) => c.isCurrent)) {
    cycles.unshift({
      month: settings.votingMonth,
      votes: 0,
      firstVoteAt: null,
      lastVoteAt: null,
      isCurrent: true,
    })
  }
  return cycles
}

export async function updateSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  if (typeof next.votingOpen === 'boolean') {
    await db()`INSERT INTO settings (key, value) VALUES ('voting_open', ${String(next.votingOpen)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  }
  if (typeof next.divisionOpen === 'boolean') {
    await db()`INSERT INTO settings (key, value) VALUES ('division_open', ${String(next.divisionOpen)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  }
  if (typeof next.votingMonth === 'string' && next.votingMonth.trim()) {
    const month = next.votingMonth.trim().slice(0, 40)
    await db()`INSERT INTO settings (key, value) VALUES ('voting_month', ${month}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  }
  return getSettings()
}
