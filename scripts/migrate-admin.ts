/**
 * Apply the admin schema (one statement per query for Neon).
 * Run with: export $(grep -v ^# .env.local | xargs) && npx tsx scripts/migrate-admin.ts
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  const url = process.env.DATEGORIES_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(url)
  const schema = readFileSync(join(process.cwd(), 'scripts/admin-schema.sql'), 'utf8')
  const statementLines = schema
    .split(';')
    .map((statement) => statement.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)

  for (const statement of statementLines) {
    await sql.query(statement)
  }
  console.log(`✓ Admin schema applied (${statementLines.length} statements)`)

  // Seed the default admin (username: admin, password: IPPIS-admin-2026!)
  const { scryptSync, randomBytes } = await import('node:crypto')
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync('IPPIS-admin-2026!', salt, 64).toString('hex')
  await sql.query(
    `INSERT INTO admins (username, password_hash) VALUES ('admin', '${salt}:${hash}')
     ON CONFLICT (username) DO NOTHING`,
  )
  console.log("✓ Default admin ready (username: admin, password: IPPIS-admin-2026! — change it after first login)")
}

main().catch((error) => {
  console.error('✗ Migration failed:', error.message)
  process.exit(1)
})
