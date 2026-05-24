/**
 * POST /api/m/emotions/[blockId]
 * Эмоции и свидетельства (НЕобязательный пункт): текст / аудио / кружок.
 *
 *  - multipart (initData, kind, file) → загрузить аудио или видеокружок
 *  - json { initData, text }          → сохранить текстовое свидетельство
 *  - json { initData }                → вернуть список записей
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const BUCKET = 'student-recitations'
const SIGNED_TTL = 60 * 60

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface EmotionRow {
  id: string
  kind: string
  content_text: string | null
  storage_path: string | null
  created_at: string
}

function extFromMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg')) return 'mp3'
  return 'webm'
}

async function buildState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  blockId: number,
) {
  const { data: rowsRaw } = await supabase
    .from('student_block_emotions')
    .select('id, kind, content_text, storage_path, created_at')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .order('created_at', { ascending: false })
  const rows = (rowsRaw ?? []) as EmotionRow[]

  const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p)
  const urlByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    content_text: r.content_text,
    media_url: r.storage_path ? urlByPath.get(r.storage_path) ?? null : null,
    created_at: r.created_at,
  }))
}

export async function POST(req: NextRequest, { params }: Params) {
  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) return err('Invalid block id', 'BAD_BLOCK_ID', 400)

  const contentType = req.headers.get('content-type') ?? ''
  const supabase = createServiceSupabase()

  // ── Загрузка медиа (multipart) ──
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) return err('Invalid form', 'BAD_REQUEST', 400)
    const initData = (form.get('initData') as string | null) ?? ''
    const kind = (form.get('kind') as string | null) ?? ''
    const file = form.get('file') as File | null

    const auth = await resolveUserId(initData)
    if (!auth.ok) return err(auth.message, auth.code, auth.status)
    if (!['audio', 'video_note'].includes(kind)) return err('bad kind', 'BAD_KIND', 400)
    if (!file || file.size === 0) return err('file required', 'NO_FILE', 400)

    const mime = file.type || (kind === 'audio' ? 'audio/webm' : 'video/webm')
    const path = `${auth.userId}/emotions/${blockId}/${Date.now()}.${extFromMime(mime)}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true })
    if (upErr) {
      console.error('[emotions] upload error:', upErr)
      return err('Не удалось загрузить', 'STORAGE_ERROR', 500)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('student_block_emotions').insert({
      user_id: auth.userId, block_id: blockId, kind, storage_path: path,
    })
    return NextResponse.json({ ok: true, items: await buildState(supabase, auth.userId, blockId) })
  }

  // ── Текст или состояние (json) ──
  const body = (await req.json().catch(() => ({}))) as { initData?: string; text?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  if (typeof body.text === 'string' && body.text.trim().length >= 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('student_block_emotions').insert({
      user_id: auth.userId, block_id: blockId, kind: 'text', content_text: body.text.trim(),
    })
  }

  return NextResponse.json({ ok: true, items: await buildState(supabase, auth.userId, blockId) })
}
