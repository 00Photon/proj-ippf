import { NextResponse } from 'next/server'
import { getNominatedNominees } from '@/lib/nominees'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Return only the nominated staff as the votable ballot.
  // Phones are deliberately excluded — voters only need names.
  const list = await getNominatedNominees()
  return NextResponse.json({
    staff: list.map(({ sn, name }) => ({ sn, name })),
    total: list.length,
  })
}
