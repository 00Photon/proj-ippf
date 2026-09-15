/**
 * Rebuild the nominal roll from the official division roster in lib/staff.ts.
 *
 * - Clears votes + division_votes (fresh cycle)
 * - Replaces all staff with the 88-member division roster (phones where known)
 * - Everyone starts not nominated; division winners are set later via
 *   "Close & nominate winners"
 *
 * Run with: export $(grep -v ^# .env.local | xargs) && npx tsx scripts/rebuild-roll.ts
 * Add --keep-votes to preserve existing votes.
 */
import { neon } from '@neondatabase/serverless'
import { staffList } from '../lib/staff'
import { canonicalDivision } from '../lib/division-list'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Run: export $(grep -v ^# .env.local | xargs)')
    process.exit(1)
  }
  const sql = neon(url)
  const keepVotes = process.argv.includes('--keep-votes')

  // Validate the roster before touching the DB.
  for (const m of staffList) {
    if (!canonicalDivision(m.division)) {
      throw new Error(`Roster has non-official division: ${m.name} -> ${m.division}`)
    }
  }

  if (!keepVotes) {
    const v = (await sql`DELETE FROM votes`) as unknown as number
    console.log(`✓ Cleared votes`)
    try {
      await sql`DELETE FROM division_votes`
      console.log(`✓ Cleared division votes`)
    } catch {
      console.log('· division_votes table not present yet — skipped')
    }
  }

  await sql`DELETE FROM nominees`
  // New admin-added staff continue after the seeded S/Ns (no collisions)
  await sql`SELECT setval(pg_get_serial_sequence('nominees', 'sn'), ${staffList.length}, true)`

  const values: unknown[] = []
  const tuples = staffList.map((m) => {
    values.push(m.sn, m.name, m.phone, m.division)
    const i = values.length - 3
    return `($${i}, $${i + 1}, $${i + 2}, $${i + 3})`
  })
  await sql.query(
    `INSERT INTO nominees (sn, name, phone, division) VALUES ${tuples.join(', ')}`,
    values,
  )
  console.log(`✓ Inserted ${staffList.length} staff from the official division roster`)

  // Report the resulting distribution.
  const dist = (await sql`
    SELECT division, COUNT(*)::int AS n FROM nominees GROUP BY division ORDER BY division ASC
  `) as unknown as { division: string; n: number }[]
  const withPhone = (await sql`SELECT COUNT(*)::int AS n FROM nominees WHERE phone IS NOT NULL`) as unknown as { n: number }[]
  const total = (await sql`SELECT COUNT(*)::int AS n FROM nominees`) as unknown as { n: number }[]

  console.log(`\nTotal staff: ${total[0].n} (with phone: ${withPhone[0].n})`)
  for (const d of dist) console.log(`   ${d.division}: ${d.n}`)
  console.log('\nNext: open division voting; winners are nominated via "Close & nominate winners".')
}

main().catch((error) => {
  console.error('✗ Roll rebuild failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
