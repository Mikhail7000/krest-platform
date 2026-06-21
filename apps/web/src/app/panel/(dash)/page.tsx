import Link from 'next/link'
import { getPanelStats } from '@/app/api/panel/stats/stats-data'
import { getPanelSession } from '@/lib/admin/guard'
import { resolveIsOwner } from '@/lib/admin/owner'
import { countPendingRequests } from '@/lib/admin/access-requests'
import { createServiceSupabase } from '@/lib/supabase-service'
import { ProgressChart } from './StatsClient'
import { GenerateReport } from './GenerateReport'

export const dynamic = 'force-dynamic'

/**
 * /panel — Обзор. Server Component: данные тянем напрямую из общей логики
 * getPanelStats() (та же, что и у /api/panel/stats), без HTTP-хопа.
 * Стили — только готовые классы panel.css + инлайн (без новых css-файлов).
 * XSS: имена/города выводим только React-текстом (auto-escape).
 */
export default async function PanelOverviewPage() {
  const session = await getPanelSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const isOwner = session ? await resolveIsOwner(supabase, session.uid) : false
  const [stats, pendingRequests] = await Promise.all([
    getPanelStats(isOwner),
    countPendingRequests(supabase),
  ])
  const { totals, byCity, byCountry, progress, streaks, stuck } = stats

  const maxCountry = Math.max(1, ...byCountry.map((c) => c.count))
  const maxCity = Math.max(1, ...byCity.map((c) => c.count))

  return (
    <div>
      {pendingRequests > 0 && (
        <Link
          href="/panel/requests"
          className="panel-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: '3px solid var(--pl-acc)',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>📥</span>
          <span style={{ fontWeight: 600 }}>
            Новых заявок на доступ: {pendingRequests}
          </span>
          <span className="panel-muted" style={{ marginLeft: 'auto' }}>
            Рассмотреть →
          </span>
        </Link>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="panel-page__title">Обзор</h1>
          <p className="panel-page__subtitle" style={{ marginBottom: 0 }}>Сводная статистика платформы</p>
        </div>
        <GenerateReport stats={stats} />
      </div>

      {/* Плитки */}
      <div className="panel-grid">
        <div className="panel-stat">
          <div className="panel-stat__label">Учеников</div>
          <div className="panel-stat__value">{totals.students}</div>
          <div className="panel-stat__hint">в {totals.cities} городах</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Кураторов</div>
          <div className="panel-stat__value">{totals.curators}</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Администраторов</div>
          <div className="panel-stat__value">{totals.admins}</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Сдали курс</div>
          <div className="panel-stat__value">{totals.passedCourse}</div>
          <div className="panel-stat__hint">все 10 блоков</div>
        </div>
      </div>

      {/* Распределение по блокам */}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-section-title">Распределение по текущему блоку</div>
        {totals.students === 0 ? (
          <div className="panel-empty">Пока нет учеников</div>
        ) : (
          <ProgressChart data={progress} />
        )}
      </div>

      {/* По городам + по странам */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="panel-card">
          <div className="panel-section-title">По городам</div>
          {byCity.length === 0 ? (
            <div className="panel-empty">Нет данных</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {byCity.map((c) => (
                <div key={`${c.city}-${c.country}`}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.city}</span>
                    <span className="panel-muted" style={{ fontSize: '0.8rem' }}>
                      {c.country}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{c.count}</span>
                  </div>
                  <div className="panel-bar">
                    <div
                      className="panel-bar__fill"
                      style={{ width: `${Math.round((c.count / maxCity) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-section-title">По странам</div>
          {byCountry.length === 0 ? (
            <div className="panel-empty">Нет данных</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {byCountry.map((c) => (
                <div key={c.country}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.country}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{c.count}</span>
                  </div>
                  <div className="panel-bar">
                    <div
                      className="panel-bar__fill"
                      style={{ width: `${Math.round((c.count / maxCountry) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Топ по непрерывным дням */}
      <div style={{ marginBottom: 24 }}>
        <div className="panel-section-title">Топ по непрерывным дням</div>
        {streaks.length === 0 ? (
          <div className="panel-card">
            <div className="panel-empty">Пока никто не закрывал дни</div>
          </div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Ученик</th>
                  <th>Город</th>
                  <th>Серия</th>
                  <th>Всего дней</th>
                </tr>
              </thead>
              <tbody>
                {streaks.map((s, i) => (
                  <tr key={`${s.name}-${i}`}>
                    <td className="panel-muted">{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.telegram ? (
                        <div className="panel-muted" style={{ fontSize: '0.82rem' }}>
                          {s.telegram}
                        </div>
                      ) : null}
                    </td>
                    <td>{s.city}</td>
                    <td>
                      <span className="panel-badge panel-badge--acc">{s.maxStreak} дн.</span>
                    </td>
                    <td>{s.totalDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Застряли */}
      <div>
        <div className="panel-section-title">Застряли</div>
        <p className="panel-muted" style={{ margin: '-6px 0 14px', fontSize: '0.9rem' }}>
          Нет активности более 3 дней или ни одного закрытого дня после старта
        </p>
        {stuck.length === 0 ? (
          <div className="panel-card">
            <div className="panel-empty">Все на связи 👌</div>
          </div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Город</th>
                  <th>Блок</th>
                  <th>Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((s, i) => (
                  <tr key={`${s.name}-${i}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.telegram ? (
                        <div className="panel-muted" style={{ fontSize: '0.82rem' }}>
                          {s.telegram}
                        </div>
                      ) : null}
                    </td>
                    <td>{s.city}</td>
                    <td>
                      <span className="panel-badge">Блок {s.currentBlock}</span>
                    </td>
                    <td>
                      {s.lastDayAgo === null ? (
                        <span className="panel-badge panel-badge--err">ни разу</span>
                      ) : (
                        <span className="panel-badge panel-badge--warn">
                          {s.lastDayAgo} дн. назад
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
