import { NextResponse } from 'next/server'
import { getNominees } from '@/lib/nominees'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Return the full nominal roll as the nominee pool.
  // Phones are deliberately excluded — voters only need names.
  const list = await getNominees()
  return NextResponse.json({
    staff: list.map(({ sn, name }) => ({ sn, name })),
    total: list.length,
  })
}
