import { notFound } from 'next/navigation'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getPanelSession } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

/**
 * /panel/audit — журнал изменений (только admin/super_admin):
 * смены ролей (role_change_log, пишется триггером БД + панелью) и входы
 * view-as (view_as_log). Раньше таблицы наполнялись, но их никто не читал —
 * «кто и когда сменил роль X» можно было узнать только из Telegram-ленты.
 */

const ROLE_LABEL: Record<string, string> = {
  student: 'ученик',
  curator: 'куратор',
  city_leader: 'лидер города',
  admin: 'админ',
  super_admin: 'супер-админ',
}

interface AuditItem {
  at: string
  kind: 'role' | 'view_as'
  text: string
  reason: string | null
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function AuditPage() {
  const session = await getPanelSession()
  if (session?.role !== 'admin' && session?.role !== 'super_admin') notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const [{ data: rolesRaw }, { data: viewsRaw }, { data: profilesRaw }] = await Promise.all([
    supabase
      .from('role_change_log')
      .select('changed_user_id, old_role, new_role, changed_by, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('view_as_log')
      .select('actor_id, target_id, target_role, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('profiles').select('id, full_name, contact_info'),
  ])

  const nameById = new Map<string, string>()
  for (const p of (profilesRaw ?? []) as { id: string; full_name: string | null; contact_info: string | null }[]) {
    nameById.set(p.id, p.full_name || p.contact_info || 'без имени')
  }
  const who = (id: string | null) => (id ? nameById.get(id) ?? 'удалённый пользователь' : null)

  const items: AuditItem[] = []
  for (const r of (rolesRaw ?? []) as Array<{
    changed_user_id: string
    old_role: string
    new_role: string
    changed_by: string | null
    reason: string | null
    created_at: string
  }>) {
    const actor = who(r.changed_by)
    items.push({
      at: r.created_at,
      kind: 'role',
      text: `${who(r.changed_user_id)}: ${ROLE_LABEL[r.old_role] ?? r.old_role} → ${ROLE_LABEL[r.new_role] ?? r.new_role}${actor ? ` — сменил(а) ${actor}` : ''}`,
      reason: r.reason,
    })
  }
  for (const v of (viewsRaw ?? []) as Array<{
    actor_id: string
    target_id: string
    target_role: string | null
    created_at: string
  }>) {
    items.push({
      at: v.created_at,
      kind: 'view_as',
      text: `${who(v.actor_id)} открыл(а) панель как ${who(v.target_id)}${v.target_role ? ` (${ROLE_LABEL[v.target_role] ?? v.target_role})` : ''}`,
      reason: null,
    })
  }
  items.sort((a, b) => b.at.localeCompare(a.at))
  const shown = items.slice(0, 120)

  return (
    <div>
      <h1 className="panel-page__title">Журнал</h1>
      <p className="panel-page__subtitle">
        Смены ролей и входы «смотреть как». Записи с пометкой db:trigger — изменения
        вне панели (бот, whitelist, заявки, SQL).
      </p>
      {shown.length === 0 ? (
        <div className="panel-card"><div className="panel-empty">Записей пока нет</div></div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Когда</th>
                <th>Тип</th>
                <th>Событие</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it, i) => (
                <tr key={`${it.at}-${i}`}>
                  <td className="panel-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(it.at)}</td>
                  <td>
                    {it.kind === 'role' ? (
                      <span className="panel-badge panel-badge--acc">роль</span>
                    ) : (
                      <span className="panel-badge">view-as</span>
                    )}
                  </td>
                  <td>
                    {it.text}
                    {it.reason ? (
                      <span className="panel-muted" style={{ fontSize: '0.78rem' }}> · {it.reason}</span>
                    ) : null}
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
