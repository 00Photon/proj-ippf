import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { getSettings, requireAdmin } from '@/lib/admin-auth'
import { refreshDivisionNominees } from '@/lib/divisions'

export const dynamic = 'force-dynamic'

/** DELETE /api/admin/divisions/:id — remove a fraudulent/erroneous division vote. */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await context.params
    const voteId = Number.parseInt(id, 10)
    if (!Number.isFinite(voteId)) {
      return NextResponse.json({ error: 'Invalid division vote id.' }, { status: 400 })
    }

    const deleted = await sql`
      DELETE FROM division_votes WHERE id = ${voteId} RETURNING id, candidate_sn, division, cycle_month
    `
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Division vote not found.' }, { status: 404 })
    }

    const settings = await getSettings()
    await refreshDivisionNominees(settings.votingMonth)

    return NextResponse.json({ ok: true, deletedId: voteId })
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }
    console.error('Division vote delete failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to delete division vote.' }, { status: 500 })
  }
}
