/**
 * POST /api/m/cross-photo/delete  { initData, blockId, date }
 *
 * Удаляет фото креста ученика за УКАЗАННУЮ дату (только своё) — разрешено лишь для
 * ПОСЛЕДНЕГО (самого свежего) дня с фото, чтобы случайно не «раскрыть» прошлый
 * закрытый день. Удаляет файл из Storage + запись student_block_daily_cross.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const BUCKET = 'student-cross-photos'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    initData?: string
    blockId?: number
    date?: string
  }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const blockId = Number(body.blockId)
  if (!Number.isFinite(blockId) || blockId < 1) return err('Invalid block id', 'BAD_BLOCK_ID', 400)
  const date = String(body.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Invalid date', 'BAD_DATE', 400)

  const supabase = createServiceSupabase()

  // Последний (самый свежий) день с фото у этого ученика в этом блоке.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from('student_block_daily_cross')
    .select('submitted_date, storage_path')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .order('submitted_date', { ascending: false })
    .limit(1)
  const latest = (rows ?? [])[0] as { submitted_date: string; storage_path: string | null } | undefined

  if (!latest) return err('Фото за этот блок не найдено', 'NOT_FOUND', 404)
  if (latest.submitted_date !== date) {
    return err('Удалить можно только фото последнего дня', 'NOT_LATEST', 400)
  }

  // Удаляем файл из Storage (если есть) — ошибку не считаем критичной.
  if (latest.storage_path) {
    await supabase.storage.from(BUCKET).remove([latest.storage_path])
  }

  // Удаляем запись дня.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any)
    .from('student_block_daily_cross')
    .delete()
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .eq('submitted_date', date)

  if (delErr) {
    console.error('[cross-photo/delete] delete error:', delErr)
    return err('Не удалось удалить фото', 'DB_ERROR', 500)
  }

  return NextResponse.json({ ok: true })
}
