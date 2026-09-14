import { NextResponse, type NextRequest } from 'next/server'
import { login } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let username = ''
  let password = ''
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown }
    username = typeof body.username === 'string' ? body.username : ''
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }

  try {
    const result = await login(username, password)
    if (!result.ok) {
      // 401 for both wrong creds and lockout (lockout message comes in body)
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    return NextResponse.json({ ok: true, admin: result.admin })
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Login temporarily unavailable.' }, { status: 500 })
  }
}
