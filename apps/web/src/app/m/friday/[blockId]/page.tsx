import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { FridayClient } from './FridayClient'
import './friday.css'

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

export default async function FridayPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  return (
    <div className="miniapp-container friday-page">
      <Link href={`/m/lesson/${id}`} className="stage-back">← К уроку</Link>

      <header className="friday-header">
        <p className="friday-header__eyebrow">Блок {block.order_num ?? id} — Эпоха пятницы</p>
        <h1 className="friday-header__title">Практика</h1>
        <p className="friday-header__desc">
          Выйди на места действия и передай «Малый крест» другим людям. Затем поделись впечатлениями —
          как прошло, что почувствовал, что ответили люди.
        </p>
      </header>

      <FridayClient blockId={id} />

      <Link href={`/m/lesson/${id}`} className="friday-back friday-back--bottom">← К уроку</Link>
    </div>
  )
}
