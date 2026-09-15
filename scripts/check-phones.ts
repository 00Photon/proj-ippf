/** Data-quality check: invalid/short/duplicate phones on the roll. */
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const rows = (await sql`SELECT sn, name, phone FROM nominees WHERE phone IS NOT NULL ORDER BY sn ASC`) as unknown as {
    sn: number
    name: string
    phone: string
  }[]

  const invalid = rows.filter((r) => !/^0\d{10}$/.test(r.phone))
  if (invalid.length > 0) {
    console.log(`⚠ ${invalid.length} phone(s) not 11 digits (0-prefixed):`)
    for (const r of invalid) console.log(`   sn ${r.sn} ${r.name}: ${r.phone} (${r.phone.length} digits)`)
  } else {
    console.log('✓ All phones are 11 digits')
  }

  const seen = new Map<string, number[]>()
  for (const r of rows) {
    seen.set(r.phone, [...(seen.get(r.phone) ?? []), r.sn])
  }
  const dupes = [...seen.entries()].filter(([, sns]) => sns.length > 1)
  if (dupes.length > 0) {
    console.log(`⚠ ${dupes.length} duplicate phone(s):`)
    for (const [phone, sns] of dupes) console.log(`   ${phone}: sn ${sns.join(', ')}`)
  } else {
    console.log('✓ No duplicate phones')
  }
  console.log(`Total with phone: ${rows.length}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
