import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { CROSS_RUBRICS } from '@/lib/cross/rubrics'
import { CrossPhotoClient } from './CrossPhotoClient'
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
  return block ?? null
}

/** Разбивает рубрику на строки для отображения списком. */
function parseRubricLines(rubric: string): string[] {
  return rubric
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export default async function CrossPhotoPage({
  params,
}: {
  params: Promise<{ blockId: string }>
}) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  const orderNum = block.order_num ?? id
  const rubric = CROSS_RUBRICS[orderNum] ?? null
  const rubricLines = rubric ? parseRubricLines(rubric) : []

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
          Каждый день переписывай крест блока от руки и загружай фото.
        </p>

        {rubricLines.length > 0 && (
          <div className="cp-task-card__rubric">
            <p className="cp-task-card__rubric-label">Что должно быть в кресте:</p>
            <ul className="cp-task-card__rubric-list">
              {rubricLines.map((line, i) => {
                const isBullet = line.startsWith('•')
                const isTitle = !isBullet && !line.match(/^\d+\./)
                return (
                  <li
                    key={i}
                    className={
                      isTitle
                        ? 'cp-task-card__rubric-title'
                        : 'cp-task-card__rubric-item'
                    }
                  >
                    {isBullet ? line.slice(1).trim() : line}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <CrossPhotoClient blockId={id} />
    </div>
  )
}
