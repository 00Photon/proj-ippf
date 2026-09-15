/**
 * Print the current nominees roll (sn, name, phone, division, nominated).
 * Run with: export $(grep -v ^# .env.local | xargs) && npx tsx scripts/dump-roll.ts
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Run: export $(grep -v ^# .env.local | xargs)')
    process.exit(1)
  }
  const sql = neon(url)
  const rows = (await sql`SELECT sn, name, phone, division, nominated FROM nominees ORDER BY sn ASC`) as unknown as {
    sn: number
    name: string
    phone: string
    division: string | null
    nominated: boolean
  }[]
  console.log(`Total: ${rows.length}`)
  for (const r of rows) {
    console.log(`${r.sn}\t${r.name}\t${r.phone}\t${r.division ?? '-'}\t${r.nominated ? 'NOMINATED' : ''}`)
  }
}

main().catch((error) => {
  console.error('✗ Dump failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
