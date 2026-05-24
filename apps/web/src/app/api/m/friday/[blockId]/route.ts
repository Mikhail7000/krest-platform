/**
 * POST /api/m/friday/[blockId]
 * Эпоха пятницы (практика): впечатления после передачи «Малого креста».
 *
 * Body: { initData: string, impressions?: string }
 *  - impressions передан → сохранить (upsert), иначе вернуть текущее состояние
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest, { params }: Params) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string; impressions?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) return err('Invalid block id', 'BAD_BLOCK_ID', 400)

  const supabase = createServiceSupabase()

  if (typeof body.impressions === 'string') {
    const text = body.impressions.trim()
    if (text.length < 3) return err('Слишком короткий текст', 'TOO_SHORT', 400)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('student_block_friday_practice')
      .upsert(
        { user_id: userId, block_id: blockId, impressions: text, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,block_id' },
      )
    if (error) {
      console.error('[friday] upsert error:', error)
      return err('Не удалось сохранить', 'DB_ERROR', 500)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from('student_block_friday_practice')
    .select('impressions')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    submitted: !!row,
    impressions: (row as { impressions?: string } | null)?.impressions ?? '',
  })
}
