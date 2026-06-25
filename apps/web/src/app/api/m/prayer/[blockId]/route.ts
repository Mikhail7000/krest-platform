/**
 * POST /api/m/prayer/[blockId]
 * Состояние и отметка ежедневной молитвы по кресту — СЧЁТЧИК-модель (канон 2026-06-25).
 *
 * Body: { initData: string, mark?: boolean }
 *  - mark=true → отметить сегодняшний день как «помолился» (если день доступен)
 *  - иначе просто вернуть состояние
 *
 * Никаких фиксированных будущих дат: следующий день открывается с 00:00 след. суток
 * по поясу ученика (см. lib/m/day-gate.ts). Тестировщику (test_daily_accel) — вирт.даты.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { isBlockUnlocked } from '@/lib/access/block-gate'
import { loadDayGate, dayGateRejection, DAY_TARGET } from '@/lib/m/day-gate'
import { notifyCuratorIfDayClosed } from '@/lib/curator/day-close-notify'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// Виртуальная дата для ускоренного тест-режима: якорь 2000-01-01 + offset дней.
function accelDate(offset: number): string {
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

interface PrayerRow {
  prayed_date: string
}

type DayState = 'done' | 'today' | 'waiting' | 'future'

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

  const [gate, { data: profile }] = await Promise.all([
    loadDayGate(supabase, userId, blockId),
    supabase
      .from('profiles')
      .select('can_skip_block_lock, test_daily_accel')
      .eq('id', userId)
      .maybeSingle(),
  ])
  const canSkip = Boolean((profile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)
  const testAccel = Boolean((profile as { test_daily_accel?: boolean } | null)?.test_daily_accel)

  // Загрузить отмеченные дни (до возможной отметки — нужно для гварда/счётчика)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadRows = async (): Promise<Set<string>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rowsRaw } = await (supabase as any)
      .from('student_block_daily_prayer')
      .select('prayed_date')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .order('prayed_date', { ascending: true })
    return new Set(((rowsRaw ?? []) as PrayerRow[]).map((r) => r.prayed_date))
  }

  let prayedSet = await loadRows()
  const todayPrayed = prayedSet.has(gate.localToday)

  // Отметить день, если запрошено и разрешено гейтом.
  if (body.mark && !todayPrayed) {
    let markDate = gate.localToday
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
    } else {
      // Дневной гейт: нельзя начать новый день/новый блок раньше 00:00 след. суток.
      const rejection = dayGateRejection(gate, todayPrayed)
      if (rejection) return err(rejection, 'DAY_LOCKED', 403)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('student_block_daily_prayer')
      .upsert(
        { user_id: userId, block_id: blockId, prayed_date: markDate },
        { onConflict: 'user_id,block_id,prayed_date' },
      )
    void notifyCuratorIfDayClosed(supabase, userId, markDate)
    prayedSet = await loadRows()
  }

  // Пересчитываем гейт после возможной отметки (день мог закрыться → следующий
  // блокируется до полуночи). closedDays/maxClosedDate уже свежие в новом вызове.
  const gate2 = body.mark && !todayPrayed ? await loadDayGate(supabase, userId, blockId) : gate
  const nowPrayedToday = prayedSet.has(gate2.localToday)
  const canMarkToday = gate2.canActToday && !nowPrayedToday

  // Уникальные даты молитвы (по возрастанию)
  const prayedDates = [...prayedSet].sort()

  // Виртуальные даты ускоренного тест-режима (якорь 2000-01-..) не показываем.
  const isVirtual = (d: string) => d.startsWith('2000-')

  // Строим список дней: [done…] + [today | waiting] + [future…] до 7.
  const days: Array<{ index: number; state: DayState; date: string | null }> = []
  for (let i = 0; i < prayedDates.length; i++) {
    days.push({ index: i + 1, state: 'done', date: isVirtual(prayedDates[i]) ? null : prayedDates[i] })
  }
  // Молитва — независимая практика: набираем до 7 дней молитвы (даже если другие
  // практики отстают). После 7 — слотов больше не предлагаем.
  if (prayedDates.length < DAY_TARGET) {
    // Следующий слот: сегодня (можно отметить) ИЛИ ожидание (молитва за сегодня уже
    // отмечена / первый день нового блока — откроется в 00:00 след. суток).
    const nextState: DayState = canMarkToday ? 'today' : 'waiting'
    days.push({
      index: days.length + 1,
      state: nextState,
      date: nextState === 'today' ? gate2.localToday : null,
    })
    while (days.length < DAY_TARGET) {
      days.push({ index: days.length + 1, state: 'future', date: null })
    }
  }

  const weekCounted = canSkip && prayedSet.size >= 1

  return NextResponse.json({
    ok: true,
    closed_days: gate2.closedDays,
    target: DAY_TARGET,
    block_complete: gate2.blockComplete,
    today: gate2.localToday,
    today_prayed: nowPrayedToday,
    can_mark_today: canMarkToday,
    next_day_locked: gate2.nextDayLocked,
    prayed_days: weekCounted ? DAY_TARGET : prayedDates.length,
    days,
    test_mode: weekCounted,
  })
}
