import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { LocationsClient } from './LocationsClient'
import './locations.css'

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
    .select('id, title_ru, subtitle_ru, order_num')
    .eq('id', blockId)
    .maybeSingle()
  return block ?? null
}

export default async function LocationsPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  return (
    <div className="miniapp-container locations-page">
      <Link href={`/m/lesson/${id}`} className="locations-back">← К уроку</Link>

      <header className="locations-header">
        <p className="locations-header__eyebrow">Блок {block.order_num ?? id} — Местописания</p>
        <h1 className="locations-header__title">{block.title_ru ?? `Блок ${id}`}</h1>
        <p className="locations-header__subtitle">
          Произнеси каждый стих вслух — сначала с открытой Библией (аудио), потом наизусть (видеокружок).
        </p>
      </header>

      <LocationsClient blockId={id} />

      <Link href={`/m/lesson/${id}`} className="locations-back locations-back--bottom">← К уроку</Link>
    </div>
  )
}
