/**
 * POST /api/m/community/post
 * Создание поста в глобальной ленте сообщества.
 *
 * Принимает два формата:
 *   - JSON:      { initData, kind: 'text', content_text }
 *   - multipart: { initData, kind: 'audio'|'video_note'|'photo', media: File, content_text? }
 *
 * Ответ: { ok: true, post: FeedPost } — полный объект для оптимистичного
 * добавления в ленту на клиенте (имя автора, город, signed media URL).
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const BUCKET = 'community-media'
const MAX_TEXT_LENGTH = 2000
const ALLOWED_KINDS = ['text', 'audio', 'video_note', 'photo'] as const
type AllowedKind = typeof ALLOWED_KINDS[number]

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Собирает полный объект поста для ленты (как отдаёт /feed): имя автора, город,
 * signed URL медиа. can_delete=true — это пост самого автора.
 */
async function buildFeedPost(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: {
    id: string
    created_at: string
    kind: string
    content_text: string | null
    storagePath: string | null
    userId: string
  },
) {
  const { data: author } = await supabase
    .from('profiles')
    .select('full_name, cities(name_ru)')
    .eq('id', args.userId)
    .single()

  let mediaUrl: string | null = null
  if (args.storagePath) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(args.storagePath, 3600)
    mediaUrl = signed?.signedUrl ?? null
  }

  // cities при many-to-one может прийти объектом или массивом — обрабатываем оба
  const c = author?.cities
  const city = Array.isArray(c) ? c[0]?.name_ru ?? null : c?.name_ru ?? null

  return {
    id: args.id,
    kind: args.kind,
    content_text: args.content_text,
    media_url: mediaUrl,
    author_name: author?.full_name ?? 'Ученик',
    author_city: city,
    created_at: args.created_at,
    can_delete: true,
  }
}

function extFromMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('m4a') || mime.includes('x-m4a')) return 'm4a'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'bin'
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  const supabase = createServiceSupabase()

  // ── Медиа-пост (multipart) ─────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) return err('Invalid form', 'BAD_REQUEST', 400)

    const initData = (form.get('initData') as string | null) ?? ''
    const kind = (form.get('kind') as string | null) ?? ''
    const file = form.get('media') as File | null
    const contentTextRaw = form.get('content_text') as string | null

    const auth = await resolveUserId(initData)
    if (!auth.ok) return err(auth.message, auth.code, auth.status)

    // Валидация kind для медиа
    if (!(['audio', 'video_note', 'photo'] as string[]).includes(kind)) {
      return err('kind должен быть audio, video_note или photo для медиа-поста', 'BAD_KIND', 400)
    }

    if (!file || file.size === 0) {
      return err('Файл обязателен для медиа-поста', 'NO_FILE', 400)
    }

    const mime = file.type || 'application/octet-stream'
    const ext = extFromMime(mime)
    const storagePath = `${auth.userId}/${randomUUID()}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: mime, upsert: false })

    if (upErr) {
      console.error('[community/post] upload error:', upErr)
      return err('Не удалось загрузить файл', 'STORAGE_ERROR', 500)
    }

    const contentText =
      typeof contentTextRaw === 'string' && contentTextRaw.trim().length > 0
        ? contentTextRaw.trim().slice(0, MAX_TEXT_LENGTH)
        : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertErr } = await (supabase as any)
      .from('community_posts')
      .insert({
        author_id: auth.userId,
        kind,
        storage_path: storagePath,
        content_text: contentText,
      })
      .select('id, created_at')
      .single()

    if (insertErr) {
      console.error('[community/post] insert error:', insertErr)
      return err('Не удалось сохранить пост', 'DB_ERROR', 500)
    }

    const row = inserted as { id: string; created_at: string }
    const post = await buildFeedPost(supabase, {
      id: row.id,
      created_at: row.created_at,
      kind,
      content_text: contentText,
      storagePath,
      userId: auth.userId,
    })
    return NextResponse.json({ ok: true, post }, { status: 201 })
  }

  // ── Текстовый пост (JSON) ─────────────────────────────────────────────────
  const body = await req.json().catch(() => null) as {
    initData?: string
    kind?: string
    content_text?: string
  } | null

  if (!body) return err('Invalid JSON', 'BAD_REQUEST', 400)

  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  // Для JSON допускаем только text (медиа требует multipart)
  const kind = body.kind ?? 'text'
  if (!(ALLOWED_KINDS as readonly string[]).includes(kind)) {
    return err(`kind должен быть одним из: ${ALLOWED_KINDS.join(', ')}`, 'BAD_KIND', 400)
  }

  if (kind !== 'text') {
    return err('Для медиа-постов используй multipart/form-data', 'USE_MULTIPART', 400)
  }

  const contentText =
    typeof body.content_text === 'string' ? body.content_text.trim() : ''

  if (contentText.length < 1) {
    return err('content_text обязателен для текстового поста', 'EMPTY_TEXT', 400)
  }

  const truncated = contentText.slice(0, MAX_TEXT_LENGTH)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('community_posts')
    .insert({
      author_id: auth.userId,
      kind: 'text' as AllowedKind,
      content_text: truncated,
      storage_path: null,
    })
    .select('id, created_at')
    .single()

  if (insertErr) {
    console.error('[community/post] insert error:', insertErr)
    return err('Не удалось сохранить пост', 'DB_ERROR', 500)
  }

  const row = inserted as { id: string; created_at: string }
  const post = await buildFeedPost(supabase, {
    id: row.id,
    created_at: row.created_at,
    kind: 'text',
    content_text: truncated,
    storagePath: null,
    userId: auth.userId,
  })
  return NextResponse.json({ ok: true, post }, { status: 201 })
}
