'use client'

import { useEffect, useState } from 'react'
import type { PanelCrossBlock, PanelCrossDay } from '@/app/api/panel/student/[id]/crosses/route'

function fmt(date: string, virtual: boolean): string {
  if (virtual) return 'тест'
  const [y, m, d] = date.split('-')
  return d && m ? `${d}.${m}.${y}` : date
}

/**
 * Галерея загруженных фото крестов ученика по дням (для админа/куратора в панели).
 * Миниатюры по блокам с AI-вердиктом сверки с эталоном (⚠️ = не совпал), клик →
 * крупный просмотр с комментарием ИИ. Фильтр «только несовпавшие».
 * Видимость уже проверена на сервере.
 */
export function CrossGallery({ id }: { id: string }) {
  const [blocks, setBlocks] = useState<PanelCrossBlock[] | null>(null)
  const [zoom, setZoom] = useState<PanelCrossDay | null>(null)
  const [onlyMismatch, setOnlyMismatch] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/panel/student/${id}/crosses`)
        const json = await res.json()
        if (alive && res.ok && json.ok) setBlocks(json.blocks as PanelCrossBlock[])
        else if (alive) setBlocks([])
      } catch {
        if (alive) setBlocks([])
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  if (blocks === null) return null
  const total = blocks.reduce((n, b) => n + b.days.length, 0)
  const mismatches = blocks.reduce(
    (n, b) => n + b.days.filter((d) => d.aiMatched === false).length,
    0,
  )
  const shown = onlyMismatch
    ? blocks
        .map((b) => ({ ...b, days: b.days.filter((d) => d.aiMatched === false) }))
        .filter((b) => b.days.length > 0)
    : blocks

  return (
    <>
      <div
        className="panel-section-title"
        style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <span>Фото крестов по дням {total > 0 ? `(${total})` : ''}</span>
        {mismatches > 0 && (
          <button
            type="button"
            className={onlyMismatch ? 'panel-btn panel-btn--primary' : 'panel-btn'}
            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            onClick={() => setOnlyMismatch((v) => !v)}
          >
            ⚠️ Не совпали с эталоном: {mismatches}
          </button>
        )}
      </div>
      {total === 0 ? (
        <div className="panel-empty">Фотографий пока нет</div>
      ) : (
        shown.map((b) => (
          <div key={b.blockId} style={{ marginBottom: 18 }}>
            <div className="panel-muted" style={{ fontWeight: 600, marginBottom: 8 }}>
              Блок {b.orderNum} · {b.title}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {b.days.map((day, i) => (
                <button
                  key={`${b.blockId}-${i}`}
                  type="button"
                  onClick={() => day.url && setZoom(day)}
                  style={{
                    position: 'relative',
                    padding: 0,
                    border:
                      day.aiMatched === false
                        ? '2px solid #dc2626'
                        : '1px solid var(--pl-border, rgba(0,0,0,0.1))',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                    cursor: day.url ? 'pointer' : 'default',
                    width: 92,
                  }}
                  title={
                    day.aiMatched === false
                      ? `ИИ: не совпало с эталоном${day.aiFeedback ? ` — ${day.aiFeedback}` : ''}`
                      : fmt(day.date, day.virtual)
                  }
                >
                  {day.aiMatched === false && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: 3,
                        fontSize: 13,
                        lineHeight: 1,
                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
                      }}
                      aria-label="Не совпало с эталоном"
                    >
                      ⚠️
                    </span>
                  )}
                  {day.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={day.url}
                      alt={`Крест ${fmt(day.date, day.virtual)}`}
                      style={{ width: '100%', height: 92, objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: '100%', height: 92, display: 'grid', placeItems: 'center', fontSize: 11, color: '#999' }}>нет</div>
                  )}
                  <div style={{ fontSize: 11, padding: '3px 4px', textAlign: 'center', color: 'var(--pl-muted,#6b7280)' }}>
                    {fmt(day.date, day.virtual)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.url ?? ''}
            alt="Фото креста"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 8, background: '#fff' }}
          />
          {(zoom.aiMatched != null || zoom.aiFeedback) && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 560,
                background: '#fff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#111',
              }}
            >
              <strong>{zoom.aiMatched === false ? '⚠️ ИИ: не совпало с эталоном' : '✓ ИИ: крест распознан'}</strong>
              {zoom.aiFeedback && <div style={{ marginTop: 4, color: '#4b5563' }}>{zoom.aiFeedback}</div>}
            </div>
          )}
        </div>
      )}
    </>
  )
}
