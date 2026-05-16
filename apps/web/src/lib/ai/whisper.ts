import { createServiceSupabase } from '../supabase-service'
import {
  WHISPER_API_URL,
  WHISPER_DEFAULT_LANGUAGE,
  WHISPER_DEFAULT_TIMEOUT_MS,
  WHISPER_MODEL,
} from './constants'

export interface WhisperCallOptions {
  /** mp3, mp4, mpeg, mpga, m4a, wav, webm. OGG не поддерживается напрямую — конвертить заранее. */
  file: Blob
  filename: string
  userId?: string | null
  language?: string
  prompt?: string
  timeoutMs?: number
}

export interface WhisperCallResult {
  transcript: string
  aiCallId: string | null
  durationMs: number
}

/**
 * Транскрибация аудио/видео через OpenAI Whisper API.
 * - Multipart/form-data, response_format='text' → возвращает чистую строку.
 * - Логирование в ai_call_log (input_tokens=null, output_tokens=длина транскрипта).
 * - Без retry: попытку повторяет вызывающий код, потому что файл может быть «битый».
 *
 * Telegram voice присылает .ogg → его нужно конвертить в .webm/.mp3 ДО вызова
 * (или использовать ffmpeg-обёртку). Это обязанность caller, см. apps/web/src/app/api/telegram/voice/route.ts.
 */
export async function callWhisper(opts: WhisperCallOptions): Promise<WhisperCallResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const language = opts.language ?? WHISPER_DEFAULT_LANGUAGE
  const timeoutMs = opts.timeoutMs ?? WHISPER_DEFAULT_TIMEOUT_MS

  const form = new FormData()
  form.append('file', opts.file, opts.filename)
  form.append('model', WHISPER_MODEL)
  form.append('language', language)
  form.append('response_format', 'text')
  if (opts.prompt) form.append('prompt', opts.prompt)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const res = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const msg = `Whisper ${res.status}: ${errText.slice(0, 300)}`
      await logWhisperCall(opts.userId ?? null, 0, Date.now() - startedAt, false, msg)
      throw new Error(msg)
    }

    const transcript = (await res.text()).trim()
    const aiCallId = await logWhisperCall(
      opts.userId ?? null,
      transcript.length,
      Date.now() - startedAt,
      true,
      null
    )

    return { transcript, aiCallId, durationMs: Date.now() - startedAt }
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : String(err)
    await logWhisperCall(opts.userId ?? null, 0, Date.now() - startedAt, false, msg)
    throw err
  }
}

async function logWhisperCall(
  userId: string | null,
  outputLength: number,
  durationMs: number,
  success: boolean,
  errorMessage: string | null
): Promise<string | null> {
  try {
    const supabase = createServiceSupabase()
    const { data, error } = await supabase
      .from('ai_call_log')
      .insert({
        provider: 'openai',
        model: WHISPER_MODEL,
        purpose: 'transcribe_audio',
        user_id: userId,
        input_tokens: null,
        output_tokens: outputLength,
        duration_ms: durationMs,
        success,
        error_message: errorMessage,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[ai_call_log] whisper insert failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.error('[ai_call_log] whisper exception:', err)
    return null
  }
}
