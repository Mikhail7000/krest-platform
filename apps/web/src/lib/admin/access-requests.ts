import { createTelegramProfile } from '@/lib/telegram/ensure-profile'
import { sendTelegramMessage } from '@/lib/telegram/send'

/**
 * Заявки на доступ (access_requests) для веб-панели.
 *  - getAccessRequests / countPendingRequests — чтение для страницы и бейджа.
 *  - decideAccessRequest — решение (зеркало Telegram inline-кнопок в вебхуке).
 *
 * Таблица RLS-защищена (доступ только через service_role), поэтому supabase
 * принимается нетипизированным (as any), как и в остальных панель-роутах.
 */

export interface AccessRequestRow {
  id: string
  telegramChatId: number
  username: string | null
  firstName: string | null
  lastName: string | null
  status: 'pending' | 'approved' | 'rejected'
  approvedRole: 'student' | 'curator' | null
  decidedAt: string | null
  createdAt: string
}

export type DecideAction = 'approve_student' | 'approve_curator' | 'reject'

interface RawRow {
  id: string
  telegram_chat_id: number | string
  username: string | null
  first_name: string | null
  last_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_role: 'student' | 'curator' | null
  decided_at: string | null
  created_at: string
}

const SELECT =
  'id, telegram_chat_id, username, first_name, last_name, status, approved_role, decided_at, created_at'

function mapRow(r: RawRow): AccessRequestRow {
  return {
    id: r.id,
    telegramChatId: Number(r.telegram_chat_id),
    username: r.username,
    firstName: r.first_name,
    lastName: r.last_name,
    status: r.status,
    approvedRole: r.approved_role,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
  }
}

/** Ожидающие заявки + последние 30 решённых (для истории). */
export async function getAccessRequests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ pending: AccessRequestRow[]; decided: AccessRequestRow[] }> {
  const { data: pendingRaw, error: pendingErr } = await supabase
    .from('access_requests')
    .select(SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: decidedRaw, error: decidedErr } = await supabase
    .from('access_requests')
    .select(SELECT)
    .neq('status', 'pending')
    .order('decided_at', { ascending: false })
    .limit(30)

  // Ошибку нельзя глушить молча: иначе сбой запроса выглядит как «заявок нет».
  if (pendingErr) console.error('[access-requests] pending query error:', pendingErr)
  if (decidedErr) console.error('[access-requests] decided query error:', decidedErr)

  return {
    pending: ((pendingRaw ?? []) as RawRow[]).map(mapRow),
    decided: ((decidedRaw ?? []) as RawRow[]).map(mapRow),
  }
}

/** Число ожидающих заявок — для бейджа навигации и баннера обзора. */
export async function countPendingRequests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  const { count, error } = await supabase
    .from('access_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) console.error('[access-requests] count error:', error)
  return count ?? 0
}

export type DecideResult =
  | { ok: true; name: string; action: DecideAction }
  | { ok: false; error: string }

/**
 * Решение по заявке из веб-панели — точное зеркало логики Telegram-вебхука:
 *  approve_* → createTelegramProfile + пометка заявки + уведомление заявителя;
 *  reject    → пометка заявки rejected.
 * Идемпотентно по отношению к параллельному решению из бота: если заявка уже
 * не pending — вернёт ошибку «уже обработана».
 */
export async function decideAccessRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: { requestId: string; action: DecideAction; deciderChatId: number | null },
): Promise<DecideResult> {
  const { requestId, action, deciderChatId } = params

  const { data: req, error: fetchErr } = await supabase
    .from('access_requests')
    .select('id, telegram_chat_id, username, first_name, last_name, status')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchErr || !req) return { ok: false, error: 'Заявка не найдена' }
  const r = req as RawRow
  if (r.status !== 'pending') return { ok: false, error: 'Заявка уже обработана' }

  const name =
    [r.first_name, r.last_name].filter(Boolean).join(' ') ||
    (r.username ? `@${r.username}` : `id ${r.telegram_chat_id}`)

  if (action === 'approve_student' || action === 'approve_curator') {
    const role: 'student' | 'curator' = action === 'approve_student' ? 'student' : 'curator'

    const result = await createTelegramProfile({
      chatId: Number(r.telegram_chat_id),
      username: r.username,
      firstName: r.first_name,
      lastName: r.last_name,
      role,
    })
    if (!result.ok) return { ok: false, error: result.message || 'Ошибка создания профиля' }

    // Условный UPDATE + .select(): победитель гонки = тот, чей флип реально прошёл.
    // Так уведомление заявителю уходит ровно один раз (а не из бота и панели сразу).
    const { data: flipped } = await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        approved_role: role,
        decided_by: deciderChatId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
    if (!flipped || flipped.length === 0) {
      return { ok: false, error: 'Заявка уже обработана' }
    }

    // Уведомляем заявителя (best-effort — может быть не запущен приватный чат)
    await sendTelegramMessage(
      Number(r.telegram_chat_id),
      'Тебя одобрили! ✝️ Открой приложение и начни обучение.',
      { withMiniAppButton: true },
    )

    return { ok: true, name, action }
  }

  // reject
  const { data: rejected } = await supabase
    .from('access_requests')
    .update({
      status: 'rejected',
      decided_by: deciderChatId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
  if (!rejected || rejected.length === 0) {
    return { ok: false, error: 'Заявка уже обработана' }
  }

  return { ok: true, name, action }
}
