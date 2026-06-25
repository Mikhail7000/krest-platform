import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { CrossPhotoClient } from './CrossPhotoClient'
import { CrossReferencePreview } from './CrossReferencePreview'
import './cross-photo.css'

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
  if (!block) return null

  // Эталон «креста блока»: block-resources/cross-reference/{order}.jpg (private bucket).
  // Подписываем URL для показа (inline) и для скачивания (content-disposition).
  const order = block.order_num ?? blockId
  const path = `cross-reference/${order}.jpg`
  const title = block.title_ru ?? `Блок ${order}`
  const [{ data: viewSigned }, { data: dlSigned }] = await Promise.all([
    supabase.storage.from('block-resources').createSignedUrl(path, 60 * 60),
    supabase.storage.from('block-resources').createSignedUrl(path, 60 * 60, { download: `${title}.jpg` }),
  ])

  return {
    block,
    refUrl: viewSigned?.signedUrl ?? null,
    refDownloadUrl: dlSigned?.signedUrl ?? null,
  }
}

export default async function CrossPhotoPage({
  params,
}: {
  params: Promise<{ blockId: string }>
}) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const data = await loadBlock(id)
  if (!data) notFound()

  const { block, refUrl, refDownloadUrl } = data
  const orderNum = block.order_num ?? id
  const title = block.title_ru ?? `Блок ${orderNum}`

  return (
    <div className="miniapp-container cross-photo-page">
      <Link href={`/m/lesson/${id}`} className="stage-back">
        ← К уроку
      </Link>

      <header className="cp-header">
        <p className="cp-header__eyebrow">
          Блок {orderNum} — Ежедневное фото
        </p>
        <p className="cp-header__motto">Верность и постоянство — ключ к успеху</p>
      </header>

      <div className="cp-task-card">
        <p className="cp-task-card__heading">Задание</p>
        <p className="cp-task-card__instruction">
          Каждый день переписывай {title} от руки и загружай фото.
        </p>

        {refUrl && refDownloadUrl && (
          <CrossReferencePreview url={refUrl} downloadUrl={refDownloadUrl} title={title} />
        )}
      </div>

      <CrossPhotoClient blockId={id} />
    </div>
  )
}
