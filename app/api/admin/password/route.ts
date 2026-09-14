import { NextResponse, type NextRequest } from 'next/server'
import { changePassword, requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = (await request.json()) as { currentPassword?: unknown; newPassword?: unknown }
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    const result = await changePassword(admin.id, currentPassword, newPassword)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: 'Password updated. Please sign in again.' })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Password change failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 })
  }
}
