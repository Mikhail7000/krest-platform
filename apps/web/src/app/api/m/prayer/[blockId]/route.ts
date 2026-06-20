/**
 * POST /api/m/prayer/[blockId]
 * Состояние и отметка ежедневной молитвы по кресту (галочка на доверии, 7 дней).
 *
 * Body: { initData: string, mark?: boolean }
 *  - mark=true → отметить сегодняшний день как «помолился»
 *  - иначе просто вернуть состояние
 *
 * Тестировщику (can_skip_block_lock) после первой отметки засчитывается вся неделя.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { isBlockUnlocked } from '@/lib/access/block-gate'

export const dynamic = 'force-dynamic'

const DAYS_REQUIRED = 7

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Виртуальная дата для ускоренного тест-режима: якорь 2000-01-01 + offset дней.
// Якорь намеренно вне реальных дат, чтобы «закрытые дни» не пересекались с боевыми.
function accelDate(offset: number): string {
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

interface PrayerRow {
  prayed_date: string
}

export async function POST(req: NextRequest, { params }: Params) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string; mark?: boolean }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) return err('Invalid block id', 'BAD_BLOCK_ID', 400)

  // Block-gate: проверяем, что блок разблокирован для этого пользователя
  if (!(await isBlockUnlocked(userId, blockId))) {
    return err('Этот блок ещё не открыт.', 'BLOCK_LOCKED', 403)
  }

  const supabase = createServiceSupabase()

  const [{ data: profile }, { data: progress }] = await Promise.all([
    supabase
      .from('profiles')
      .select('can_skip_block_lock, test_daily_accel')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('student_block_progress')
      .select('block_unlocked_at')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .maybeSingle(),
  ])
  const canSkip = Boolean((profile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)
  const testAccel = Boolean((profile as { test_daily_accel?: boolean } | null)?.test_daily_accel)

  const todayStr = formatDate(new Date())

  // Отметить день. В ускоренном тест-режиме (test_daily_accel) штампуем ВИРТУАЛЬНОЙ
  // датой (якорь 2000-01-01 + кол-во уже отмеченных дней), чтобы тестировщик закрыл
  // неделю за один календарный день. Обычным юзерам — реальная сегодняшняя дата (UTC).
  if (body.mark) {
    let markDate = todayStr
    if (testAccel) {
      const { count: existing } = await (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string, opts: { count: 'exact'; head: boolean }) => {
            eq: (col: string, val: unknown) => {
              eq: (col: string, val: unknown) => Promise<{ count: number | null }>
            }
          }
        }
      })
        .from('student_block_daily_prayer')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('block_id', blockId)
      markDate = accelDate(existing ?? 0)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('student_block_daily_prayer')
      .upsert(
        { user_id: userId, block_id: blockId, prayed_date: markDate },
        { onConflict: 'user_id,block_id,prayed_date' },
      )
  }

  // Загрузить отмеченные дни
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw } = await (supabase as any)
    .from('student_block_daily_prayer')
    .select('prayed_date')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .order('prayed_date', { ascending: true })
  const rows = (rowsRaw ?? []) as PrayerRow[]
  const prayedSet = new Set(rows.map((r) => r.prayed_date))

  // Старт календаря: block_unlocked_at, иначе сегодня (для тестировщика / нового блока)
  let startStr = (progress as { block_unlocked_at?: string | null } | null)?.block_unlocked_at ?? null
  if (!startStr) startStr = new Date().toISOString()
  const start = new Date(startStr)
  start.setUTCHours(0, 0, 0, 0)

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const todayIndex = Math.max(1, Math.floor((todayUtc.getTime() - start.getTime()) / 86_400_000) + 1)

  const days: Array<{ day_index: number; date: string; prayed: boolean }> = []
  for (let i = 0; i < DAYS_REQUIRED; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const dateStr = formatDate(d)
    days.push({ day_index: i + 1, date: dateStr, prayed: prayedSet.has(dateStr) })
  }

  // Тестировщику после первой отметки засчитывается вся неделя
  const weekCounted = canSkip && rows.length >= 1
  const completedCount = weekCounted ? DAYS_REQUIRED : rows.length

  return NextResponse.json({
    ok: true,
    today_index: todayIndex,
    today_date: todayStr,
    days,
    completed_count: completedCount,
    days_required: DAYS_REQUIRED,
    test_mode: weekCounted,
  })
}
