import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/panel/student/[id]/crosses
 * Все загруженные фото крестов ученика по дням, сгруппированные по блокам.
 * Гард: admin/super_admin — любой ученик; curator — только свой (иначе 404).
 * View-as прозрачен: getPanelSessionFromReq отдаёт эффективную сессию (uid/role цели).
 */

interface CrossRow {
  block_id: number
  submitted_date: string
  storage_path: string
}

export interface PanelCrossDay {
  date: string
  url: string | null
  virtual: boolean
}
export interface PanelCrossBlock {
  blockId: number
  orderNum: number
  title: string
  days: PanelCrossDay[]
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = getPanelSessionFromReq(req)
  if (!session) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Видимость: куратор — только свой ученик (404, чтобы не раскрывать существование).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, curator_id')
    .eq('id', id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  if (session.role === 'curator' && profile.curator_id !== session.uid) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  const { data: rowsRaw } = await supabase
    .from('student_block_daily_cross')
    .select('block_id, submitted_date, storage_path')
    .eq('user_id', id)
    .order('block_id', { ascending: true })
    .order('submitted_date', { ascending: true })
  const rows = (rowsRaw ?? []) as CrossRow[]

  // Подписываем URL пачкой (bucket private).
  const paths = rows.map((r) => r.storage_path).filter(Boolean)
  const urlByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('student-cross-photos')
      .createSignedUrls(paths, 60 * 60)
    for (const item of (signed ?? []) as Array<{ path?: string; signedUrl?: string }>) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl)
    }
  }

  // Метаданные блоков (order_num, title) для группировки/подписи.
  const { data: blocksRaw } = await supabase
    .from('blocks')
    .select('id, order_num, title_ru')
    .gt('order_num', 0)
    .order('order_num', { ascending: true })
  const blockMeta = new Map<number, { orderNum: number; title: string }>()
  for (const b of (blocksRaw ?? []) as { id: number; order_num: number; title_ru: string }[]) {
    blockMeta.set(b.id, { orderNum: b.order_num, title: b.title_ru })
  }

  const byBlock = new Map<number, PanelCrossDay[]>()
  for (const r of rows) {
    const list = byBlock.get(r.block_id) ?? []
    list.push({
      date: r.submitted_date,
      url: urlByPath.get(r.storage_path) ?? null,
      virtual: r.submitted_date.startsWith('2000-'),
    })
    byBlock.set(r.block_id, list)
  }

  const blocks: PanelCrossBlock[] = [...byBlock.entries()]
    .map(([blockId, days]) => ({
      blockId,
      orderNum: blockMeta.get(blockId)?.orderNum ?? blockId,
      title: blockMeta.get(blockId)?.title ?? `Блок ${blockId}`,
      days,
    }))
    .sort((a, b) => a.orderNum - b.orderNum)

  return NextResponse.json({ ok: true, blocks })
}
