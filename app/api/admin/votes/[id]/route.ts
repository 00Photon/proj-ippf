import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** DELETE /api/admin/votes/:id — remove a fraudulent/erroneous vote. */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await context.params
    const voteId = Number.parseInt(id, 10)
    if (!Number.isFinite(voteId)) {
      return NextResponse.json({ error: 'Invalid vote id.' }, { status: 400 })
    }

    const deleted = await sql`
      DELETE FROM votes WHERE id = ${voteId} RETURNING id
    `
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Vote not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, deletedId: voteId })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Vote delete failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to delete vote.' }, { status: 500 })
  }
}
