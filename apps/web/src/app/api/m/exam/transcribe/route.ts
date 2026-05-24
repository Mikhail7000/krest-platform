/**
 * POST /api/m/exam/transcribe
 * Транскрипция аудио-ответа на развёрнутый вопрос экзамена.
 *
 * multipart: { initData, file }
 * Ответ: { ok, transcript }
 *
 * Лимит длительности 180с контролируется на клиенте (запись); здесь — страховка
 * по размеру файла.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { callDeepgram } from '@/lib/ai/deepgram'

export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 МБ — с запасом на ~180с речи

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return err('Invalid form', 'BAD_REQUEST', 400)

  const initData = (form.get('initData') as string | null) ?? ''
  const file = form.get('file') as File | null

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  if (!file || file.size === 0) return err('file required', 'NO_FILE', 400)
  if (file.size > MAX_FILE_BYTES) return err('Файл слишком большой', 'FILE_TOO_LARGE', 400)

  const mimeType = file.type || 'audio/webm'
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await callDeepgram({
      audio: buffer,
      mimeType,
      languageHint: 'ru',
      userId: auth.userId,
      purpose: 'transcribe_audio',
    })
    const transcript = result.transcript.trim()
    if (!transcript) return err('Не удалось распознать речь. Запишите ещё раз.', 'EMPTY_TRANSCRIPT', 422)
    return NextResponse.json({ ok: true, transcript })
  } catch (e) {
    console.error('[exam/transcribe] Deepgram error:', e)
    return err('Не удалось расшифровать аудио. Попробуйте ещё раз.', 'TRANSCRIPTION_FAILED', 500)
  }
}
