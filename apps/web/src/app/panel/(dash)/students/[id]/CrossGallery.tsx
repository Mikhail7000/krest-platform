'use client'

import { useEffect, useState } from 'react'
import type { PanelCrossBlock } from '@/app/api/panel/student/[id]/crosses/route'

function fmt(date: string, virtual: boolean): string {
  if (virtual) return 'тест'
  const [y, m, d] = date.split('-')
  return d && m ? `${d}.${m}.${y}` : date
}

/**
 * Галерея загруженных фото крестов ученика по дням (для админа/куратора в панели).
 * Миниатюры по блокам, клик → крупный просмотр. Видимость уже проверена на сервере.
 */
export function CrossGallery({ id }: { id: string }) {
  const [blocks, setBlocks] = useState<PanelCrossBlock[] | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

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

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 28 }}>
        Фото крестов по дням {total > 0 ? `(${total})` : ''}
      </div>
      {total === 0 ? (
        <div className="panel-empty">Фотографий пока нет</div>
      ) : (
        blocks.map((b) => (
          <div key={b.blockId} style={{ marginBottom: 18 }}>
            <div className="panel-muted" style={{ fontWeight: 600, marginBottom: 8 }}>
              Блок {b.orderNum} · {b.title}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {b.days.map((day, i) => (
                <button
                  key={`${b.blockId}-${i}`}
                  type="button"
                  onClick={() => day.url && setZoom(day.url)}
                  style={{
                    padding: 0,
                    border: '1px solid var(--pl-border, rgba(0,0,0,0.1))',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                    cursor: day.url ? 'pointer' : 'default',
                    width: 92,
                  }}
                  title={fmt(day.date, day.virtual)}
                >
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt="Фото креста"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, background: '#fff' }}
          />
        </div>
      )}
    </>
  )
}
