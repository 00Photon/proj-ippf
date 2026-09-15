import { NextResponse } from 'next/server'
import { getNominees } from '@/lib/nominees'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Full roll, names only — phones are deliberately excluded.
  // - division: needed by the /division page to scope each division's ballot
  // - nominated: the general ballot pool (division winners + admin overrides)
  const list = await getNominees()
  return NextResponse.json({
    staff: list.map(({ sn, name, division, nominated }) => ({ sn, name, division, nominated })),
    total: list.length,
  })
}
