/**
 * Apply the cycle-month migration (one statement per query for Neon).
 * Run with: export $(grep -v ^# .env.local | xargs) && npx tsx scripts/migrate-cycle.ts
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
  const schema = readFileSync(join(process.cwd(), 'scripts/add-cycle-month.sql'), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)

  for (const statement of statements) {
    await sql.query(statement)
  }
  console.log(`✓ Cycle-month migration applied (${statements.length} statements)`)

  const count = (await sql`SELECT COUNT(*)::int AS n FROM votes`) as unknown as { n: number }[]
  const cycles = (await sql`SELECT DISTINCT cycle_month FROM votes`) as unknown as { cycle_month: string }[]
  console.log(`✓ Verified: ${count[0].n} vote(s) stamped with cycle: ${cycles.map((c) => c.cycle_month).join(', ') || '(none)'}`)
}

main().catch((error) => {
  console.error('✗ Migration failed:', error.message)
  process.exit(1)
})
