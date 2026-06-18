'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { Database } from '../../../../../../packages/supabase/src/types'
import { IconGraduation, IconStar, IconTrophy } from '@/app/m/_components/icons'
import { pluralDays } from '@/lib/activity/streak'
import {
  isBlockUnlocked,
  daysUntilUnlock,
  blockUnlockDate,
  formatUnlockDate,
} from '@/lib/access/weekly-unlock'
import type { DashboardData } from './loadDashboard'
import { PrepBlockCard } from './PrepBlockCard'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

type StatusVariant = 'done' | 'active' | 'locked' | 'default'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

// ── Статус блока (новая недельная модель) ───────────────────────────────────
function blockStatus(
  block: Block,
  progress: BlockProgress | undefined,
  canSkip: boolean,
  courseStartedAt: string | null,
): { label: string; variant: StatusVariant } {
  if (progress?.block_passed_at) return { label: 'Сдан', variant: 'done' }
  if (progress?.status === 'in_progress') return { label: 'Идёт сдача', variant: 'active' }

  const orderNum = block.order_num ?? 0
  const unlocked = isBlockUnlocked(courseStartedAt, orderNum, canSkip)

  if (unlocked) return { label: 'Доступен', variant: 'default' }
  return { label: 'Заблокирован', variant: 'locked' }
}

// ── Подсказка о дате открытия для заблокированного блока ────────────────────
function UnlockHint({
  courseStartedAt,
  orderNum,
}: {
  courseStartedAt: string | null
  orderNum: number
}) {
  const days = daysUntilUnlock(courseStartedAt, orderNum)
  if (days <= 0) return null

  const unlockDate = blockUnlockDate(courseStartedAt, orderNum)
  const dateStr = formatUnlockDate(unlockDate)

  return (
    <span className="db-block-card__unlock-hint">
      {dateStr
        ? `Откроется ${dateStr} · через ${days} ${pluralDays(days)}`
        : `Откроется через ${days} ${pluralDays(days)}`}
    </span>
  )
}

// ── Карточка блока ──────────────────────────────────────────────────────────
interface BlockCardProps {
  block: Block
  progress: BlockProgress | undefined
  canSkip: boolean
  courseStartedAt: string | null
}

function BlockCard({ block, progress, canSkip, courseStartedAt }: BlockCardProps) {
  const { label, variant } = blockStatus(block, progress, canSkip, courseStartedAt)
  const isDone = variant === 'done'
  const isLocked = variant === 'locked'
  const orderNum = block.order_num ?? 0

  const cardClass = [
    'db-block-card',
    isDone && 'db-block-card--done',
    isLocked && 'db-block-card--locked',
  ].filter(Boolean).join(' ')

  const statusClass = [
    'db-block-card__status',
    isDone && 'db-block-card__status--done',
    variant === 'active' && 'db-block-card__status--active',
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <span className="db-block-card__num">{orderNum || block.id}</span>
      <span className="db-block-card__body">
        <span className="db-block-card__title">
          {block.title_ru ?? `Блок ${orderNum || block.id}`}
        </span>
        <span className={statusClass}>{isDone ? `${label} ✓` : label}</span>
        {isLocked && (
          <UnlockHint courseStartedAt={courseStartedAt} orderNum={orderNum} />
        )}
      </span>
      {!isLocked && <span className="db-block-card__arrow">›</span>}
    </>
  )

  // Заблокированный блок — не кликабельный div
  if (isLocked) {
    return <div className={cardClass}>{inner}</div>
  }

  return (
    <Link href={`/m/lesson/${block.id}`} className={cardClass}>
      {inner}
    </Link>
  )
}

// ── Карточка экзамена ────────────────────────────────────────────────────────
interface ExamCardProps {
  href: string
  icon: ReactNode
  title: string
  hint: string
  active: boolean
  passed: boolean
}

function ExamCard({ href, icon, title, hint, active, passed }: ExamCardProps) {
  return (
    <Link
      href={href}
      className={`db-exam-card${!active ? ' db-exam-card--locked' : ''}`}
    >
      <span className="db-exam-card__icon">{icon}</span>
      <span className="db-exam-card__body">
        <span className="db-exam-card__title">
          {title}
          {passed && ' ✓'}
        </span>
        <span className="db-exam-card__hint">{hint}</span>
      </span>
      {active && <span className="db-exam-card__arrow">›</span>}
    </Link>
  )
}

// ── Главный компонент ────────────────────────────────────────────────────────
export function BlockList() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<'g1' | 'g2'>('g1')

  useEffect(() => {
    const initData = getInitData()
    let cancelled = false
    fetch('/api/m/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DashboardData | null) => {
        if (!cancelled && d) setData(d)
      })
      .catch(() => { /* оставим пустой дашборд */ })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading || !data) {
    return (
      <div className="miniapp-container" style={{ paddingTop: 0 }}>
        <p className="miniapp-hint">Загружаем блоки…</p>
      </div>
    )
  }

  const {
    blocks, progressByBlockId, canSkip, courseStartedAt,
    midExamPassed, finalExamPassed, courseDone,
  } = data

  // Блок 0 — вводный, вынесен отдельно (не входит в 10 основных)
  const prepBlock = blocks.find((b) => (b.order_num ?? 1) === 0)

  // Только основные блоки (order_num 1..10) — для прогресса, чипов, сетки
  const mainBlocks = blocks.filter((b) => (b.order_num ?? 0) >= 1)
  const blocks1to5 = mainBlocks.filter((b) => (b.order_num ?? 0) <= 5)
  const blocks6to10 = mainBlocks.filter((b) => (b.order_num ?? 0) >= 6)

  const allBlock5Passed = canSkip || blocks1to5.every(
    (b) => !!progressByBlockId[b.id]?.block_passed_at,
  )
  const allBlock10Passed = canSkip || blocks6to10.every(
    (b) => !!progressByBlockId[b.id]?.block_passed_at,
  )

  const midExamActive = allBlock5Passed || canSkip
  const finalExamActive = (midExamPassed && allBlock10Passed) || canSkip

  // Прогресс курса: только 10 основных блоков (70 дней = 10 × 7)
  const totalBlocks = mainBlocks.length || 10
  const passedCount = mainBlocks.filter((b) => progressByBlockId[b.id]?.block_passed_at).length
  const coursePct = Math.round((passedCount / totalBlocks) * 100)
  const totalDays = totalBlocks * 7

  // «Осталось дней» всего курса — считаем от course_started_at
  const now = new Date()
  const startMs = courseStartedAt ? new Date(courseStartedAt).getTime() : null
  const elapsedCourseDays = startMs
    ? Math.min(totalDays, Math.max(0, Math.floor((now.getTime() - startMs) / 86_400_000)))
    : passedCount * 7
  const daysLeft = Math.max(0, totalDays - elapsedCourseDays)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prepBlockAny = prepBlock as any

  return (
    <div className="miniapp-container" style={{ paddingTop: 0 }}>
      {prepBlock && (
        <PrepBlockCard
          blockId={prepBlock.id}
          title={prepBlockAny?.title_ru ?? 'Подготовка к обучению'}
          subtitle={prepBlockAny?.subtitle_ru ?? null}
          color={prepBlockAny?.color ?? '#7C5CFF'}
        />
      )}

      <div className="db-course">
        <div className="db-course__top">
          <span className="db-course__label">Прогресс курса · {coursePct}%</span>
          <span className="db-course__days">осталось {daysLeft} {pluralDays(daysLeft)}</span>
        </div>
        <div className="db-course__bar">
          <span className="db-course__fill" style={{ width: `${coursePct}%` }} />
        </div>
      </div>

      <div className="db-chips">
        <button
          type="button"
          className={`db-chip${group === 'g1' ? ' db-chip--active' : ''}`}
          onClick={() => setGroup('g1')}
        >
          Блоки 1–5
        </button>
        <button
          type="button"
          className={`db-chip${group === 'g2' ? ' db-chip--active' : ''}`}
          onClick={() => setGroup('g2')}
        >
          Блоки 6–10
        </button>
      </div>

      {group === 'g1' ? (
        <div className="db-section">
          {blocks1to5.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              progress={progressByBlockId[block.id]}
              canSkip={canSkip}
              courseStartedAt={courseStartedAt}
            />
          ))}
          <ExamCard
            href="/m/exam/mid"
            icon={<IconGraduation className="db-exam-card__icon-svg" />}
            title="Промежуточный экзамен"
            hint="По блокам 1–5"
            active={midExamActive}
            passed={midExamPassed}
          />
        </div>
      ) : (
        <div className="db-section">
          {blocks6to10.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              progress={progressByBlockId[block.id]}
              canSkip={canSkip}
              courseStartedAt={courseStartedAt}
            />
          ))}
          <ExamCard
            href="/m/exam/final"
            icon={<IconStar className="db-exam-card__icon-svg" />}
            title="Финальный экзамен"
            hint="По всему курсу"
            active={finalExamActive}
            passed={finalExamPassed}
          />
          {courseDone && (
            <Link href="/m/completed" className="db-cert-link">
              <span className="db-cert-link__icon">
                <IconTrophy className="db-cert-link__icon-svg" />
              </span>
              <span className="db-cert-link__text">Ваш сертификат — Мастер Креста</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
