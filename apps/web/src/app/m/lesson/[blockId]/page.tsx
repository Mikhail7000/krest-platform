import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { LessonVideos } from '@/components/lesson/LessonVideos'
import { BlockProgressBanner } from './BlockProgressBanner'
import { Stage4Nav } from './Stage4Nav'
import './lesson.css'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60
const STORAGE_BUCKET = 'block-resources'

type BlockResource = Database['public']['Tables']['block_resources']['Row']
type Block = Database['public']['Tables']['blocks']['Row']

const adminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

async function loadLesson(blockId: number) {
  const supabase = adminClient()
  const [{ data: block }, { data: resources }] = await Promise.all([
    supabase.from('blocks').select('*').eq('id', blockId).maybeSingle(),
    supabase.from('block_resources').select('*').eq('block_id', blockId).order('order_num'),
  ])
  if (!block || !resources) return null

  const signedByPath: Record<string, string> = {}
  const pathsToSign = resources.map((r) => r.storage_path).filter((p): p is string => !!p)
  if (pathsToSign.length > 0) {
    const { data } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS)
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) signedByPath[item.path] = item.signedUrl
    }
  }
  return { block, resources, signedByPath }
}

function AudioCard({ resource, url }: { resource: BlockResource; url: string | undefined }) {
  return (
    <section className="lesson-card">
      <h2 className="lesson-card__title">{resource.title_ru}</h2>
      {url ? <audio controls preload="none" src={url} className="lesson-audio" /> : <p className="lesson-card__desc">Файл недоступен</p>}
    </section>
  )
}

function PdfCard({ resource, url }: { resource: BlockResource; url: string | undefined }) {
  return (
    <section className="lesson-card lesson-card--row">
      <span className="lesson-card__title lesson-card__title--inline">{resource.title_ru}</span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" download className="lesson-button">
          Скачать PDF
        </a>
      ) : (
        <span className="lesson-card__desc">недоступно</span>
      )}
    </section>
  )
}

function GuideCard({ resource }: { resource: BlockResource }) {
  return (
    <section className="lesson-card lesson-card--guide">
      <h2 className="lesson-card__title">
        {resource.title_ru}
        {resource.is_required && <span className="lesson-badge">обязательно</span>}
      </h2>
      {resource.description_ru && <p className="lesson-card__desc">{resource.description_ru}</p>}
      {resource.transcript_md && (
        <details className="lesson-details">
          <summary>Развернуть текст гайда</summary>
          <div className="lesson-summary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resource.transcript_md}</ReactMarkdown>
          </div>
        </details>
      )}
    </section>
  )
}

export default async function LessonPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const data = await loadLesson(id)
  if (!data) notFound()
  const { block, resources, signedByPath } = data

  const videoResources = resources
    .filter((r) => r.resource_type === 'main_video' || r.resource_type === 'additional_video')
    .filter((r): r is BlockResource & { kinescope_id: string } => !!r.kinescope_id)
    .map((r) => ({
      id: r.id,
      kinescope_id: r.kinescope_id,
      title_ru: r.title_ru,
      description_ru: r.description_ru,
      is_required: r.is_required,
      summary_md: r.summary_md,
    }))
  const audios = resources.filter((r) => r.resource_type === 'audio_prayer')
  const pdfs = resources.filter((r) => r.resource_type === 'pdf_prayer')
  const guides = resources.filter((r) => r.resource_type === 'guide_pdf')

  return (
    <div className="miniapp-container lesson-page">
      <Link href="/m/dashboard" className="lesson-back">← К списку блоков</Link>
      <header className="lesson-header">
        <p className="lesson-header__eyebrow">Блок {block.order_num ?? blockId}</p>
        <h1 className="lesson-header__title">{block.title_ru ?? `Блок ${blockId}`}</h1>
        {block.subtitle_ru && <p className="lesson-header__subtitle">{block.subtitle_ru}</p>}
      </header>

      <BlockProgressBanner blockId={id} />

      <LessonVideos videos={videoResources} />

      {audios.length > 0 && (
        <div className="lesson-section">
          <h3 className="lesson-section__title">Аудио-молитвы</h3>
          {audios.map((r) => (
            <AudioCard key={r.id} resource={r} url={r.storage_path ? signedByPath[r.storage_path] : undefined} />
          ))}
        </div>
      )}

      {pdfs.length > 0 && (
        <div className="lesson-section">
          <h3 className="lesson-section__title">Молитва — текстовая версия</h3>
          {pdfs.map((r) => (
            <PdfCard key={r.id} resource={r} url={r.storage_path ? signedByPath[r.storage_path] : undefined} />
          ))}
        </div>
      )}

      {guides.map((r) => (
        <GuideCard key={r.id} resource={r} />
      ))}

      <Stage4Nav blockId={id} />
    </div>
  )
}
