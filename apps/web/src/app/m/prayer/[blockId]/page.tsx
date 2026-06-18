import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { AudioCard, PdfCard } from '@/components/features/ResourceCards'
import { PrayerClient } from './PrayerClient'
import './prayer.css'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL = 60 * 60
const STORAGE_BUCKET = 'block-resources'

const adminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

async function loadPrayerResources(blockId: number) {
  const supabase = adminClient()

  const [{ data: block }, { data: resources }] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, title_ru, order_num')
      .eq('id', blockId)
      .maybeSingle(),
    supabase
      .from('block_resources')
      .select('id, title_ru, storage_path, resource_type, order_num')
      .eq('block_id', blockId)
      .in('resource_type', ['audio_prayer', 'pdf_prayer'])
      .order('order_num'),
  ])

  if (!block) return null

  const signedByPath: Record<string, string> = {}
  const paths = (resources ?? [])
    .map((r) => r.storage_path)
    .filter((p): p is string => !!p)

  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL)
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) signedByPath[item.path] = item.signedUrl
    }
  }

  return {
    block,
    audios: (resources ?? []).filter((r) => r.resource_type === 'audio_prayer'),
    pdfs: (resources ?? []).filter((r) => r.resource_type === 'pdf_prayer'),
    signedByPath,
  }
}

export default async function PrayerPage({
  params,
}: {
  params: Promise<{ blockId: string }>
}) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const data = await loadPrayerResources(id)
  if (!data) notFound()

  const { block, audios, pdfs, signedByPath } = data
  const hasResources = audios.length > 0 || pdfs.length > 0

  return (
    <div className="miniapp-container prayer-page">
      <Link href={`/m/lesson/${id}`} className="stage-back">
        ← К уроку
      </Link>

      <header className="prayer-header">
        <p className="prayer-header__eyebrow">
          Блок {block.order_num ?? id} — Молитва по кресту
        </p>
        <p className="prayer-header__motto">
          Очень важно молиться каждый день — проси, чтобы Отец Небесный открыл тебе Дух Креста.
        </p>
      </header>

      {hasResources && (
        <div className="prayer-resources">
          {audios.length > 0 && (
            <div className="prayer-section">
              <p className="prayer-section__label">Аудио-молитвы</p>
              {audios.map((r) => (
                <AudioCard
                  key={r.id}
                  titleRu={r.title_ru ?? 'Молитва'}
                  url={r.storage_path ? signedByPath[r.storage_path] : undefined}
                />
              ))}
            </div>
          )}

          {pdfs.length > 0 && (
            <div className="prayer-section">
              <p className="prayer-section__label">Текст молитвы</p>
              {pdfs.map((r) => (
                <PdfCard
                  key={r.id}
                  titleRu={r.title_ru ?? 'Молитва (PDF)'}
                  url={r.storage_path ? signedByPath[r.storage_path] : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <PrayerClient blockId={id} />

      <Link href={`/m/lesson/${id}`} className="prayer-back prayer-back--bottom">
        ← К уроку
      </Link>
    </div>
  )
}
