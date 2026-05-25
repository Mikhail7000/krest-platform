'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { Database } from '../../../../../../packages/supabase/src/types'
import { IconGraduation, IconStar, IconTrophy } from '@/app/m/_components/icons'
import type { DashboardData } from './loadDashboard'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

type StatusVariant = 'done' | 'active' | 'locked' | 'default'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

function blockStatus(
  block: Block,
  progress: BlockProgress | undefined,
  canSkip: boolean,
  prevGroupUnlocked: boolean,
): { label: string; variant: StatusVariant } {
  if (progress?.block_passed_at) return { label: 'Сдан', variant: 'done' }
  if (progress?.status === 'in_progress') return { label: 'Идёт сдача', variant: 'active' }
  const num = block.order_num ?? 0
  const accessible = progress?.block_unlocked_at || canSkip || num === 1 || prevGroupUnlocked
  if (accessible) return { label: 'Доступен', variant: 'default' }
  return { label: 'Заблокирован', variant: 'locked' }
}

interface BlockCardProps {
  block: Block
  progress: BlockProgress | undefined
  canSkip: boolean
  prevGroupUnlocked: boolean
}

function BlockCard({ block, progress, canSkip, prevGroupUnlocked }: BlockCardProps) {
  const { label, variant } = blockStatus(block, progress, canSkip, prevGroupUnlocked)
  const isDone = variant === 'done'
  const isLocked = variant === 'locked'

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

  return (
    <Link href={`/m/lesson/${block.id}`} className={cardClass}>
      <span className="db-block-card__num">{block.order_num ?? block.id}</span>
      <span className="db-block-card__body">
        <span className="db-block-card__title">
          {block.title_ru ?? `Блок ${block.order_num ?? block.id}`}
        </span>
        <span className={statusClass}>{isDone ? `${label} ✓` : label}</span>
      </span>
      {!isLocked && <span className="db-block-card__arrow">›</span>}
    </Link>
  )
}

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

export function BlockList() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

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
    blocks, progressByBlockId, canSkip,
    midExamPassed, finalExamPassed, courseDone,
  } = data

  const blocks1to5 = blocks.filter((b) => (b.order_num ?? 0) <= 5)
  const blocks6to10 = blocks.filter((b) => (b.order_num ?? 0) >= 6)

  const allBlock5Passed = canSkip || blocks1to5.every(
    (b) => !!progressByBlockId[b.id]?.block_passed_at,
  )
  const allBlock10Passed = canSkip || blocks6to10.every(
    (b) => !!progressByBlockId[b.id]?.block_passed_at,
  )

  const midExamActive = allBlock5Passed || canSkip
  const finalExamActive = (midExamPassed && allBlock10Passed) || canSkip

  return (
    <div className="miniapp-container" style={{ paddingTop: 0 }}>
      <div className="db-section">
        <p className="db-section__title">Курс КРЕСТ — Блоки 1–5</p>
        {blocks1to5.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            progress={progressByBlockId[block.id]}
            canSkip={canSkip}
            prevGroupUnlocked={false}
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

      <div className="db-section">
        <p className="db-section__title">Блоки 6–10</p>
        {blocks6to10.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            progress={progressByBlockId[block.id]}
            canSkip={canSkip}
            prevGroupUnlocked={midExamPassed}
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
    </div>
  )
}
