import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getAccessRequests } from '@/lib/admin/access-requests'
import { getPanelSession } from '@/lib/admin/guard'
import { RequestActions } from './RequestActions'

export const dynamic = 'force-dynamic'

/**
 * /panel/requests — заявки на доступ от незнакомых Telegram-пользователей.
 * Дублирует Telegram inline-кнопки: тот же набор решений, тот же бэкенд.
 * XSS: имена/ники выводим только React-текстом (auto-escape).
 * Кураторы не имеют доступа к этой странице → 404.
 */

function fmtName(
  first: string | null,
  last: string | null,
  username: string | null,
  chatId: number,
): string {
  return (
    [first, last].filter(Boolean).join(' ') ||
    (username ? `@${username}` : `id ${chatId}`)
  )
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  approved: { cls: 'panel-badge panel-badge--ok', label: 'Одобрена' },
  rejected: { cls: 'panel-badge panel-badge--err', label: 'Отклонена' },
}

// Время решения в таймзоне Бали (старт платформы) — для аудита истории.
function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function RequestsPage() {
  const session = await getPanelSession()
  if (session?.role === 'curator') notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { pending, decided } = await getAccessRequests(supabase)

  return (
    <div>
      <h1 className="panel-page__title">Заявки на доступ</h1>
      <p className="panel-page__subtitle">
        Незнакомые пользователи, запросившие вход через бота. Реши — впустить или
        отклонить. Те же кнопки приходят и в Telegram.
      </p>

      {pending.length === 0 ? (
        <div className="panel-card">
          <div className="panel-empty">Новых заявок нет 👌</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map((r) => (
            <div
              key={r.id}
              className="panel-card"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {fmtName(r.firstName, r.lastName, r.username, r.telegramChatId)}
                </div>
                <div className="panel-muted" style={{ fontSize: '0.85rem' }}>
                  {r.username ? `@${r.username}` : 'без username'} · chat id {r.telegramChatId}
                </div>
              </div>
              <RequestActions requestId={r.id} />
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <div className="panel-section-title" style={{ marginTop: 28 }}>
            История решений
          </div>
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Username</th>
                  <th>Решение</th>
                  <th>Кем решено</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => {
                  const b = STATUS_BADGE[r.status]
                  return (
                    <tr key={r.id}>
                      <td>{fmtName(r.firstName, r.lastName, r.username, r.telegramChatId)}</td>
                      <td className="panel-muted">{r.username ? `@${r.username}` : '—'}</td>
                      <td>
                        {b ? <span className={b.cls}>{b.label}</span> : r.status}
                        {r.approvedRole
                          ? ` · ${r.approvedRole === 'curator' ? 'куратор' : 'ученик'}`
                          : ''}
                      </td>
                      <td>
                        {r.decidedByName ? (
                          <div style={{ fontWeight: 600 }}>{r.decidedByName}</div>
                        ) : r.decidedBy ? (
                          <div className="panel-muted">id {r.decidedBy}</div>
                        ) : (
                          <span className="panel-muted">—</span>
                        )}
                        {r.decidedAt ? (
                          <div className="panel-muted" style={{ fontSize: '0.8rem' }}>
                            {fmtWhen(r.decidedAt)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
