import { NextResponse } from 'next/server'
import { getNominees } from '@/lib/nominees'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Full roll, names only — phones are deliberately excluded.
  // - division: needed by the /division page to scope each division's ballot
  // - nominated: the general ballot pool (division winners + admin overrides)
  // - Voters-only staff (notNominee) are hidden from the public roll entirely:
  //   they can sign in and vote, but never appear as votable candidates.
  const list = await getNominees()
  const visible = list.filter((m) => !m.notNominee)
  return NextResponse.json({
    staff: visible.map(({ sn, name, division, nominated }) => ({ sn, name, division, nominated })),
    total: visible.length,
  })
}
