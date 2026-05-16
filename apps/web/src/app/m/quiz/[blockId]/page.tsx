import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '../../../../../../../packages/supabase/src/types'
import { QuizClient } from './QuizClient'
import './quiz.css'

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

export default async function QuizPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params
  const id = Number(blockId)
  if (!Number.isInteger(id) || id < 1) notFound()

  const block = await loadBlock(id)
  if (!block) notFound()

  const blockTitle = block.title_ru ?? `Блок ${id}`

  return (
    <div className="miniapp-container quiz-page">
      <Link href={`/m/lesson/${id}`} className="quiz-back">← К уроку</Link>

      <header className="quiz-header">
        <p className="quiz-header__eyebrow">Блок {block.order_num ?? id} — Тест</p>
        <h1 className="quiz-header__title">{blockTitle}</h1>
        <p className="quiz-header__subtitle">
          Ответьте на все вопросы. Для сдачи нужно набрать не менее 75%.
        </p>
      </header>

      <QuizClient blockId={id} blockTitle={blockTitle} />
    </div>
  )
}
