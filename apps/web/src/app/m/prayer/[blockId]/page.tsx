import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { PrayerClient } from './PrayerClient'
import './prayer.css'

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

export default async function PrayerPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  return (
    <div className="miniapp-container prayer-page">
      <Link href={`/m/lesson/${id}`} className="stage-back">← К уроку</Link>

      <header className="prayer-header">
        <p className="prayer-header__eyebrow">Блок {block.order_num ?? id} — Молитва по кресту</p>
        <p className="prayer-header__motto">
          Очень важно молиться каждый день — проси, чтобы Отец Небесный открыл тебе Дух Креста.
        </p>
      </header>

      <PrayerClient blockId={id} />

      <Link href={`/m/lesson/${id}`} className="prayer-back prayer-back--bottom">← К уроку</Link>
    </div>
  )
}
