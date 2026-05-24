import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { EmotionsClient } from './EmotionsClient'
import './emotions.css'

export const dynamic = 'force-dynamic'

const adminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

async function loadBlock(blockId: number) {
  const supabase = adminClient()
  const { data: block } = await supabase
    .from('blocks')
    .select('id, title_ru, order_num')
    .eq('id', blockId)
    .maybeSingle()
  return block ?? null
}

export default async function EmotionsPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  return (
    <div className="miniapp-container emotions-page">
      <Link href={`/m/lesson/${id}`} className="emotions-back">← К уроку</Link>

      <header className="emotions-header">
        <p className="emotions-header__eyebrow">Блок {block.order_num ?? id} — Эмоции и свидетельства</p>
        <h1 className="emotions-header__title">Поделись опытом</h1>
        <p className="emotions-header__desc">
          Зафиксируй, что прожил после проповедования — текстом, голосом или видеокружком.
        </p>
        <p className="emotions-header__optional">Необязательно — не влияет на прохождение блока.</p>
      </header>

      <EmotionsClient blockId={id} />

      <Link href={`/m/lesson/${id}`} className="emotions-back emotions-back--bottom">← К уроку</Link>
    </div>
  )
}
