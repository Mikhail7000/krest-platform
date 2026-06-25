import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { crossTaskFor } from '@/lib/cross/rubrics'
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
  const task = crossTaskFor(orderNum)

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
          Каждый день переписывай от руки «крест блока» — {block.title_ru} — и загружай фото.
        </p>

        {task && (
          <div className="cp-task-card__rubric">
            <p className="cp-task-card__rubric-label">{task.essence}</p>
            <ul className="cp-task-card__rubric-list">
              {task.points.map((point, i) => (
                <li key={i} className="cp-task-card__rubric-item">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CrossPhotoClient blockId={id} />
    </div>
  )
}
