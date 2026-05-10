/**
 * POST /api/m/recitation/[blockId]
 * Состояние пересказа блока: последние попытки audio + video_note.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   audio_passed_at: string | null,
 *   video_passed_at: string | null,
 *   last_attempts: {
 *     audio: { passed, ai_score, ai_comment, transcript, created_at } | null,
 *     video: { passed, ai_score, ai_comment, transcript, created_at } | null,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ blockId: string }>
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// local interface — table not yet in generated types
interface RecitationRow {
  id: string
  medium: string
  passed: boolean
  ai_score: number | null
  ai_comment: string | null
  transcript: string | null
  created_at: string
}

export async function POST(req: NextRequest, { params }: Params) {
  // 1. Auth
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  // 2. blockId
  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('Invalid block id', 'BAD_BLOCK_ID', 400)
  }

  const supabase = createServiceSupabase()

  // 3. Загружаем последние попытки по каждому medium
  // cast через unknown — таблица не в сгенерированных типах
  const { data: rowsRaw, error: fetchErr } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          eq: (col: string, val: unknown) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: RecitationRow[] | null; error: unknown }>
            }
          }
        }
      }
    }
  })
    .from('student_block_recitations')
    .select('id, medium, passed, ai_score, ai_comment, transcript, created_at')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (fetchErr) {
    console.error('[recitation/state] fetch error:', fetchErr)
    return err('Failed to load recitations', 'DB_ERROR', 500)
  }

  const rows = (rowsRaw ?? []) as RecitationRow[]

  const lastAudio = rows.find((r) => r.medium === 'audio') ?? null
  const videoRows = rows.filter((r) => r.medium === 'video_note')

  const audioPassedRow = rows
    .slice()
    .reverse()
    .find((r) => r.medium === 'audio' && r.passed)
  const videoPassedRow = rows
    .slice()
    .reverse()
    .find((r) => r.medium === 'video_note' && r.passed)

  return NextResponse.json({
    ok: true,
    audio: lastAudio
      ? {
          passed: lastAudio.passed,
          ai_score: lastAudio.ai_score,
          ai_comment: lastAudio.ai_comment,
          transcript: lastAudio.transcript,
          created_at: lastAudio.created_at,
        }
      : null,
    videos: videoRows.map((r) => ({
      id: r.id,
      passed: r.passed,
      ai_score: r.ai_score,
      ai_comment: r.ai_comment,
      created_at: r.created_at,
    })),
    audio_passed_at: audioPassedRow?.created_at ?? null,
    video_passed_at: videoPassedRow?.created_at ?? null,
  })
}
