'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Database } from '../../../../../../packages/supabase/src/types'
import { IconGraduation, IconStar, IconTrophy } from '@/app/m/_components/icons'
import {
  isBlockUnlockedByCompletion,
  lockedBlockHint,
} from '@/lib/access/block-completion'
import { useSwrCache } from '@/lib/m/swr-cache'
import type { DashboardData } from './loadDashboard'
import { PrepBlockCard } from './PrepBlockCard'
import { AiTrainerEntry } from './AiTrainerEntry'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

type StatusVariant = 'done' | 'active' | 'locked' | 'default'

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

// ── Статус блока (накопительная модель) ──────────────────────────────────────
// «Сдан» = ≥7 закрытых дней (канон, как passed_blocks_all) ИЛИ явный block_passed_at.
// На активном блоке показываем прогресс «N/7 дней» прямо на карточке.
function blockStatusVariant(
  block: Block,
  progress: BlockProgress | undefined,
  unlocked: boolean,
  closedDays: number,
): { label: string; variant: StatusVariant } {
  if (progress?.block_passed_at || closedDays >= 7) return { label: 'Сдан', variant: 'done' }
  if (progress?.status === 'in_progress') return { label: 'Идёт сдача', variant: 'active' }
  if (unlocked) {
    return closedDays > 0
      ? { label: `День ${Math.min(closedDays + 1, 7)} из 7 · закрыто ${closedDays}`, variant: 'default' }
      : { label: 'Доступен', variant: 'default' }
  }
  return { label: 'Заблокирован', variant: 'locked' }
}

// ── Подсказка о том, что нужно сдать в предыдущем блоке ─────────────────────
function LockedHint({
  blocks,
  blockId,
  completionByBlockId,
}: {
  blocks: Block[]
  blockId: number
  completionByBlockId: DashboardData['completionByBlockId']
}) {
  const hint = lockedBlockHint(blocks, blockId, completionByBlockId)
  if (!hint) return null
  return <span className="db-block-card__unlock-hint">{hint}</span>
}

// ── Карточка блока ────────────────────────────────────────────────────────────
interface BlockCardProps {
  block: Block
  progress: BlockProgress | undefined
  blocks: Block[]
  canSkip: boolean
  completionByBlockId: DashboardData['completionByBlockId']
}

function BlockCard({ block, progress, blocks, canSkip, completionByBlockId }: BlockCardProps) {
  const unlocked = isBlockUnlockedByCompletion(blocks, block.id, canSkip, completionByBlockId)
  const closedDays = completionByBlockId[block.id]?.closedDays ?? 0
  const { label, variant } = blockStatusVariant(block, progress, unlocked, closedDays)
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
          <LockedHint
            blocks={blocks}
            blockId={block.id}
            completionByBlockId={completionByBlockId}
          />
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

// ── Карточка экзамена ─────────────────────────────────────────────────────────
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

// ── Главный компонент ─────────────────────────────────────────────────────────
interface BlockListProps {
  /** Callback при загрузке данных — поднимает прогресс курса в DashboardShell */
  onProgress?: (pct: number, currentBlockId: number | null) => void
}

function fetchDashboard(): Promise<DashboardData | null> {
  return fetch('/api/m/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: getInitData() }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: DashboardData | null) => d ?? null)
    .catch(() => null)
}

export function BlockList({ onProgress }: BlockListProps) {
  const [group, setGroup] = useState<'g1' | 'g2'>('g1')
  // Автовыбор вкладки «Блоки 6-10» для второй половины курса — ровно один раз,
  // чтобы не перещёлкивать выбор пользователя при фоновом рефетче.
  const autoTabbed = useRef(false)
  // SWR-кэш: возврат на дашборд открывается мгновенно, фоном обновляется.
  const { data, loading } = useSwrCache<DashboardData>('m:dashboard', fetchDashboard, 120_000)

  // Поднимаем прогресс курса в DashboardShell. Хук ОБЯЗАН быть ДО раннего
  // return ниже — иначе порядок хуков меняется между рендерами и страница
  // падает («Rendered more hooks than previous render»).
  useEffect(() => {
    if (!data) return
    const main = data.blocks.filter((b) => (b.order_num ?? 0) >= 1)
    const total = main.length || 10
    // «Сдан» = ≥7 закрытых дней (канон, как passed_blocks_all). Раньше опирались на
    // block_passed_at, который в дневной модели НИКТО не пишет → «текущий блок»
    // навсегда застревал на Блоке 1 даже после его завершения, а TodayCard показывал
    // ложное «День закрыт» при 0 сданных практик нового блока.
    const closedOf = (id: number) => data.completionByBlockId[id]?.closedDays ?? 0
    const passed = main.filter((b) => closedOf(b.id) >= 7).length
    const curBlock = main.find((b) => closedOf(b.id) < 7) ?? null
    const cur = curBlock?.id ?? null
    if (!autoTabbed.current && (curBlock?.order_num ?? 0) >= 6) {
      setGroup('g2')
      autoTabbed.current = true
    }
    // % курса = сданные блоки + прогресс ТЕКУЩЕГО блока (закрытыеДни/7, капнуто на 1).
    const curDays = cur != null ? closedOf(cur) : 0
    const pct = Math.round(((passed + Math.min(curDays / 7, 1)) / total) * 100)
    onProgress?.(pct, cur)
    // onProgress стабилен (сеттер useState) — не включаем в deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (loading || !data) {
    return (
      <div className="miniapp-container" style={{ paddingTop: 0 }}>
        <div className="db-skeleton db-skeleton--prep" aria-hidden />
        <div className="db-skeleton-chips" aria-hidden>
          <span className="db-skeleton db-skeleton--chip" />
          <span className="db-skeleton db-skeleton--chip" />
        </div>
        <div className="db-section">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="db-skeleton db-skeleton--block" aria-hidden />
          ))}
        </div>
      </div>
    )
  }

  const {
    blocks, progressByBlockId, completionByBlockId, canSkip,
    midExamPassed, finalExamPassed, courseDone,
  } = data

  // Блок 0 — вводный, вынесен отдельно
  const prepBlock = blocks.find((b) => (b.order_num ?? 1) === 0)

  // Только основные блоки (order_num 1..10)
  const mainBlocks = blocks.filter((b) => (b.order_num ?? 0) >= 1)
  // Текущий блок для входа в ИИ-тренажёр (первый несданный, иначе первый/вводный)
  const aiBlock =
    mainBlocks.find((b) => !progressByBlockId[b.id]?.block_passed_at) ?? mainBlocks[0] ?? prepBlock
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prepBlockAny = prepBlock as any

  return (
    <div className="miniapp-container" style={{ paddingTop: 0 }}>
      {aiBlock && <AiTrainerEntry blockId={aiBlock.id} />}

      {prepBlock && (
        <PrepBlockCard
          blockId={prepBlock.id}
          title={prepBlockAny?.title_ru ?? 'Подготовка к обучению'}
          subtitle={prepBlockAny?.subtitle_ru ?? null}
          color={prepBlockAny?.color ?? '#7C5CFF'}
        />
      )}

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
              blocks={blocks}
              canSkip={canSkip}
              completionByBlockId={completionByBlockId}
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
              blocks={blocks}
              canSkip={canSkip}
              completionByBlockId={completionByBlockId}
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
              <span className="db-cert-link__text">Курс Креста сдан — к сдаче наставнику</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
