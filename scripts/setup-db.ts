/**
 * One-time DB setup: creates the votes table + vote_results view and verifies
 * the connection. Run with: npx tsx scripts/setup-db.ts
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Run: export $(grep -v ^# .env.local | xargs)')
    process.exit(1)
  }

  const sql = neon(url)

  // Neon's driver runs one statement per query — split the schema on semicolons.
  const schema = readFileSync(join(process.cwd(), 'scripts/schema.sql'), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.replace(/^--.*$/gm, '').trim())
    .filter(Boolean)

  for (const statement of statements) {
    await sql.query(statement)
  }
  console.log(`✓ Schema applied (${statements.length} statements: votes table + vote_results view)`)

  const check = await sql`SELECT COUNT(*)::int AS count FROM votes`
  console.log(`✓ Connection verified. Current vote count: ${check[0].count}`)
}

main().catch((error) => {
  console.error('✗ DB setup failed:', error.message)
  process.exit(1)
})
