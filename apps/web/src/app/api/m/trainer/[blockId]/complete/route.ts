import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ blockId: string }> }

/**
 * POST /api/m/trainer/[blockId]/complete  { initData }
 * Отмечает тренажёр местописаний блока пройденным (trainer_passed_at) —
 * одно из условий открытия следующего блока.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { blockId } = await params
  const blockIdNum = Number(blockId)
  if (!Number.isFinite(blockIdNum)) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Bad blockId' } },
      { status: 400 },
    )
  }

  const { initData } = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(initData ?? '')
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { error } = await supabase
    .from('student_block_progress')
    .upsert(
      { user_id: auth.userId, block_id: blockIdNum, trainer_passed_at: new Date().toISOString() },
      { onConflict: 'user_id,block_id' },
    )

  if (error) {
    console.error('[trainer/complete]', error)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to save' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
