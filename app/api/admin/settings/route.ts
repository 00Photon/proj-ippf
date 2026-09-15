import { NextResponse, type NextRequest } from 'next/server'
import { getSettings, requireAdmin, updateSettings } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()
    const body = (await request.json()) as { votingOpen?: unknown; divisionOpen?: unknown; votingMonth?: unknown }
    const settings = await updateSettings({
      votingOpen: typeof body.votingOpen === 'boolean' ? body.votingOpen : undefined,
      divisionOpen: typeof body.divisionOpen === 'boolean' ? body.divisionOpen : undefined,
      votingMonth: typeof body.votingMonth === 'string' ? body.votingMonth : undefined,
    })
    return NextResponse.json(settings)
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Settings update failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
