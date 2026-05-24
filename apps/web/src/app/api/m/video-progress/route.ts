import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateTelegramInitData } from '@/lib/telegram/init-data'
import type { Database } from '../../../../../../../packages/supabase/src/types'

export const dynamic = 'force-dynamic'

const COMPLETED_THRESHOLD = 0.95

const supabaseAdmin = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

interface SavePayload {
  blockResourceId: string
  maxWatchedSeconds: number
  totalSeconds?: number
}

interface PostBody {
  initData?: string
  save?: SavePayload
}

interface ProgressEntry {
  maxWatchedSeconds: number
  totalSeconds: number | null
  completedAt: string | null
}

type ProgressMap = Record<string, ProgressEntry>

function jsonError(reason: string, status = 400) {
  return NextResponse.json({ ok: false, reason }, { status })
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return jsonError('config', 500)

  const body = (await req.json().catch(() => ({}))) as PostBody
  const initData = body.initData ?? ''

  const v = validateTelegramInitData(initData, botToken)
  if (!v.ok) return jsonError(v.reason, 401)

  const supabase = supabaseAdmin()

  // Найти профайл по telegram_chat_id. Если профайла нет (пользователь
  // не прошёл онбординг) — no-skip всё равно работает на клиенте,
  // но прогресс не сохраняется.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, can_skip_block_lock')
    .eq('telegram_chat_id', v.chatId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ ok: true, persisted: false, reason: 'no_profile', progress: {}, canSkip: false })
  }

  // Тестировщики (can_skip_block_lock) смотрят видео без no-skip — можно перематывать
  const canSkip = Boolean((profile as { can_skip_block_lock?: boolean }).can_skip_block_lock)

  // Опциональное сохранение прогресса
  let persisted = false
  if (body.save) {
    const { blockResourceId, maxWatchedSeconds, totalSeconds } = body.save
    if (
      typeof blockResourceId !== 'string'
      || typeof maxWatchedSeconds !== 'number'
      || !Number.isFinite(maxWatchedSeconds)
      || maxWatchedSeconds < 0
    ) {
      return jsonError('bad_payload', 400)
    }

    // Проверяем, что ресурс существует и это видео
    const { data: resource } = await supabase
      .from('block_resources')
      .select('id, resource_type')
      .eq('id', blockResourceId)
      .maybeSingle()
    if (!resource) return jsonError('resource_not_found', 404)
    if (!['main_video', 'additional_video'].includes(resource.resource_type)) {
      return jsonError('bad_resource_type', 400)
    }

    const { data: current } = await supabase
      .from('video_watch_progress')
      .select('max_watched_seconds, completed_at, total_seconds')
      .eq('user_id', profile.id)
      .eq('block_resource_id', blockResourceId)
      .maybeSingle()

    const newMax = Math.max(Math.floor(maxWatchedSeconds), current?.max_watched_seconds ?? 0)
    const newTotal =
      typeof totalSeconds === 'number' && totalSeconds > 0
        ? Math.round(totalSeconds)
        : current?.total_seconds ?? null
    // Тестировщику видео засчитывается сразу (без досмотра до 95%)
    const isCompleted = canSkip || (newTotal && newMax / newTotal >= COMPLETED_THRESHOLD)
    const completedAt = current?.completed_at ?? (isCompleted ? new Date().toISOString() : null)

    const { error } = await supabase
      .from('video_watch_progress')
      .upsert(
        {
          user_id: profile.id,
          block_resource_id: blockResourceId,
          max_watched_seconds: newMax,
          total_seconds: newTotal,
          completed_at: completedAt,
        },
        { onConflict: 'user_id,block_resource_id' },
      )
    if (error) return jsonError('db_error', 500)

    persisted = true
  }

  // Возвращаем актуальное состояние всех видео-прогрессов юзера
  const { data: rows } = await supabase
    .from('video_watch_progress')
    .select('block_resource_id, max_watched_seconds, total_seconds, completed_at')
    .eq('user_id', profile.id)

  const progress: ProgressMap = {}
  for (const r of rows ?? []) {
    progress[r.block_resource_id] = {
      maxWatchedSeconds: r.max_watched_seconds,
      totalSeconds: r.total_seconds,
      completedAt: r.completed_at,
    }
  }

  return NextResponse.json({ ok: true, persisted, progress, canSkip })
}
