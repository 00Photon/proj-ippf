/**
 * Apply the audit-columns migration (one statement per query for Neon).
 * Run with: export $(grep -v ^# .env.local | xargs) && npx tsx scripts/migrate-audit.ts
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(url)
  const schema = readFileSync(join(process.cwd(), 'scripts/add-audit-columns.sql'), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)

  for (const statement of statements) {
    await sql.query(statement)
  }
  console.log(`✓ Audit migration applied (${statements.length} statements)`)
}

main().catch((error) => {
  console.error('✗ Migration failed:', error.message)
  process.exit(1)
})
