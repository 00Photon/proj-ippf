/** Utility to clear all votes (fresh cycle) or a single phone. Usage:
 *   npx tsx scripts/clear-votes.ts            -> delete all votes
 *   npx tsx scripts/clear-votes.ts 0803...    -> delete one phone's vote
 */
import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  const sql = neon(url)
  const phone = process.argv[2]

  if (phone) {
    const deleted = await sql`DELETE FROM votes WHERE voter_phone = ${phone} RETURNING id`
    console.log(`Deleted ${deleted.length} vote(s) for ${phone}`)
  } else {
    const deleted = await sql`DELETE FROM votes RETURNING id`
    console.log(`Deleted ${deleted.length} vote(s) — fresh cycle ready`)
  }
}

main().catch((error) => {
  console.error('Failed:', error.message)
  process.exit(1)
})
