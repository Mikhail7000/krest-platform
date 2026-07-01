'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { PanelStudentDetail } from '@/app/api/panel/student/[id]/route'
import { Avatar, fmtDate, fmtDateTime } from '../studentBits'
import { TgLink } from '../../TgLink'
import { CrossGallery } from './CrossGallery'
import { SubmissionsSection } from './SubmissionsSection'

const REQUIRED_DAYS = 7

export function StudentDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<PanelStudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/panel/student/${id}`)
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка загрузки')
        if (alive) setData(json.student as PanelStudentDetail)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  if (loading) return <div className="panel-empty">Загрузка…</div>
  if (error || !data) return (
    <>
      <Link href="/panel/students" className="panel-btn" style={{ marginBottom: 16 }}>← К списку</Link>
      <div className="panel-empty">{error || 'Ученик не найден'}</div>
    </>
  )

  const s = data
  return (
    <>
      <Link href="/panel/students" className="panel-btn" style={{ marginBottom: 18 }}>← К списку учеников</Link>

      {/* Карточка ученика */}
      <div className="panel-card" style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <Avatar url={s.avatarUrl} name={s.fullName} size={72} />
        <div style={{ minWidth: 0 }}>
          <h1 className="panel-page__title" style={{ marginBottom: 2 }}>{s.fullName || 'Без имени'}</h1>
          <div className="panel-muted">
            <TgLink nick={s.contact} />
            {s.contact && (s.cityName || s.curatorName) && <span> · </span>}
            {s.cityName && <span>{s.cityName}</span>}
          </div>
          <div className="panel-muted" style={{ marginTop: 4 }}>
            Куратор: {s.curatorName || 'не назначен'} · В системе с {fmtDate(s.createdAt)}
          </div>
        </div>
      </div>

      {/* Сводка */}
      <div className="panel-grid">
        <div className="panel-stat">
          <div className="panel-stat__label">Сдано блоков</div>
          <div className="panel-stat__value">{s.passedBlocks} / 10</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Текущий блок</div>
          <div className="panel-stat__value">Блок {s.currentBlock}</div>
          <div className="panel-stat__hint">{s.blocks.find((b) => b.orderNum === s.currentBlock)?.title ?? ''}</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Старт курса</div>
          <div className="panel-stat__value" style={{ fontSize: '1.3rem' }}>{fmtDate(s.courseStartedAt)}</div>
          <div className="panel-stat__hint">Активность: {fmtDateTime(s.lastActivity)}</div>
        </div>
      </div>

      {/* Прогресс по блокам */}
      <div className="panel-section-title">Прогресс по блокам</div>
      <div className="panel-table-wrap">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Блок</th>
              <th>Закрыто дней</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {s.blocks.map((b) => {
              const pct = Math.min(100, Math.round((b.closedDays / REQUIRED_DAYS) * 100))
              return (
                <tr key={b.blockId}>
                  <td>
                    <span style={{ fontWeight: 600 }}>Блок {b.orderNum}</span>
                    <span className="panel-muted" style={{ display: 'block', fontSize: '0.8rem' }}>{b.title}</span>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 600, minWidth: 34 }}>{b.closedDays}/{REQUIRED_DAYS}</span>
                      <span className="panel-bar" style={{ flex: 1, minWidth: 60 }}>
                        <span className="panel-bar__fill" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    {b.done ? (
                      <span className="panel-badge panel-badge--ok">Сдан</span>
                    ) : b.closedDays > 0 ? (
                      <span className="panel-badge panel-badge--warn">В работе</span>
                    ) : (
                      <span className="panel-badge">Не начат</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Галерея загруженных фото крестов по дням (с AI-вердиктами) */}
      <CrossGallery id={id} />

      {/* Медиа-сдачи: пересказы, местописания, эмоции */}
      <SubmissionsSection id={id} />
    </>
  )
}
