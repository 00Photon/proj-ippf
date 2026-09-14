import { NextResponse } from 'next/server'
import { getCycles, requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** Admin: list every voting cycle that exists in the data, for month filters. */
export async function GET() {
  try {
    await requireAdmin()
    const cycles = await getCycles()
    return NextResponse.json({ cycles })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Cycles fetch failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to load cycles.' }, { status: 500 })
  }
}
