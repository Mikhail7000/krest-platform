'use client'

import type { PanelStudentRow } from '@/app/api/panel/students/route'

/** Презентация активности по дням + текстовый отчёт. Квиза в приложении нет. */

export interface DayActivity {
  date: string
  opened: boolean
  cross: boolean
  prayer: boolean
  recit: boolean
  loc: boolean
  closed: boolean
}
export interface StudentDays {
  id: string
  name: string | null
  days: DayActivity[]
}

export const PRACTICES: { key: keyof DayActivity; label: string }[] = [
  { key: 'opened', label: 'Заход' },
  { key: 'cross', label: 'Крест' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'recit', label: 'Пересказ' },
  { key: 'loc', label: 'Местописания' },
]

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

/** Текстовый отчёт по выбранным ученикам (для копирования). */
export function buildReport(rows: PanelStudentRow[], detail: StudentDays[]): string {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const f = (b: boolean) => (b ? '✓' : '—')
  const out: string[] = [
    'Отчёт по активности учеников',
    `Сформирован: ${new Date().toLocaleString('ru-RU')}`,
    '',
  ]
  for (const st of detail) {
    const r = byId.get(st.id)
    const nick = r?.contact ? ` (${r.contact})` : ''
    const city = r?.cityName ? `, ${r.cityName}` : ''
    const curator = r?.curatorName ? `, куратор: ${r.curatorName}` : ', без куратора'
    out.push(`${st.name || 'Без имени'}${nick}${city}${curator}`)
    out.push(`Сдано блоков: ${r?.passedBlocks ?? 0}/10 · Закрыто дней: ${r?.closedDays ?? 0}`)
    if (st.days.length === 0) out.push('  Активности нет')
    else
      for (const d of st.days)
        out.push(
          `  ${fmtDate(d.date)}: заход ${f(d.opened)}, крест ${f(d.cross)}, молитва ${f(d.prayer)}, ` +
            `пересказ ${f(d.recit)}, местописания ${f(d.loc)} — ${d.closed ? 'день закрыт' : 'день не закрыт'}`,
        )
    out.push('')
  }
  return out.join('\n')
}

export function DayGrid({ student }: { student: StudentDays }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="panel-section-title">{student.name || 'Без имени'}</div>
      {student.days.length === 0 ? (
        <div className="panel-card"><div className="panel-empty">Активности нет</div></div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>День</th>
                {PRACTICES.map((p) => (
                  <th key={p.key} style={{ textAlign: 'center' }}>{p.label}</th>
                ))}
                <th style={{ textAlign: 'center' }}>День закрыт</th>
              </tr>
            </thead>
            <tbody>
              {student.days.map((d) => (
                <tr key={d.date}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                  {PRACTICES.map((p) => (
                    <td
                      key={p.key}
                      style={{ textAlign: 'center', color: d[p.key] ? '#16a34a' : '#cbd0d8', fontWeight: 700 }}
                    >
                      {d[p.key] ? '✓' : '·'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    {d.closed ? (
                      <span className="panel-badge panel-badge--ok">закрыт</span>
                    ) : (
                      <span className="panel-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
