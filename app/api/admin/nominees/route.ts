import { NextResponse, type NextRequest } from 'next/server'
import { addNominee, removeNominee, updateNominee } from '@/lib/nominees'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/nominees — add a staff member to the nominal roll.
 * Body: { name, phone }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    let body: { name?: unknown; phone?: unknown }
    try {
      body = (await request.json()) as { name?: unknown; phone?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (typeof body.name !== 'string' || typeof body.phone !== 'string') {
      return NextResponse.json({ error: 'Name and phone are required.' }, { status: 400 })
    }

    const result = await addNominee(body.name, body.phone)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, nominee: result.nominee }, { status: 201 })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Add nominee route failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to add nominee.' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/nominees — edit a nominee's name and/or phone.
 * Body: { sn, name, phone }
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    let body: { sn?: unknown; name?: unknown; phone?: unknown }
    try {
      body = (await request.json()) as { sn?: unknown; name?: unknown; phone?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const sn = typeof body.sn === 'number' ? body.sn : Number.parseInt(String(body.sn ?? ''), 10)
    if (typeof body.name !== 'string' || typeof body.phone !== 'string' || !Number.isFinite(sn)) {
      return NextResponse.json({ error: 'S/N, name and phone are required.' }, { status: 400 })
    }

    const result = await updateNominee(sn, body.name, body.phone)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, nominee: result.nominee })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Update nominee route failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to update nominee.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/nominees?sn=12 — remove a staff member from the roll.
 * Refused while the nominee still has recorded votes.
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    const sn = Number.parseInt(request.nextUrl.searchParams.get('sn') ?? '', 10)
    if (!Number.isFinite(sn)) {
      return NextResponse.json({ error: 'A valid nominee S/N is required.' }, { status: 400 })
    }

    const result = await removeNominee(sn)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, deletedSn: sn })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Remove nominee route failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to remove nominee.' }, { status: 500 })
  }
}
