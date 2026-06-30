import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { studentLocalToday } from '@/lib/time/local-day'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ blockId: string }> }

// Виртуальная дата для ускоренного тест-режима: якорь 2000-01-01 + offset дней.
// Якорь намеренно вне реальных дат, чтобы «закрытые дни» не пересекались с боевыми.
function accelDate(offset: number): string {
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/m/trainer/[blockId]/complete  { initData }
 * Дневная отметка тренажёра (за сегодня). Тренажёр — одно из 5 ежедневных
 * заданий: «закрытый день» требует тренажёр+фото+молитву+местописания+пересказ
 * за одну дату. См. is_block_unlocked.
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

  // Дневная отметка: одна на user×block×дату (по поясу города ученика, как
  // daily_cross/daily_prayer). В ускоренном тест-режиме (profiles.test_daily_accel)
  // штампуем ВИРТУАЛЬНОЙ датой (якорь 2000-01-01 + кол-во уже существующих отметок
  // тренажёра для user+block), чтобы тестировщик закрыл много «дней» за один день.
  let trainedDate = await studentLocalToday(supabase, auth.userId)
  const { data: accelProfile } = await supabase
    .from('profiles')
    .select('test_daily_accel')
    .eq('id', auth.userId)
    .maybeSingle()
  if (accelProfile?.test_daily_accel) {
    const { count: existing } = await supabase
      .from('student_block_daily_trainer')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .eq('block_id', blockIdNum)
    trainedDate = accelDate(existing ?? 0)
  }

  const { error } = await supabase
    .from('student_block_daily_trainer')
    .upsert(
      { user_id: auth.userId, block_id: blockIdNum, trained_date: trainedDate },
      { onConflict: 'user_id,block_id,trained_date' },
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
