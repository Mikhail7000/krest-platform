import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExamClient } from './ExamClient'
import '../../quiz/[blockId]/quiz.css'
import './exam.css'

export const dynamic = 'force-dynamic'

const EXAM_META = {
  mid: {
    eyebrow: 'Промежуточный экзамен',
    title: 'Промежуточный экзамен',
    subtitle: 'По блокам 1–5 «Состояние неверующего»',
    passReq: 'Минимум 80% правильных ответов',
    backHref: '/m/dashboard',
  },
  final: {
    eyebrow: 'Финальный экзамен',
    title: 'Финальный экзамен',
    subtitle: 'По всему курсу «КРЕСТ»',
    passReq: 'Минимум 85% правильных ответов',
    backHref: '/m/dashboard',
  },
} as const

type ExamType = keyof typeof EXAM_META

export default async function ExamPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params

  if (type !== 'mid' && type !== 'final') notFound()

  const examType = type as ExamType
  const meta = EXAM_META[examType]

  return (
    <div className="miniapp-container exam-page">
      <Link href={meta.backHref} className="stage-back">
        ← К списку блоков
      </Link>

      <header className="exam-header">
        <p className="exam-header__eyebrow">{meta.eyebrow}</p>
        <h1 className="exam-header__title">{meta.title}</h1>
        <p className="exam-header__subtitle">{meta.subtitle}</p>
      </header>

      <ExamClient examType={examType} />
    </div>
  )
}
