import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { resolvePanelScope, studentCardAllowed } from '@/lib/admin/scope'

export const dynamic = 'force-dynamic'

/**
 * GET /api/panel/student/[id]/submissions
 * Медиа-сдачи ученика для куратора: аудио-пересказы, местописания, эмоции —
 * сгруппированы по блокам, ссылки на файлы подписаны (bucket private).
 * Scope как у карточки (studentCardAllowed), иначе 404.
 */

const BUCKET = 'student-recitations' // общий бакет пересказов/местописаний/эмоций
const SIGNED_TTL = 60 * 60

export interface PanelRecitation {
  date: string
  url: string | null
  passed: boolean
  score: number | null
  comment: string | null
  transcript: string | null
  duration: number | null
}
export interface PanelLocationAttempt {
  date: string
  name: string
  medium: string
  url: string | null
  passed: boolean
  score: number | null
  transcript: string | null
}
export interface PanelEmotion {
  createdAt: string
  kind: string
  text: string | null
  url: string | null
}
export interface PanelSubmissionsBlock {
  blockId: number
  orderNum: number
  title: string
  recitations: PanelRecitation[]
  locations: PanelLocationAttempt[]
  emotions: PanelEmotion[]
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getPanelSessionFromReq(req)
  if (!session) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, curator_id, city_id, hidden_from_tracking')
    .eq('id', id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  const scope = await resolvePanelScope(supabase, session)
  if (!(await studentCardAllowed(supabase, scope, profile))) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  const [{ data: recRaw }, { data: locRaw }, { data: emoRaw }, { data: blocksRaw }] =
    await Promise.all([
      supabase
        .from('student_block_recitations')
        .select('block_id, effective_date, created_at, storage_path, passed, ai_score, ai_comment, transcript, duration_seconds')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('student_location_attempts')
        .select('effective_date, created_at, storage_path, passed, similarity_score, transcript, medium, block_locations_to_recite(block_id, reference, topic_label)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('student_block_emotions')
        .select('block_id, kind, content_text, storage_path, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('blocks').select('id, order_num, title_ru').gt('order_num', 0),
    ])

  // Подписываем все storage-пути одной пачкой.
  const allPaths = new Set<string>()
  for (const r of recRaw ?? []) if (r.storage_path) allPaths.add(r.storage_path as string)
  for (const r of locRaw ?? []) if (r.storage_path) allPaths.add(r.storage_path as string)
  for (const r of emoRaw ?? []) if (r.storage_path) allPaths.add(r.storage_path as string)
  const urlByPath = new Map<string, string>()
  if (allPaths.size > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls([...allPaths], SIGNED_TTL)
    for (const s of (signed ?? []) as Array<{ path?: string; signedUrl?: string }>) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
    }
  }

  const byBlock = new Map<number, PanelSubmissionsBlock>()
  const blockMeta = new Map<number, { orderNum: number; title: string }>()
  for (const b of (blocksRaw ?? []) as { id: number; order_num: number; title_ru: string }[]) {
    blockMeta.set(b.id, { orderNum: b.order_num, title: b.title_ru })
  }
  const bucket = (blockId: number): PanelSubmissionsBlock => {
    let e = byBlock.get(blockId)
    if (!e) {
      const meta = blockMeta.get(blockId)
      e = {
        blockId,
        orderNum: meta?.orderNum ?? blockId,
        title: meta?.title ?? `Блок ${blockId}`,
        recitations: [],
        locations: [],
        emotions: [],
      }
      byBlock.set(blockId, e)
    }
    return e
  }

  for (const r of recRaw ?? []) {
    bucket(r.block_id).recitations.push({
      date: r.effective_date ?? String(r.created_at).slice(0, 10),
      url: r.storage_path ? urlByPath.get(r.storage_path) ?? null : null,
      passed: !!r.passed,
      score: r.ai_score != null ? Number(r.ai_score) : null,
      comment: r.ai_comment ?? null,
      transcript: r.transcript ?? null,
      duration: r.duration_seconds ?? null,
    })
  }
  for (const r of locRaw ?? []) {
    const loc = r.block_locations_to_recite as
      | { block_id: number; reference: string | null; topic_label: string | null }
      | null
    if (!loc) continue
    bucket(loc.block_id).locations.push({
      date: r.effective_date ?? String(r.created_at).slice(0, 10),
      name: loc.topic_label || loc.reference || 'Местописание',
      medium: r.medium ?? '',
      url: r.storage_path ? urlByPath.get(r.storage_path) ?? null : null,
      passed: !!r.passed,
      score: r.similarity_score != null ? Number(r.similarity_score) : null,
      transcript: r.transcript ?? null,
    })
  }
  for (const r of emoRaw ?? []) {
    bucket(r.block_id).emotions.push({
      createdAt: r.created_at,
      kind: r.kind ?? '',
      text: r.content_text ?? null,
      url: r.storage_path ? urlByPath.get(r.storage_path) ?? null : null,
    })
  }

  const blocks = [...byBlock.values()].sort((a, b) => a.orderNum - b.orderNum)
  return NextResponse.json({ ok: true, blocks })
}
