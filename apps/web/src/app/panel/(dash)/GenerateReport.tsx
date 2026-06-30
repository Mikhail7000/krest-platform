'use client'

import { useState } from 'react'
import type { PanelStats } from '@/app/api/panel/stats/stats-data'

/**
 * Кнопка «Сформировать отчёт» — одним кликом собирает текстовый отчёт по всей
 * статистике (как /stats в боте) с возможностью скопировать или скачать .txt.
 */
function buildReport(s: PanelStats): string {
  const now = new Date()
  const stamp = now.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const L: string[] = []
  L.push('КРЕСТ — Статистика платформы')
  L.push(`Сформировано: ${stamp}`)
  L.push('')
  L.push('━━ ОБЩЕЕ ━━')
  L.push(`Учеников: ${s.totals.students}`)
  L.push(`Кураторов: ${s.totals.curators}`)
  L.push(`Лидеров городов: ${s.totals.cityLeaders}`)
  L.push(`Администраторов: ${s.totals.admins}`)
  L.push(`Сдали курс (10 блоков): ${s.totals.passedCourse}`)
  L.push(`Активных городов: ${s.totals.cities}`)

  if (s.byCountry.length) {
    L.push('')
    L.push('━━ ПО СТРАНАМ ━━')
    for (const c of s.byCountry) L.push(`${c.country} — ${c.count}`)
  }
  if (s.byCity.length) {
    L.push('')
    L.push('━━ ПО ГОРОДАМ ━━')
    for (const c of s.byCity) L.push(`${c.city} (${c.country}) — ${c.count}`)
  }

  L.push('')
  L.push('━━ РАСПРЕДЕЛЕНИЕ ПО БЛОКАМ ━━')
  for (const p of s.progress) L.push(`Блок ${p.block}: ${p.count}`)

  if (s.streaks.length) {
    L.push('')
    L.push('━━ ТОП ПО НЕПРЕРЫВНЫМ ДНЯМ ━━')
    s.streaks.forEach((r, i) => {
      const tg = r.telegram ? ` ${r.telegram}` : ''
      L.push(`${i + 1}. ${r.name}${tg} (${r.city}) — серия ${r.maxStreak} дн., всего ${r.totalDays}`)
    })
  }

  if (s.stuck.length) {
    L.push('')
    L.push('━━ ЗАСТРЯЛИ (нет активности > 3 дней) ━━')
    for (const r of s.stuck) {
      const tg = r.telegram ? ` ${r.telegram}` : ''
      const when = r.lastDayAgo === null ? 'ни разу не закрывал' : `${r.lastDayAgo} дн. назад`
      L.push(`${r.name}${tg} (${r.city}) — блок ${r.currentBlock}, ${when}`)
    }
  }

  return L.join('\n')
}

export function GenerateReport({ stats }: { stats: PanelStats }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const report = open ? buildReport(stats) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard недоступен — пользователь скопирует вручную */
    }
  }

  const download = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `krest-stats-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button type="button" className="panel-btn panel-btn--primary" onClick={() => setOpen(true)}>
        📊 Сформировать отчёт
      </button>

      {open && (
        <div className="panel-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="panel-card" style={{ width: '100%', maxWidth: 640, maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="panel-section-title" style={{ margin: 0 }}>Отчёт по статистике</span>
              <button type="button" className="panel-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
            <textarea
              className="panel-input"
              readOnly
              value={report}
              style={{ flex: 1, minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem', whiteSpace: 'pre', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="panel-btn panel-btn--primary" onClick={copy}>
                {copied ? '✓ Скопировано' : 'Скопировать'}
              </button>
              <button type="button" className="panel-btn" onClick={download}>Скачать .txt</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
