import { NextResponse } from 'next/server'
import { logout } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await logout()
  } catch (error) {
    console.error('Logout failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.json({ ok: true })
}
