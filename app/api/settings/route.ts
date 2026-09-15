import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** Public: current voting open/closed states and active month. */
export async function GET() {
  const settings = await getSettings()
  return NextResponse.json(settings)
}
