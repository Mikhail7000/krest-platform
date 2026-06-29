/**
 * Фон карточки рейтинга (своя картинка ученика).
 *
 * GET  ?initData=...            → { ok, bg_url }            — текущий фон
 * POST multipart { initData, file }                        → { ok, bg_url }  — загрузка
 * POST multipart { initData, remove: "true" }              → { ok, bg_url:null } — убрать
 *
 * Валидация: image/jpeg|png|webp, ≤ 5MB. Бакет `avatars` (публичный),
 * путь `${userId}-lbbg.${ext}`. Колонка profiles.leaderboard_bg_path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function publicUrl(path: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get('initData') ?? ''
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const supabase = createServiceSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('profiles')
    .select('leaderboard_bg_path')
    .eq('id', auth.userId)
    .maybeSingle()
  return NextResponse.json({ ok: true, bg_url: publicUrl(data?.leaderboard_bg_path ?? null) })
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return err('Используй multipart/form-data', 'BAD_CONTENT_TYPE', 400)
  }
  const form = await req.formData().catch(() => null)
  if (!form) return err('Невалидный form-data', 'BAD_REQUEST', 400)

  const initData = (form.get('initData') as string | null) ?? ''
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const supabase = createServiceSupabase()

  // Убрать фон
  if ((form.get('remove') as string | null) === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rmErr } = await (supabase as any)
      .from('profiles')
      .update({ leaderboard_bg_path: null })
      .eq('id', auth.userId)
    if (rmErr) return err('Не удалось убрать фон', 'UPDATE_ERROR', 500)
    return NextResponse.json({ ok: true, bg_url: null })
  }

  const file = form.get('file') as File | null
  if (!file || file.size === 0) return err('Файл обязателен (поле file)', 'NO_FILE', 400)

  const mime = file.type || ''
  if (!ALLOWED_MIME.has(mime)) return err('Допустимые форматы: JPEG, PNG, WebP', 'INVALID_TYPE', 400)
  if (file.size > MAX_SIZE) return err('Файл превышает 5MB', 'FILE_TOO_LARGE', 400)

  const ext = extFromMime(mime)
  const storagePath = `${auth.userId}-lbbg.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: true })
  if (upErr) {
    console.error('[leaderboard-bg] storage upload error:', upErr)
    return err('Не удалось загрузить файл', 'STORAGE_ERROR', 500)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('profiles')
    .update({ leaderboard_bg_path: storagePath })
    .eq('id', auth.userId)
  if (updateErr) {
    console.error('[leaderboard-bg] profile update error:', updateErr)
    return err('Файл загружен, но профиль не обновился', 'UPDATE_ERROR', 500)
  }

  // ?t= — сбросить кэш картинки (путь стабильный при upsert)
  const url = publicUrl(storagePath)
  return NextResponse.json({ ok: true, bg_url: url ? `${url}?t=${Date.now()}` : null })
}
