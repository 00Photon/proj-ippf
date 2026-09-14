import { NextResponse } from 'next/server'
import { getAdminFromSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** Returns the current admin session info, or 401 if not signed in. */
export async function GET() {
  const admin = await getAdminFromSession()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
  }
  return NextResponse.json({ admin })
}
