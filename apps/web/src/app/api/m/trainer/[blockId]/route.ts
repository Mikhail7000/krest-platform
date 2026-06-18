/**
 * POST /api/m/trainer/[blockId]
 * Данные для тренажёра местописаний: стихи блока + всех предыдущих блоков
 * (прогрессивное повторение). Только обучение — без оценок и сабмишенов.
 *
 * Body: { initData: string }
 *
 * Response 200:
 * {
 *   ok: true,
 *   currentBlockId: number,
 *   currentOrder: number,
 *   trainer_passed_at: string | null,   // статус прохождения тренажёра текущего блока
 *   blocks: Array<{ id: number, order_num: number, title_ru: string }>,
 *   verses: Array<{ id, block_id, reference, exact_text, topic_label, order_index }>
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

export async function POST(req: NextRequest, { params }: Params) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('Invalid block id', 'BAD_BLOCK_ID', 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // 1. order_num текущего блока
  const { data: current, error: curErr } = await supabase
    .from('blocks')
    .select('id, order_num')
    .eq('id', blockId)
    .maybeSingle()

  if (curErr || !current || current.order_num == null) {
    return err('Block not found', 'BLOCK_NOT_FOUND', 404)
  }
  const currentOrder = current.order_num as number

  // 2. Все блоки до текущего включительно (прогрессивное повторение) + статус тренажёра
  const [
    { data: blocksData, error: blocksErr },
    { data: progressRow },
  ] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, order_num, title_ru')
      .lte('order_num', currentOrder)
      .gte('order_num', 1)
      .order('order_num', { ascending: true }) as Promise<{ data: Array<{ id: number; order_num: number; title_ru: string | null }> | null; error: unknown }>,
    supabase
      .from('student_block_progress')
      .select('trainer_passed_at')
      .eq('user_id', auth.userId)
      .eq('block_id', blockId)
      .maybeSingle() as Promise<{ data: { trainer_passed_at: string | null } | null; error: unknown }>,
  ])

  if (blocksErr || !blocksData) {
    return err('Failed to load blocks', 'DB_ERROR', 500)
  }

  const blockIds = blocksData.map((b: { id: number }) => b.id)
  const trainerPassedAt: string | null = progressRow?.trainer_passed_at ?? null

  // 3. Местописания этих блоков
  const { data: verses, error: vErr } = await supabase
    .from('block_locations_to_recite')
    .select('id, block_id, reference, exact_text, topic_label, order_index')
    .in('block_id', blockIds)
    .order('block_id', { ascending: true })
    .order('order_index', { ascending: true })

  if (vErr) {
    return err('Failed to load verses', 'DB_ERROR', 500)
  }

  return NextResponse.json({
    ok: true,
    currentBlockId: blockId,
    currentOrder,
    trainer_passed_at: trainerPassedAt,
    blocks: blocksData.map((b: { id: number; order_num: number; title_ru: string | null }) => ({
      id: b.id,
      order_num: b.order_num,
      title_ru: b.title_ru ?? `Блок ${b.order_num}`,
    })),
    verses: ((verses ?? []) as Array<{ id: string; block_id: number; reference: string; exact_text: string; topic_label: string | null; order_index: number }>).map((v) => ({
      id: v.id,
      block_id: v.block_id,
      reference: v.reference,
      exact_text: v.exact_text,
      topic_label: v.topic_label ?? null,
      order_index: v.order_index,
    })),
  })
}
