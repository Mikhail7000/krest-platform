'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'
import { StudentRowActions, type Curator } from './StudentRowActions'

/** Мелкие презентационные хелперы списка/детали ученика (без бизнес-логики). */

const BLOCK_TITLES: Record<number, string> = {
  1: 'Малый Крест',
  2: 'Принцип Сотворения',
  3: 'Коренная Проблема',
  4: 'Состояние Мира',
  5: 'Состояние Неверующего',
  6: 'Усилие Человека',
  7: 'Обетования и Исполнение',
  8: 'Иисус Христос',
  9: 'Благословения Верующего',
  10: '5 Уверенностей',
}

/** Строка таблицы списка учеников. */
export function StudentRow({
  s,
  curators,
  isCurator = false,
  onDone,
  onError,
}: {
  s: PanelStudentRow
  curators: Curator[]
  isCurator?: boolean
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  // Имя куратора из API (s.curatorName заполнен и для куратора, и для админа).
  // Фолбэк на список (для админа) — но НЕ показываем UUID, если имени нет.
  const curatorName =
    s.curatorName ??
    (s.curatorId ? curators.find((c) => c.id === s.curatorId)?.name ?? null : null)

  return (
    <tr>
      <td>
        <Link href={`/panel/students/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
          <Avatar url={s.avatarUrl} name={s.fullName} />
          <span>
            {s.fullName || 'Без имени'}
            {s.contact && <span className="panel-muted" style={{ display: 'block', fontWeight: 400, fontSize: '0.8rem' }}>{s.contact}</span>}
          </span>
        </Link>
      </td>
      <td>{s.cityName || <span className="panel-muted">—</span>}</td>
      <td>
        {isCurator ? (
          <span className="panel-muted" style={{ fontSize: '0.85rem' }}>
            {curatorName ?? '—'}
          </span>
        ) : (
          <CuratorPicker s={s} curators={curators} onDone={onDone} onError={onError} />
        )}
      </td>
      <td><span className="panel-badge panel-badge--acc">{s.passedBlocks} / 10</span></td>
      <td>
        <span style={{ fontWeight: 600 }}>Блок {s.currentBlock}</span>
        <span className="panel-muted" style={{ display: 'block', fontSize: '0.78rem' }}>{BLOCK_TITLES[s.currentBlock] ?? ''}</span>
      </td>
      <td>{s.closedDays}</td>
      <td className="panel-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.createdAt)}</td>
      {!isCurator && (
        <td style={{ textAlign: 'right' }}>
          <StudentRowActions student={s} curators={curators} onDone={onDone} onError={onError} />
        </td>
      )}
    </tr>
  )
}

/** Прямой выбор куратора в строке: привязать / сменить / отвязать одним кликом. */
function CuratorPicker({
  s,
  curators,
  onDone,
  onError,
}: {
  s: PanelStudentRow
  curators: Curator[]
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [val, setVal] = useState(s.curatorId ?? '')
  const [busy, setBusy] = useState(false)

  const change = async (next: string) => {
    const prev = val
    setVal(next)
    setBusy(true)
    try {
      const res = await fetch('/api/panel/actions/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: s.id, curatorId: next || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка')
      onDone(next ? 'Куратор назначен' : 'Куратор отвязан')
    } catch (e) {
      setVal(prev) // откат
      onError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <select
      className="panel-select"
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      style={{ minWidth: 130, maxWidth: 180, fontSize: '0.85rem', padding: '6px 8px' }}
    >
      <option value="">— нет —</option>
      {curators.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name || 'Без имени'}
        </option>
      ))}
    </select>
  )
}

export function Avatar({ url, name, size = 34 }: { url: string | null; name: string | null; size?: number }) {
  const letter = (name?.trim()?.[0] ?? '?').toUpperCase()
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#efeaff',
        color: '#7c5cf0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size > 50 ? '1.8rem' : '1rem',
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
  )
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return 'нет данных'
  try {
    const d = new Date(iso)
    return (
      d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
      ', ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return 'нет данных'
  }
}
