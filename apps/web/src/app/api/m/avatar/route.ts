/**
 * POST /api/m/avatar  multipart { initData, file }
 *
 * Загрузка аватарки пользователя.
 *   - Валидация: image/jpeg | image/png | image/webp, размер ≤ 5MB.
 *   - Путь в бакете `avatars`: `${userId}.${ext}` (upsert=true — перезапись).
 *   - После upload → UPDATE profiles SET avatar_path=... WHERE id=userId.
 *
 * Ответ: { ok: true, avatar_url: string }
 * Ошибка: { error: { code, message } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return err('Используй multipart/form-data', 'BAD_CONTENT_TYPE', 400)
  }

  const form = await req.formData().catch(() => null)
  if (!form) return err('Невалидный form-data', 'BAD_REQUEST', 400)

  const initData = (form.get('initData') as string | null) ?? ''
  const file = form.get('file') as File | null

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  if (!file || file.size === 0) {
    return err('Файл обязателен (поле file)', 'NO_FILE', 400)
  }

  const mime = file.type || ''
  if (!ALLOWED_MIME.has(mime)) {
    return err('Допустимые форматы: JPEG, PNG, WebP', 'INVALID_TYPE', 400)
  }

  if (file.size > MAX_SIZE) {
    return err('Файл превышает 5MB', 'FILE_TOO_LARGE', 400)
  }

  const supabase = createServiceSupabase()

  const ext = extFromMime(mime)
  const storagePath = `${auth.userId}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: mime,
      upsert: true,
    })

  if (upErr) {
    console.error('[avatar] storage upload error:', upErr)
    return err('Не удалось загрузить файл', 'STORAGE_ERROR', 500)
  }

  // Обновляем profiles.avatar_path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('profiles')
    .update({ avatar_path: storagePath })
    .eq('id', auth.userId)

  if (updateErr) {
    console.error('[avatar] profile update error:', updateErr)
    return err('Файл загружен, но не удалось обновить профиль', 'UPDATE_ERROR', 500)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const avatar_url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`

  return NextResponse.json({ ok: true, avatar_url })
}
