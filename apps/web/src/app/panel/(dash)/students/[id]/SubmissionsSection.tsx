'use client'

import { useEffect, useState } from 'react'
import type { PanelSubmissionsBlock } from '@/app/api/panel/student/[id]/submissions/route'

function fmtD(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-')
  return d && m ? `${d}.${m}.${y}` : date
}

const EMO_KIND: Record<string, string> = { text: '📝', voice: '🎙️', video_note: '📹' }

/**
 * Сдачи ученика для куратора: аудио-пересказы (плеер + оценка ИИ + транскрипт),
 * местописания (по стихам, с медиа) и эмоции/отчёты. Данные — по блокам, лениво
 * (грузим при раскрытии секции, ссылки на файлы подписанные).
 */
export function SubmissionsSection({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [blocks, setBlocks] = useState<PanelSubmissionsBlock[] | null>(null)

  useEffect(() => {
    if (!open || blocks !== null) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/panel/student/${id}/submissions`)
        const json = await res.json()
        if (alive) setBlocks(res.ok && json.ok ? (json.blocks as PanelSubmissionsBlock[]) : [])
      } catch {
        if (alive) setBlocks([])
      }
    })()
    return () => {
      alive = false
    }
  }, [open, blocks, id])

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>Сдачи: пересказы · местописания · эмоции</span>
        <button type="button" className="panel-btn" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => setOpen((v) => !v)}>
          {open ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      {open && blocks === null && <div className="panel-empty">Загрузка…</div>}
      {open && blocks !== null && blocks.length === 0 && <div className="panel-empty">Сдач пока нет</div>}
      {open &&
        blocks?.map((b) => (
          <div key={b.blockId} className="panel-card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Блок {b.orderNum} · {b.title}
            </div>

            {b.recitations.length > 0 && (
              <>
                <div className="panel-muted" style={{ fontWeight: 600, marginBottom: 6 }}>🎙️ Пересказы ({b.recitations.length})</div>
                {b.recitations.map((r, i) => (
                  <div key={i} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{fmtD(r.date)}</span>
                      <span className={r.passed ? 'panel-badge panel-badge--ok' : 'panel-badge panel-badge--err'}>
                        {r.passed ? 'зачтён' : 'не зачтён'}
                      </span>
                      {r.score != null && <span className="panel-muted">оценка ИИ: {r.score}</span>}
                      {r.duration != null && <span className="panel-muted">{r.duration}с</span>}
                    </div>
                    {r.url && <audio controls preload="none" src={r.url} style={{ width: '100%', maxWidth: 420, marginTop: 6, height: 36 }} />}
                    {r.comment && <div className="panel-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>ИИ: {r.comment}</div>}
                    {r.transcript && (
                      <details style={{ marginTop: 4 }}>
                        <summary className="panel-muted" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>Транскрипт</summary>
                        <p style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.transcript}</p>
                      </details>
                    )}
                  </div>
                ))}
              </>
            )}

            {b.locations.length > 0 && (
              <>
                <div className="panel-muted" style={{ fontWeight: 600, margin: '10px 0 6px' }}>📍 Местописания ({b.locations.length})</div>
                {b.locations.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{fmtD(l.date)}</span>
                    <span>{l.name}</span>
                    <span className="panel-muted">{l.medium === 'video_note' ? '📹 кружок' : '🎙️ аудио'}</span>
                    <span className={l.passed ? 'panel-badge panel-badge--ok' : 'panel-badge panel-badge--err'}>
                      {l.passed ? 'сдано' : 'не сдано'}
                    </span>
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem' }}>
                        открыть
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}

            {b.emotions.length > 0 && (
              <>
                <div className="panel-muted" style={{ fontWeight: 600, margin: '10px 0 6px' }}>💬 Эмоции / отчёты ({b.emotions.length})</div>
                {b.emotions.map((e, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{fmtD(e.createdAt)}</span>{' '}
                    <span>{EMO_KIND[e.kind] ?? ''}</span>{' '}
                    {e.text && <span style={{ whiteSpace: 'pre-wrap' }}>{e.text}</span>}
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: '0.8rem' }}>
                        медиа
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
    </>
  )
}
