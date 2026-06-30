import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeActivity } from '@/lib/activity/streak'
import { createTelegramProfile } from '@/lib/telegram/ensure-profile'
import { getAdminChatIds } from '@/lib/telegram/admin-recipients'
import { signLoginToken, type AdminRole } from '@/lib/admin/session'
import { attachStudentsToCurator } from '@/lib/access/attach'
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
  editMessageReplyMarkup,
  type InlineKeyboardButton,
} from '@/lib/telegram/send'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://krest-platform-web.vercel.app'

// ─── Telegram Update types ────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: { message_id: number; chat: { id: number } }
  data?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface AccessRequest {
  id: string
  telegram_chat_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_role: 'student' | 'curator' | null
}

// ─── Service Supabase client ──────────────────────────────────────────────

function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase configuration')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Проверка роли admin/super_admin по telegram_chat_id ────────────────

async function getAdminProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
): Promise<{ id: string; role: string; isOwner: boolean } | null> {
  const { data } = (await supabase
    .from('profiles')
    .select('id, role, is_protected')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()) as { data: { id: string; role: string; is_protected: boolean | null } | null }
  if (!data || !['admin', 'super_admin'].includes(data.role)) return null
  return { id: data.id, role: data.role, isOwner: !!(data as any).is_protected }
}

// ─── Обработчик callback_query ────────────────────────────────────────────

async function handleCallbackQuery(cq: TelegramCallbackQuery): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceSupabase() as any

  // Права на inline-кнопки = админы платформы (super_admin + admin) из БД, с
  // env-fallback (ADMIN_TELEGRAM_CHAT_IDS). Раньше пускали ТОЛЬКО env-владельца —
  // из-за чего Эля (admin) видела кнопки заявок, но нажать не могла.
  const adminChatIds = await getAdminChatIds(service)
  if (!adminChatIds.includes(cq.from.id)) {
    await answerCallbackQuery(cq.id, 'Недостаточно прав')
    return
  }

  const data = cq.data ?? ''
  const colonIdx = data.indexOf(':')
  if (colonIdx === -1) {
    await answerCallbackQuery(cq.id, 'Неверный формат данных')
    return
  }

  const action = data.slice(0, colonIdx)
  const payload = data.slice(colonIdx + 1)

  // ── del_cancel ──────────────────────────────────────────────────────────
  if (action === 'del_cancel') {
    await answerCallbackQuery(cq.id, 'Отменено')
    if (cq.message) {
      await editMessageText(cq.message.chat.id, cq.message.message_id, '↩️ Удаление отменено.')
    }
    return
  }

  // ── del_student ─────────────────────────────────────────────────────────
  if (action === 'del_student') {
    // Двойная проверка прав через profiles.role (не только whitelist)
    const adminProf = await getAdminProfile(service, cq.from.id)
    if (!adminProf) {
      await answerCallbackQuery(cq.id, 'Команда только для администраторов')
      return
    }

    const userId = payload
    const { data: target } = (await service
      .from('profiles')
      .select('id, full_name, contact_info, is_protected')
      .eq('id', userId)
      .maybeSingle()) as {
      data: {
        id: string
        full_name: string | null
        contact_info: string | null
        is_protected: boolean | null
      } | null
    }

    if (!target) {
      await answerCallbackQuery(cq.id, 'Ученик не найден')
      if (cq.message) {
        await editMessageText(cq.message.chat.id, cq.message.message_id, '❌ Ученик не найден.')
      }
      return
    }

    if (target.is_protected) {
      await answerCallbackQuery(cq.id, 'Защищённого нельзя удалить')
      if (cq.message) {
        await editMessageText(
          cq.message.chat.id,
          cq.message.message_id,
          '🔒 Защищённого пользователя нельзя удалить.',
        )
      }
      return
    }

    const displayName = escapeHtmlTg(target.full_name || target.contact_info || userId)

    // Удаляем whitelist-слот по contact_info
    if (target.contact_info) {
      await service
        .from('testing_whitelist')
        .delete()
        .ilike('telegram_username', target.contact_info)
    }

    // Удаляем профиль (каскадом снесёт прогресс благодаря ON DELETE CASCADE)
    const { error: profileErr } = await service.from('profiles').delete().eq('id', userId)
    if (profileErr) {
      console.error('[webhook/del_student] profiles delete error:', profileErr)
      await answerCallbackQuery(cq.id, 'Ошибка удаления профиля')
      return
    }

    // Удаляем auth.users (прямой DELETE через service_role)
    const { error: authErr } = await service.auth.admin.deleteUser(userId)
    if (authErr) {
      // Профиль уже удалён — логируем, но не откатываем
      console.error('[webhook/del_student] auth.admin.deleteUser error:', authErr)
    }

    await answerCallbackQuery(cq.id, 'Удалено')
    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `🗑 Ученик <b>${displayName}</b> удалён.`,
      )
    }
    return
  }

  // ── Лидер города: шаг 1 — показать города кнопками ──────────────────────
  if (action === 'leader_pick') {
    const { data: r } = await service
      .from('access_requests')
      .select('id, status')
      .eq('id', payload)
      .maybeSingle()
    if (!r || r.status !== 'pending') {
      await answerCallbackQuery(cq.id, 'Заявка уже обработана')
      return
    }
    const { data: cityRows } = await service.from('cities').select('id, name_ru').order('name_ru')
    const cities = (cityRows ?? []) as { id: number; name_ru: string }[]
    if (cities.length === 0) {
      await answerCallbackQuery(cq.id, 'Городов нет — добавь город в /panel')
      return
    }
    const rows: InlineKeyboardButton[][] = []
    for (let i = 0; i < cities.length; i += 2) {
      rows.push(
        cities.slice(i, i + 2).map((c) => ({
          text: c.name_ru,
          callback_data: `approve_leader:${payload}:${c.id}`,
        })),
      )
    }
    rows.push([{ text: '← Назад', callback_data: `leader_back:${payload}` }])
    await answerCallbackQuery(cq.id, 'Выбери город лидера')
    if (cq.message) await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, rows)
    return
  }

  // ── Лидер города: назад к исходным кнопкам ──────────────────────────────
  if (action === 'leader_back') {
    await answerCallbackQuery(cq.id)
    if (cq.message) {
      await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, [
        [{ text: '✅ Впустить учеником', callback_data: `approve_student:${payload}` }],
        [{ text: '👤 Сделать куратором', callback_data: `approve_curator:${payload}` }],
        [{ text: '👑 Лидером города', callback_data: `leader_pick:${payload}` }],
        [{ text: '✖️ Отклонить', callback_data: `reject:${payload}` }],
      ])
    }
    return
  }

  // ── /addleader: выбран город → запись лидеров города в whitelist ─────────
  // Ники взяты из bot_pending_action.payload (один или несколько). payload=cityId.
  if (action === 'addleader_city') {
    const cityNum = Number(payload)
    const cityId = Number.isInteger(cityNum) ? cityNum : null
    if (cityId == null) {
      await answerCallbackQuery(cq.id, 'Неверный город')
      return
    }
    const adminProf = await getAdminProfile(service, cq.from.id)
    if (!adminProf) {
      await answerCallbackQuery(cq.id, 'Команда только для администраторов')
      return
    }
    const pendChat = cq.message?.chat.id ?? cq.from.id
    const { data: pend } = await service
      .from('bot_pending_action')
      .select('payload')
      .eq('telegram_chat_id', pendChat)
      .maybeSingle()
    const handles = parseHandles((pend as { payload: string | null } | null)?.payload ?? '')
    if (handles.length === 0) {
      await answerCallbackQuery(cq.id, 'Список устарел — начни заново: /addleader')
      return
    }

    const { data: cityRow } = await service
      .from('cities')
      .select('name_ru')
      .eq('id', cityId)
      .maybeSingle()
    const cityName = escapeHtmlTg((cityRow as { name_ru: string } | null)?.name_ru ?? `#${cityId}`)

    for (const handle of handles) {
      const { data: existing } = await service
        .from('testing_whitelist')
        .select('id')
        .ilike('telegram_username', handle)
        .maybeSingle()
      if (existing) {
        await service
          .from('testing_whitelist')
          .update({ claimed_chat_id: null, assign_role: 'city_leader', assigned_city_id: cityId })
          .eq('id', (existing as { id: number }).id)
      } else {
        await service
          .from('testing_whitelist')
          .insert({ telegram_username: handle, added_by: adminProf.id, assign_role: 'city_leader', assigned_city_id: cityId })
      }
      // Если профиль-ученик с этим ником уже есть — повышаем сразу + город.
      await service
        .from('profiles')
        .update({ role: 'city_leader', city_id: cityId })
        .ilike('contact_info', handle)
        .eq('role', 'student')
    }

    await service.from('bot_pending_action').delete().eq('telegram_chat_id', pendChat)

    const list = handles.map((h) => escapeHtmlTg(h)).join(', ')
    await answerCallbackQuery(cq.id, 'Лидеры назначены')
    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `👑 Лидеры города <b>${cityName}</b> (${handles.length}): ${list}\nВойдут в панель после /start в боте.`,
      )
    }
    const adminChatIds = await getAdminChatIds(service)
    await Promise.all(
      adminChatIds
        .filter((cid) => cid !== cq.from.id)
        .map((cid) =>
          sendTelegramMessage(cid, `👑 Назначены лидеры города ${cityName} (${handles.length}): ${list}`),
        ),
    )
    return
  }

  // ── approve / reject access requests ────────────────────────────────────
  // approve_leader payload = "requestId:cityId"; остальные actions = "requestId".
  let leaderCityId: number | null = null
  let requestId = payload
  if (action === 'approve_leader') {
    const sep = payload.lastIndexOf(':')
    requestId = sep >= 0 ? payload.slice(0, sep) : payload
    const parsed = Number(payload.slice(sep + 1))
    leaderCityId = Number.isInteger(parsed) ? parsed : null
  }

  const { data: req, error: fetchErr } = await service
    .from('access_requests')
    .select('id, telegram_chat_id, username, first_name, last_name, status, approved_role')
    .eq('id', requestId)
    .maybeSingle() as { data: AccessRequest | null; error: unknown }

  if (fetchErr || !req) {
    await answerCallbackQuery(cq.id, 'Заявка не найдена')
    return
  }

  if (req.status !== 'pending') {
    await answerCallbackQuery(cq.id, 'Заявка уже обработана')
    return
  }

  const name =
    [req.first_name, req.last_name].filter(Boolean).join(' ') ||
    (req.username ? `@${req.username}` : `id ${req.telegram_chat_id}`)

  if (action === 'approve_student' || action === 'approve_curator' || action === 'approve_leader') {
    const role: 'student' | 'curator' | 'city_leader' =
      action === 'approve_student' ? 'student' : action === 'approve_curator' ? 'curator' : 'city_leader'
    const roleLabel = role === 'student' ? 'ученик' : role === 'curator' ? 'куратор' : 'лидер города'
    // Лидеру город обязателен (выбран на шаге leader_pick).
    const cityId = role === 'city_leader' ? leaderCityId : null
    if (role === 'city_leader' && cityId == null) {
      await answerCallbackQuery(cq.id, 'Город не выбран')
      return
    }

    // Создаём профиль
    const result = await createTelegramProfile({
      chatId: Number(req.telegram_chat_id),
      username: req.username,
      firstName: req.first_name,
      lastName: req.last_name,
      role,
      cityId,
    })

    if (!result.ok) {
      console.error('[webhook] createTelegramProfile failed:', result)
      await answerCallbackQuery(cq.id, 'Ошибка создания профиля')
      return
    }

    // Обновляем заявку условным флипом (.eq status pending + .select): победитель
    // гонки бот↔панель ровно один → заявителя не уведомим дважды, статусы не разойдутся.
    const { data: flipped } = await service.from('access_requests').update({
      status: 'approved',
      approved_role: role,
      approved_city_id: cityId,
      decided_by: cq.from.id,
      decided_at: new Date().toISOString(),
    }).eq('id', requestId).eq('status', 'pending').select('id')

    if (!flipped || flipped.length === 0) {
      await answerCallbackQuery(cq.id, 'Заявка уже обработана')
      return
    }

    await answerCallbackQuery(cq.id, 'Одобрено')

    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `✅ Одобрено как ${roleLabel}: <b>${name}</b>`,
      )
    }

    // Уведомляем заявителя
    await sendTelegramMessage(
      Number(req.telegram_chat_id),
      'Тебя одобрили! ✝️ Открой приложение и начни обучение.',
      { withMiniAppButton: true },
    )
    return
  }

  if (action === 'reject') {
    const { data: rejected } = await service.from('access_requests').update({
      status: 'rejected',
      decided_by: cq.from.id,
      decided_at: new Date().toISOString(),
    }).eq('id', requestId).eq('status', 'pending').select('id')

    if (!rejected || rejected.length === 0) {
      await answerCallbackQuery(cq.id, 'Заявка уже обработана')
      return
    }

    await answerCallbackQuery(cq.id, 'Отклонено')

    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `✖️ Отклонено: <b>${name}</b>`,
      )
    }
    return
  }

  await answerCallbackQuery(cq.id, 'Неизвестное действие')
}

// ─── Хелпер: прогресс учеников для команды /students ─────────────────────

interface StudentSummary {
  id: string
  full_name: string
  handle: string | null
  passed: number
  currentBlock: number
  daysClosed: number // закрытых дней в текущем блоке по дневной модели
  daysSilent: number | null // дней без активности
}

function escapeHtmlTg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Загружает учеников куратора и считает их прогресс через RPC passed_blocks_all.
 * Возвращает упорядоченный список StudentSummary.
 * isOwner=true → показывать всех (включая hidden_from_tracking).
 * isOwner=false → скрытые ученики не попадают в список.
 */
async function loadStudentsSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { curatorId?: string; all?: boolean; isOwner?: boolean },
): Promise<StudentSummary[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, contact_info')
    .eq('role', 'student')
  if (!opts.all) query = query.eq('curator_id', opts.curatorId)
  if (!opts.isOwner) query = query.eq('hidden_from_tracking', false)
  const { data: students, error: studentsError } = await query

  if (studentsError) {
    console.error('[webhook/students] profiles query error', studentsError)
    return []
  }

  const profiles = (students ?? []) as {
    id: string
    full_name: string | null
    contact_info: string | null
  }[]
  if (profiles.length === 0) return []

  const ids = profiles.map((p) => p.id)

  // Один вызов RPC для реального числа сданных блоков (дневная модель)
  const [passedAllRes, closedDaysRes, actRes] = await Promise.all([
    supabase.rpc('passed_blocks_all') as Promise<{
      data: { user_id: string; blocks_passed: number }[] | null
      error: unknown
    }>,
    supabase
      .from('student_block_daily_cross')
      .select('user_id, block_id, submitted_date')
      .in('user_id', ids),
    supabase
      .from('student_daily_activity')
      .select('user_id, activity_date')
      .in('user_id', ids)
      .eq('opened', true),
  ])

  if (passedAllRes.error) {
    console.error('[webhook/students] passed_blocks_all rpc error', passedAllRes.error)
  }

  // Map user_id → blocks_passed из RPC (отсутствующие = 0)
  const passedMap = new Map<string, number>()
  for (const r of (passedAllRes.data ?? []) as { user_id: string; blocks_passed: number }[]) {
    passedMap.set(r.user_id, r.blocks_passed)
  }

  // Закрытые дни по блокам: user:block → Set<date>
  const closedByBlock: Record<string, Set<string>> = {}
  for (const r of (closedDaysRes.data ?? []) as { user_id: string; block_id: number; submitted_date: string }[]) {
    ;(closedByBlock[`${r.user_id}:${r.block_id}`] ??= new Set()).add(r.submitted_date)
  }

  const lastAct: Record<string, string> = {}
  for (const r of (actRes.data ?? []) as { user_id: string; activity_date: string }[]) {
    if (!lastAct[r.user_id] || r.activity_date > lastAct[r.user_id]) lastAct[r.user_id] = r.activity_date
  }

  return profiles.map((student) => {
    const passed = passedMap.get(student.id) ?? 0
    const currentBlock = Math.min(passed + 1, 10)
    const daysClosed = closedByBlock[`${student.id}:${currentBlock}`]?.size ?? 0
    const last = lastAct[student.id]
    const daysSilent = last
      ? Math.floor((Date.now() - new Date(`${last}T00:00:00Z`).getTime()) / 86400000)
      : null
    return {
      id: student.id,
      full_name: student.full_name ?? 'Без имени',
      handle: student.contact_info,
      passed,
      currentBlock,
      daysClosed,
      daysSilent,
    }
  })
}

/**
 * Форматирует HTML-сообщение со списком учеников.
 * Обрезает до лимита Telegram 4096 символов.
 */
function formatStudentsList(students: StudentSummary[], isAdmin: boolean): string {
  if (students.length === 0) {
    return isAdmin ? 'Пока нет учеников на платформе.' : 'Пока нет привязанных учеников.'
  }

  const LIMIT = 3800 // оставляем буфер от 4096
  const header = `<b>${isAdmin ? 'Все ученики' : 'Твои ученики'} (${students.length})</b>\n\n`

  const lines: string[] = []
  let bodyLen = 0

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const handle = s.handle ? ` ${escapeHtmlTg(s.handle)}` : ''
    const silent = s.daysSilent != null && s.daysSilent >= 2 ? ` · 🔕 молчит ${s.daysSilent} дн.` : ''
    const line =
      `${i + 1}. <b>${escapeHtmlTg(s.full_name)}</b>${handle}\n` +
      `   📚 ${s.passed}/10 блоков · Блок ${s.currentBlock} · дней закрыто ${s.daysClosed}/7${silent}\n`
    if (header.length + bodyLen + line.length > LIMIT) {
      const remaining = students.length - i
      lines.push(`<i>...и ещё ${remaining} — открой приложение для полного списка</i>`)
      break
    }
    lines.push(line)
    bodyLen += line.length
  }

  return header + lines.join('')
}

function ruDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}.${m}` : iso
}

/**
 * Детальный прогресс одного ученика по нику (для /student @ник).
 * curator видит только своих; admin/super_admin — любого.
 * Если ученик hidden_from_tracking=TRUE и запрашивающий не владелец — «не найден».
 * Использует дневную модель: passed_blocks_all + user_closed_days.
 */
async function formatStudentDetail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  requester: { id: string; role: string; isOwner?: boolean },
  rawNick: string,
): Promise<string> {
  const handle = `@${rawNick.replace(/^@+/, '').toLowerCase()}`
  const { data: s } = (await supabase
    .from('profiles')
    .select('id, full_name, contact_info, curator_id, course_started_at, hidden_from_tracking')
    .eq('role', 'student')
    .ilike('contact_info', handle)
    .maybeSingle()) as {
    data: {
      id: string
      full_name: string | null
      contact_info: string | null
      curator_id: string | null
      course_started_at: string | null
      hidden_from_tracking: boolean | null
    } | null
  }
  if (!s) return `Ученик ${escapeHtmlTg(handle)} не найден.`
  // Скрытый ученик: для всех кроме владельца — «не найден» (как будто его нет)
  if ((s as any).hidden_from_tracking && !requester.isOwner) {
    return `Ученик ${escapeHtmlTg(handle)} не найден.`
  }
  if (requester.role === 'curator' && s.curator_id !== requester.id) {
    return `${escapeHtmlTg(s.full_name || handle)} — не твой ученик.`
  }

  // passed_blocks_all и user_closed_days — параллельно
  const [passedAllRes, closedDaysRes] = await Promise.all([
    supabase.rpc('passed_blocks_all') as Promise<{
      data: { user_id: string; blocks_passed: number }[] | null
      error: unknown
    }>,
    supabase.rpc('user_closed_days', { p_user_id: s.id }) as Promise<{
      data: { block_id: number; days: number }[] | null
      error: unknown
    }>,
  ])

  if (passedAllRes.error) console.error('[webhook/student] passed_blocks_all error', passedAllRes.error)
  if (closedDaysRes.error) console.error('[webhook/student] user_closed_days error', closedDaysRes.error)

  // Сколько блоков реально сдано этим учеником
  const passedRow = (passedAllRes.data ?? []).find((r) => r.user_id === s.id)
  const passed = passedRow?.blocks_passed ?? 0
  const currentBlock = Math.min(passed + 1, 10)

  // Закрытых дней в текущем блоке из RPC
  const closedRow = (closedDaysRes.data ?? []).find((r) => r.block_id === currentBlock)
  const daysClosed = closedRow?.days ?? 0

  // Квиз и эпоха пятницы текущего блока из таблиц (лёгкие запросы)
  const [quizRes, fridayRes] = await Promise.all([
    supabase
      .from('student_block_progress')
      .select('quiz_passed_at')
      .eq('user_id', s.id)
      .eq('block_id', currentBlock)
      .maybeSingle() as Promise<{ data: { quiz_passed_at: string | null } | null }>,
    supabase
      .from('student_block_friday_practice')
      .select('id')
      .eq('user_id', s.id)
      .eq('block_id', currentBlock)
      .maybeSingle() as Promise<{ data: { id: string } | null }>,
  ])

  const quizPassed = !!quizRes.data?.quiz_passed_at
  const fridayPassed = !!fridayRes.data

  const inProgress = s.course_started_at
    ? Math.floor((Date.now() - new Date(s.course_started_at).getTime()) / 86400000)
    : null
  const yn = (v: boolean) => (v ? '✅' : '❌')

  return (
    `<b>${escapeHtmlTg(s.full_name || 'Ученик')}</b> ${escapeHtmlTg(s.contact_info || '')}\n\n` +
    `📚 Сдано блоков: <b>${passed}/10</b>\n` +
    `📍 Текущий блок: <b>${currentBlock}</b>\n` +
    (inProgress != null ? `⏱ На курсе: ${inProgress} дн.\n` : '') +
    `\n<b>Блок ${currentBlock}:</b>\n` +
    `• Закрыто дней: <b>${daysClosed}/7</b>\n` +
    `• Квиз: ${yn(quizPassed)}\n` +
    `• Эпоха пятницы: ${yn(fridayPassed)}\n`
  )
}

// ─── /curators: кураторы и их ученики ────────────────────────────────────

async function handleCurators(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
): Promise<void> {
  const { data: curators, error } = (await supabase
    .from('profiles')
    .select('id, full_name, contact_info, city_id')
    .eq('role', 'curator')) as {
    data: { id: string; full_name: string | null; contact_info: string | null; city_id: number | null }[] | null
    error: unknown
  }

  if (error) {
    console.error('[webhook/curators] curators query error:', error)
    await sendTelegramMessage(chatId, 'Ошибка при загрузке кураторов.')
    return
  }

  // Ожидающие входа кураторы (в белом списке как curator, но ещё не зашли)
  const { data: pendingRaw } = (await supabase
    .from('testing_whitelist')
    .select('telegram_username')
    .eq('assign_role', 'curator')
    .is('claimed_chat_id', null)) as { data: { telegram_username: string }[] | null }
  const pendingCurators = (pendingRaw ?? []).map((p) => p.telegram_username)

  if ((!curators || curators.length === 0) && pendingCurators.length === 0) {
    await sendTelegramMessage(chatId, 'Кураторов на платформе пока нет.')
    return
  }

  // Все ученики — curator_id + ник
  const { data: students } = (await supabase
    .from('profiles')
    .select('curator_id, contact_info')
    .eq('role', 'student')
    .not('curator_id', 'is', null)) as {
    data: { curator_id: string; contact_info: string | null }[] | null
  }

  const studentsByC: Record<string, string[]> = {}
  for (const s of students ?? []) {
    if (!s.curator_id) continue
    ;(studentsByC[s.curator_id] ??= []).push(s.contact_info ?? 'без ника')
  }

  // Города (id → name_ru) — показываем город каждого куратора
  const { data: citiesRows } = (await supabase
    .from('cities')
    .select('id, name_ru')) as { data: { id: number; name_ru: string }[] | null }
  const cityName = new Map<number, string>((citiesRows ?? []).map((c) => [c.id, c.name_ru]))

  // Сортируем кураторов по числу учеников (убыв.)
  const sorted = [...(curators ?? [])].sort(
    (a, b) => (studentsByC[b.id]?.length ?? 0) - (studentsByC[a.id]?.length ?? 0),
  )

  const LIMIT = 3900
  const lines: string[] = [`<b>Кураторы (${sorted.length})</b>\n`]
  let totalLen = lines[0].length

  for (const c of sorted) {
    const nick = c.contact_info ? ` ${escapeHtmlTg(c.contact_info)}` : ''
    const list = studentsByC[c.id] ?? []
    const studentsLine =
      list.length > 0
        ? list.map((h) => escapeHtmlTg(h)).join(', ')
        : '<i>нет учеников</i>'
    const cityStr = c.city_id ? escapeHtmlTg(cityName.get(c.city_id) ?? '') : ''
    const cityPart = cityStr ? ` · 📍 ${cityStr}` : ''
    const block =
      `\n<b>${escapeHtmlTg(c.full_name ?? 'Куратор')}${nick}</b> · ${list.length} уч.${cityPart}\n` +
      `  ${studentsLine}\n`

    if (totalLen + block.length > LIMIT) {
      lines.push('\n<i>...список обрезан, полный доступен в приложении</i>')
      break
    }
    lines.push(block)
    totalLen += block.length
  }

  if (pendingCurators.length > 0) {
    lines.push(
      `\n<b>⏳ Ожидают входа (${pendingCurators.length}):</b>\n` +
        `  ${pendingCurators.map((h) => escapeHtmlTg(h)).join(', ')}\n` +
        `  <i>станут кураторами, когда откроют бота</i>\n`,
    )
  }

  await sendTelegramMessage(chatId, lines.join(''))
}

// ─── /transfer @ученик @куратор ──────────────────────────────────────────

async function handleTransfer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
  args: string,
): Promise<void> {
  const parts = args
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^@+/, '').toLowerCase())
    .filter(Boolean)

  if (parts.length < 2) {
    await sendTelegramMessage(
      chatId,
      'Укажи оба ника:\n<code>/transfer @ученик @куратор</code>',
    )
    return
  }

  const [studentNick, curatorNick] = parts

  const [{ data: student }, { data: curator }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, contact_info')
      .eq('role', 'student')
      .ilike('contact_info', `@${studentNick}`)
      .maybeSingle() as Promise<{
        data: { id: string; full_name: string | null; contact_info: string | null } | null
      }>,
    supabase
      .from('profiles')
      .select('id, full_name, contact_info')
      .eq('role', 'curator')
      .ilike('contact_info', `@${curatorNick}`)
      .maybeSingle() as Promise<{
        data: { id: string; full_name: string | null; contact_info: string | null } | null
      }>,
  ])

  if (!student && !curator) {
    await sendTelegramMessage(
      chatId,
      `Не найдены: ученик @${escapeHtmlTg(studentNick)} и куратор @${escapeHtmlTg(curatorNick)}.`,
    )
    return
  }
  if (!student) {
    await sendTelegramMessage(
      chatId,
      `Ученик @${escapeHtmlTg(studentNick)} не найден (или не является учеником).`,
    )
    return
  }
  if (!curator) {
    await sendTelegramMessage(
      chatId,
      `Куратор @${escapeHtmlTg(curatorNick)} не найден (или не является куратором).`,
    )
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({ curator_id: curator.id })
    .eq('id', student.id)

  if (error) {
    console.error('[webhook/transfer] update curator_id error:', error)
    await sendTelegramMessage(chatId, 'Ошибка при переводе. Попробуй позже.')
    return
  }

  const sName = escapeHtmlTg(student.full_name || student.contact_info || studentNick)
  const cName = escapeHtmlTg(curator.full_name || curator.contact_info || curatorNick)
  await sendTelegramMessage(
    chatId,
    `✅ <b>${sName}</b> переведён к куратору <b>${cName}</b>.`,
  )
}

// ─── /stats — статистика потока ──────────────────────────────────────────

interface StatsFilter {
  type: 'city' | 'country' | 'month' | null
  value: string | null
}

function parseStatsFilter(args: string): StatsFilter {
  const parts = args.trim().split(/\s+/)
  if (parts.length >= 2) {
    const key = parts[0].toLowerCase()
    const val = parts.slice(1).join(' ')
    if (key === 'city') return { type: 'city', value: val }
    if (key === 'country') return { type: 'country', value: val }
    if (key === 'month') return { type: 'month', value: val }
  }
  return { type: null, value: null }
}

async function handleStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
  args: string,
  isOwner: boolean,
): Promise<void> {
  const filter = parseStatsFilter(args)

  // Базовый запрос студентов; владелец (is_protected) видит всех включая скрытых
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('profiles')
    .select('id, city_id, country_id, course_started_at')
    .eq('role', 'student')
  if (!isOwner) query = query.eq('hidden_from_tracking', false)

  // Применяем фильтр по месяцу на стороне JS (нет простого ilike на timestamptz)
  const { data: rawStudents, error: studentsErr } = await query

  if (studentsErr) {
    console.error('[webhook/stats] students query error:', studentsErr)
    await sendTelegramMessage(chatId, 'Ошибка при загрузке статистики.')
    return
  }

  type RawStudent = {
    id: string
    city_id: number | null
    country_id: number | null
    course_started_at: string | null
  }

  let students = (rawStudents ?? []) as RawStudent[]

  // Фильтр по месяцу
  if (filter.type === 'month' && filter.value) {
    students = students.filter(
      (s) => s.course_started_at && s.course_started_at.startsWith(filter.value!),
    )
  }

  const studentIds = students.map((s) => s.id)
  const total = students.length

  if (total === 0) {
    const filterDesc =
      filter.type === 'month'
        ? ` за ${escapeHtmlTg(filter.value ?? '')}`
        : filter.type === 'city'
          ? ` в городе ${escapeHtmlTg(filter.value ?? '')}`
          : filter.type === 'country'
            ? ` в стране ${escapeHtmlTg(filter.value ?? '')}`
            : ''
    await sendTelegramMessage(chatId, `Учеников${filterDesc} не найдено.`)
    return
  }

  // Загружаем города и страны для join на стороне JS
  const [citiesRes, countriesRes] = await Promise.all([
    supabase.from('cities').select('id, name_ru, country_id') as Promise<{
      data: { id: number; name_ru: string; country_id: number }[] | null
    }>,
    supabase.from('countries').select('id, name_ru') as Promise<{
      data: { id: number; name_ru: string }[] | null
    }>,
  ])

  const citiesMap = new Map<number, { name_ru: string; country_id: number }>(
    (citiesRes.data ?? []).map((c) => [c.id, { name_ru: c.name_ru, country_id: c.country_id }]),
  )
  const countriesMap = new Map<number, string>(
    (countriesRes.data ?? []).map((c) => [c.id, c.name_ru]),
  )

  // Применяем фильтр по городу / стране
  let filteredStudents = students
  if (filter.type === 'city' && filter.value) {
    const fVal = filter.value.toLowerCase()
    filteredStudents = students.filter((s) => {
      if (!s.city_id) return false
      const city = citiesMap.get(s.city_id)
      return city?.name_ru.toLowerCase().includes(fVal)
    })
  } else if (filter.type === 'country' && filter.value) {
    const fVal = filter.value.toLowerCase()
    filteredStudents = students.filter((s) => {
      // Страна либо напрямую в profiles.country_id, либо через city.country_id
      const directCountry = s.country_id ? countriesMap.get(s.country_id) : null
      if (directCountry && directCountry.toLowerCase().includes(fVal)) return true
      if (s.city_id) {
        const city = citiesMap.get(s.city_id)
        const cityCountry = city ? countriesMap.get(city.country_id) : null
        if (cityCountry && cityCountry.toLowerCase().includes(fVal)) return true
      }
      return false
    })
  }

  const filteredIds = filteredStudents.map((s) => s.id)
  const filteredTotal = filteredStudents.length

  // Учатся = course_started_at IS NOT NULL
  const inProgress = filteredStudents.filter((s) => s.course_started_at !== null).length

  // «Сдали курс» — blocks_passed >= 10 по дневной модели через RPC passed_blocks_all
  let finished = 0
  if (filteredIds.length > 0) {
    const { data: passedAllData, error: passedAllErr } = (await supabase.rpc('passed_blocks_all')) as {
      data: { user_id: string; blocks_passed: number }[] | null
      error: unknown
    }
    if (passedAllErr) {
      console.error('[webhook/stats] passed_blocks_all rpc error', passedAllErr)
    }
    const filteredIdSet = new Set(filteredIds)
    finished = (passedAllData ?? []).filter(
      (r) => filteredIdSet.has(r.user_id) && r.blocks_passed >= 10,
    ).length
  }

  // По городам (топ-10)
  const cityCount: Record<string, number> = {}
  for (const s of filteredStudents) {
    const cityName = s.city_id ? (citiesMap.get(s.city_id)?.name_ru ?? 'Без города') : 'Без города'
    cityCount[cityName] = (cityCount[cityName] ?? 0) + 1
  }
  const sortedCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1])
  const top10Cities = sortedCities.slice(0, 10)
  const otherCitiesCount = sortedCities.slice(10).reduce((s, [, c]) => s + c, 0)

  // По странам
  const countryCount: Record<string, number> = {}
  for (const s of filteredStudents) {
    let countryName: string | null = null
    if (s.country_id) {
      countryName = countriesMap.get(s.country_id) ?? null
    }
    if (!countryName && s.city_id) {
      const city = citiesMap.get(s.city_id)
      countryName = city ? (countriesMap.get(city.country_id) ?? null) : null
    }
    countryName = countryName ?? 'Неизвестно'
    countryCount[countryName] = (countryCount[countryName] ?? 0) + 1
  }
  const sortedCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1])

  // Формируем сообщение
  const filterTitle =
    filter.type === 'month'
      ? ` · ${escapeHtmlTg(filter.value ?? '')}`
      : filter.type === 'city'
        ? ` · город ${escapeHtmlTg(filter.value ?? '')}`
        : filter.type === 'country'
          ? ` · страна ${escapeHtmlTg(filter.value ?? '')}`
          : ''

  const citiesBlock = top10Cities
    .map(([name, cnt]) => `  ${escapeHtmlTg(name)}: ${cnt}`)
    .join('\n')
  const otherCitiesLine = otherCitiesCount > 0 ? `\n  прочие: ${otherCitiesCount}` : ''

  const countriesBlock = sortedCountries
    .map(([name, cnt]) => `  ${escapeHtmlTg(name)}: ${cnt}`)
    .join('\n')

  const msg =
    `<b>Статистика потока${filterTitle}</b>\n\n` +
    `👥 Всего учеников: <b>${filteredTotal}</b>\n` +
    `📖 Учатся сейчас: <b>${inProgress}</b>\n` +
    `🏆 Сдали курс: <b>${finished}</b>\n` +
    `🔄 В процессе: <b>${inProgress - finished}</b>\n\n` +
    `<b>По городам:</b>\n${citiesBlock}${otherCitiesLine}\n\n` +
    `<b>По странам:</b>\n${countriesBlock}`

  await sendTelegramMessage(chatId, msg)
}

// ─── /delete @ученик ─────────────────────────────────────────────────────

async function handleDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
  args: string,
): Promise<void> {
  const rawNick = args.trim().replace(/^@+/, '').toLowerCase()
  if (!rawNick) {
    await sendTelegramMessage(chatId, 'Укажи ник ученика:\n<code>/delete @ник</code>')
    return
  }

  const handle = `@${rawNick}`
  const { data: student } = (await supabase
    .from('profiles')
    .select('id, full_name, contact_info, is_protected')
    .eq('role', 'student')
    .ilike('contact_info', handle)
    .maybeSingle()) as {
    data: {
      id: string
      full_name: string | null
      contact_info: string | null
      is_protected: boolean | null
    } | null
  }

  if (!student) {
    await sendTelegramMessage(
      chatId,
      `Ученик ${escapeHtmlTg(handle)} не найден.`,
    )
    return
  }

  if (student.is_protected) {
    await sendTelegramMessage(chatId, '🔒 Защищённого пользователя нельзя удалить.')
    return
  }

  const displayName = escapeHtmlTg(student.full_name || student.contact_info || rawNick)

  await sendTelegramMessage(chatId, `Удалить ученика <b>${displayName}</b>?`, {
    inlineKeyboard: [
      [
        { text: `🗑 Удалить ${displayName}`, callback_data: `del_student:${student.id}` },
        { text: 'Отмена', callback_data: `del_cancel:_` },
      ],
    ],
  })
}

// ─── Хелпер: парсинг @ников из произвольного текста ─────────────────────

function parseHandles(rawText: string): string[] {
  return Array.from(
    new Set(
      rawText
        .split(/[\s,\n]+/)
        .map((t) => t.trim().replace(/^@+/, '').toLowerCase())
        .filter((t) => /^[a-z0-9_]{4,32}$/.test(t))
        .map((t) => `@${t}`),
    ),
  )
}

// ─── Лидеры города: сохранить ники в pending и показать города кнопками ──

async function promptLeaderCity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
  handles: string[],
): Promise<void> {
  if (handles.length === 0) {
    await sendTelegramMessage(chatId, 'Ник не распознан. Формат: @ник (латиница, цифры, _).')
    return
  }
  const { data: cityRows } = await supabase.from('cities').select('id, name_ru').order('name_ru')
  const cities = (cityRows ?? []) as { id: number; name_ru: string }[]
  if (cities.length === 0) {
    await supabase.from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
    await sendTelegramMessage(chatId, 'Городов нет — добавь город в /panel.')
    return
  }
  // Ники переносим в pending до нажатия кнопки города (callback не вмещает список).
  await supabase
    .from('bot_pending_action')
    .upsert({
      telegram_chat_id: chatId,
      action: 'addleader_city',
      payload: handles.join(' '),
      created_at: new Date().toISOString(),
    })
  const rows: InlineKeyboardButton[][] = []
  for (let i = 0; i < cities.length; i += 2) {
    rows.push(
      cities.slice(i, i + 2).map((c) => ({
        text: c.name_ru,
        callback_data: `addleader_city:${c.id}`,
      })),
    )
  }
  const list = handles.map((h) => escapeHtmlTg(h)).join(', ')
  await sendTelegramMessage(
    chatId,
    `👑 Лидеры города (${handles.length}): ${list}\nВыбери город для них:`,
    { inlineKeyboard: rows },
  )
}

// ─── Общий хелпер добавления ников (ученики / кураторы) ──────────────────

async function processAddNicks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chatId: number,
  adminProfile: { id: string; role: string; full_name: string | null; contact_info: string | null },
  rawText: string,
  role: 'student' | 'curator',
): Promise<number> {
  const handles = parseHandles(rawText)
  if (handles.length === 0) return 0

  const added: string[] = []
  for (const handle of handles) {
    const { data: existing } = await supabase
      .from('testing_whitelist')
      .select('id')
      .ilike('telegram_username', handle)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('testing_whitelist')
        .update({ claimed_chat_id: null, assign_role: role === 'curator' ? 'curator' : null })
        .eq('id', (existing as { id: number }).id)
    } else {
      await supabase
        .from('testing_whitelist')
        .insert({
          telegram_username: handle,
          assign_role: role === 'curator' ? 'curator' : null,
          added_by: adminProfile.id,
        })
    }

    if (role === 'curator') {
      await supabase
        .from('profiles')
        .update({ role: 'curator' })
        .ilike('contact_info', handle)
        .eq('role', 'student')
    }

    added.push(handle)
  }

  const roleLabel = role === 'curator' ? 'кураторы' : 'ученики'
  const addedList = added.map((h) => escapeHtmlTg(h)).join(', ')
  await sendTelegramMessage(
    chatId,
    `✅ Добавлены как ${roleLabel} (${added.length}):\n${addedList}`,
  )

  const adminName = escapeHtmlTg(adminProfile.full_name || adminProfile.contact_info || 'Админ')
  const notifyText =
    role === 'curator'
      ? added.length === 1
        ? `🧭 ${adminName} добавил куратора ${addedList}`
        : `🧭 ${adminName} добавил кураторов (${added.length}): ${addedList}`
      : added.length === 1
        ? `👤 ${adminName} добавил ученика ${addedList}`
        : `👤 ${adminName} добавил учеников (${added.length}): ${addedList}`

  const adminChatIds = await getAdminChatIds(supabase)
  await Promise.all(
    adminChatIds.filter((cid) => cid !== chatId).map((cid) => sendTelegramMessage(cid, notifyText)),
  )

  return added.length
}

// ─── HTTP handlers ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Validate webhook secret if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  // callback_query — обработка нажатия inline-кнопок
  if (update.callback_query) {
    try {
      await handleCallbackQuery(update.callback_query)
    } catch (err) {
      console.error('[webhook] handleCallbackQuery error:', err)
    }
    return NextResponse.json({ ok: true })
  }

  // Only process messages with text
  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  // Нормализуем лишние ведущие слеши: «//attach», «///add» → «/attach», «/add»
  const text = message.text.trim().replace(/^\/+/, '/')

  // /addcurator @nick — добавить кураторов по нику (assign_role=curator). Только admin/super_admin.
  // ВАЖНО: проверяется ДО /add (иначе /add перехватит).
  if (text.startsWith('/addcurator') || text.startsWith('/add_curator')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: adminProfile } = (await supabase
      .from('profiles')
      .select('id, role, full_name, contact_info')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as {
      data: { id: string; role: string; full_name: string | null; contact_info: string | null } | null
    }
    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      await sendTelegramMessage(chatId, 'Команда доступна только администраторам.')
      return NextResponse.json({ ok: true })
    }

    const afterCmd = text.replace(/^\/\S+\s*/, '')
    const handles = parseHandles(afterCmd)

    if (handles.length === 0) {
      // Ников нет — сохраняем pending и просим прислать следующим сообщением
      await (supabase as any)
        .from('bot_pending_action')
        .upsert({ telegram_chat_id: chatId, action: 'addcurator', created_at: new Date().toISOString() })
      await sendTelegramMessage(
        chatId,
        'Ок! Пришли список ников следующим сообщением (через пробел/запятую/с новой строки).',
      )
      return NextResponse.json({ ok: true })
    }

    // Ники есть — обрабатываем сразу, сбрасываем возможный pending
    await (supabase as any).from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
    await processAddNicks(supabase, chatId, adminProfile, afterCmd, 'curator')
    return NextResponse.json({ ok: true })
  }

  // /addleader @nick1 @nick2 — назначить лидеров города. Только admin/super_admin.
  // Ники (один или несколько) → затем выбор города кнопками (один город на партию).
  // ВАЖНО: проверяется ДО /add (иначе /add перехватит «/addleader»).
  if (text.startsWith('/addleader') || text.startsWith('/add_leader')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: adminProfile } = (await supabase
      .from('profiles')
      .select('id, role')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as { data: { id: string; role: string } | null }
    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      await sendTelegramMessage(chatId, 'Команда доступна только администраторам.')
      return NextResponse.json({ ok: true })
    }

    const afterCmd = text.replace(/^\/\S+\s*/, '')
    const handles = parseHandles(afterCmd)
    if (handles.length === 0) {
      // Ников нет — ждём список следующим сообщением (как /addcurator).
      await supabase
        .from('bot_pending_action')
        .upsert({ telegram_chat_id: chatId, action: 'addleader', payload: null, created_at: new Date().toISOString() })
      await sendTelegramMessage(
        chatId,
        'Ок! Пришли ник или ники лидеров (через пробел/запятую/с новой строки) следующим сообщением.',
      )
      return NextResponse.json({ ok: true })
    }

    // Ники есть — сохраняем и показываем города кнопками.
    await promptLeaderCity(supabase, chatId, handles)
    return NextResponse.json({ ok: true })
  }

  // /add @nick1 @nick2 — добавить учеников по нику. Только admin/super_admin.
  if (text.startsWith('/add')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: adminProfile } = (await supabase
      .from('profiles')
      .select('id, role, full_name, contact_info')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as {
      data: { id: string; role: string; full_name: string | null; contact_info: string | null } | null
    }
    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      await sendTelegramMessage(chatId, 'Команда доступна только администраторам.')
      return NextResponse.json({ ok: true })
    }

    const afterCmd = text.slice(4) // убираем '/add'
    const handles = parseHandles(afterCmd)

    if (handles.length === 0) {
      // Ников нет — сохраняем pending и просим прислать следующим сообщением
      await (supabase as any)
        .from('bot_pending_action')
        .upsert({ telegram_chat_id: chatId, action: 'add', created_at: new Date().toISOString() })
      await sendTelegramMessage(
        chatId,
        'Ок! Пришли список ников следующим сообщением (через пробел/запятую/с новой строки).',
      )
      return NextResponse.json({ ok: true })
    }

    // Ники есть — обрабатываем сразу, сбрасываем возможный pending
    await (supabase as any).from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
    await processAddNicks(supabase, chatId, adminProfile, afterCmd, 'student')
    return NextResponse.json({ ok: true })
  }

  // /attach @куратор @ученик1 @ученик2 — массовая привязка учеников к куратору
  if (text.startsWith('/attach')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const adminProf = await getAdminProfile(supabase, chatId)
    if (!adminProf) {
      await sendTelegramMessage(chatId, 'Команда только для администраторов.')
      return NextResponse.json({ ok: true })
    }
    const handles = parseHandles(text.replace(/^\/\S+\s*/, ''))
    if (handles.length < 2) {
      await sendTelegramMessage(
        chatId,
        'Формат:\n<code>/attach @куратор @ученик1 @ученик2</code>\nПервый ник — куратор, остальные — ученики.',
      )
      return NextResponse.json({ ok: true })
    }
    const [curatorHandle, ...studentHandles] = handles
    const { data: curator } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('contact_info', curatorHandle)
      .in('role', ['curator', 'admin', 'super_admin'])
      .maybeSingle()
    if (!curator) {
      await sendTelegramMessage(
        chatId,
        `Куратор ${escapeHtmlTg(curatorHandle)} не найден. Он должен сначала зайти в бота как куратор.`,
      )
      return NextResponse.json({ ok: true })
    }
    const { attached, pending } = await attachStudentsToCurator(
      supabase,
      (curator as { id: string }).id,
      studentHandles,
      adminProf.id,
    )
    const cName = (curator as { full_name: string | null }).full_name || curatorHandle
    const parts = [`✅ Привязка к <b>${escapeHtmlTg(cName)}</b>:`]
    if (attached.length)
      parts.push(`Привязано сейчас (${attached.length}): ${attached.map((h) => escapeHtmlTg(h)).join(', ')}`)
    if (pending.length)
      parts.push(`Привяжутся при входе (${pending.length}): ${pending.map((h) => escapeHtmlTg(h)).join(', ')}`)
    await sendTelegramMessage(chatId, parts.join('\n\n'))
    return NextResponse.json({ ok: true })
  }

  // /panel (или /site, /dashboard) — ссылка-вход в веб-дашборд (только admin/super_admin)
  if (text.startsWith('/panel') || text.startsWith('/site') || text.startsWith('/dashboard')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: prof } = (await supabase
      .from('profiles')
      .select('id, role, full_name, city_id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as {
      data: { id: string; role: string; full_name: string | null; city_id: number | null } | null
    }

    if (!prof || !['admin', 'super_admin', 'curator', 'city_leader'].includes(prof.role)) {
      await sendTelegramMessage(
        chatId,
        'Веб-дашборд доступен только админам, лидерам городов и кураторам.',
      )
      return NextResponse.json({ ok: true })
    }

    const token = signLoginToken({
      uid: prof.id,
      role: prof.role as AdminRole,
      name: prof.full_name,
      city: prof.city_id ?? null,
    })
    const url = `${SITE_URL}/panel/enter?token=${encodeURIComponent(token)}`
    await sendTelegramMessage(
      chatId,
      '🌐 <b>Веб-дашборд</b>\n\nНажми кнопку — откроется уже залогиненным. Ссылка действует 10 минут.',
      { inlineKeyboard: [[{ text: '🌐 Открыть веб-дашборд', url }]] },
    )
    return NextResponse.json({ ok: true })
  }

  // /curators — список всех кураторов и их учеников (только admin/super_admin)
  if (text.startsWith('/curators')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const adminProf = await getAdminProfile(supabase, chatId)
    if (!adminProf) {
      await sendTelegramMessage(chatId, 'Команда только для администраторов.')
      return NextResponse.json({ ok: true })
    }
    await handleCurators(supabase, chatId)
    return NextResponse.json({ ok: true })
  }

  // /students — список учеников (curator / admin / super_admin)
  // ВАЖНО: /students проверяется ДО /student
  if (text.startsWith('/students')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name, is_protected')
      .eq('telegram_chat_id', chatId)
      .maybeSingle() as { data: { id: string; role: string; full_name: string | null; is_protected: boolean | null } | null }

    if (!profile) {
      await sendTelegramMessage(
        chatId,
        'Сначала открой приложение командой /start.',
        { withMiniAppButton: true },
      )
      return NextResponse.json({ ok: true })
    }

    const allowedRoles = ['curator', 'admin', 'super_admin']
    if (!allowedRoles.includes(profile.role)) {
      await sendTelegramMessage(
        chatId,
        'Команда /students доступна только наставникам.',
      )
      return NextResponse.json({ ok: true })
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
    const isOwner = !!(profile as any).is_protected
    const students = await loadStudentsSummary(
      supabase,
      isAdmin ? { all: true, isOwner } : { curatorId: profile.id, isOwner },
    )
    const replyText = formatStudentsList(students, isAdmin)
    await sendTelegramMessage(chatId, replyText, { withMiniAppButton: true })
    return NextResponse.json({ ok: true })
  }

  // /student @ник — детальный прогресс одного ученика
  // Проверяется ПОСЛЕ /students (иначе "/students" совпал бы с префиксом).
  if (text.startsWith('/student')) {
    const arg = text.slice('/student'.length).trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: profile } = (await supabase
      .from('profiles')
      .select('id, role, is_protected')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as { data: { id: string; role: string; is_protected: boolean | null } | null }

    if (!profile || !['curator', 'admin', 'super_admin'].includes(profile.role)) {
      await sendTelegramMessage(chatId, 'Команда доступна только наставникам.')
      return NextResponse.json({ ok: true })
    }
    if (!arg) {
      await sendTelegramMessage(chatId, 'Укажи ник: <code>/student @ivan</code>')
      return NextResponse.json({ ok: true })
    }
    const detail = await formatStudentDetail(
      supabase,
      { id: profile.id, role: profile.role, isOwner: !!(profile as any).is_protected },
      arg,
    )
    await sendTelegramMessage(chatId, detail, { withMiniAppButton: true })
    return NextResponse.json({ ok: true })
  }

  // /stats [city|country|month <значение>] — статистика потока (только admin/super_admin)
  if (text.startsWith('/stats')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const adminProf = await getAdminProfile(supabase, chatId)
    if (!adminProf) {
      await sendTelegramMessage(chatId, 'Команда только для администраторов.')
      return NextResponse.json({ ok: true })
    }
    const args = text.slice('/stats'.length).trim()
    await handleStats(supabase, chatId, args, adminProf.isOwner)
    return NextResponse.json({ ok: true })
  }

  // /transfer @ученик @куратор — перевод ученика (только admin/super_admin)
  if (text.startsWith('/transfer')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const adminProf = await getAdminProfile(supabase, chatId)
    if (!adminProf) {
      await sendTelegramMessage(chatId, 'Команда только для администраторов.')
      return NextResponse.json({ ok: true })
    }
    const args = text.slice('/transfer'.length).trim()
    await handleTransfer(supabase, chatId, args)
    return NextResponse.json({ ok: true })
  }

  // /delete @ученик — удаление ученика с подтверждением (только admin/super_admin)
  if (text.startsWith('/delete')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const adminProf = await getAdminProfile(supabase, chatId)
    if (!adminProf) {
      await sendTelegramMessage(chatId, 'Команда только для администраторов.')
      return NextResponse.json({ ok: true })
    }
    const args = text.slice('/delete'.length).trim()
    await handleDelete(supabase, chatId, args)
    return NextResponse.json({ ok: true })
  }

  // /help — помощь и связь с разработчиком
  if (text.startsWith('/help')) {
    await sendTelegramMessage(
      chatId,
      `<b>Помощь ✝️</b>\n\nНужна помощь или нашёл ошибку — напиши разработчику: @Rogue02\n\nВнутри приложения тоже есть кнопка «Помощь и поддержка».`,
      { withMiniAppButton: true },
    )
    return NextResponse.json({ ok: true })
  }

  // /progress — мой прогресс
  if (text.startsWith('/progress')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()
    if (!profile) {
      await sendTelegramMessage(chatId, `Сначала открой приложение командой /start.`, {
        withMiniAppButton: true,
      })
      return NextResponse.json({ ok: true })
    }
    const [passedAllRes, { data: act }] = await Promise.all([
      supabase.rpc('passed_blocks_all') as Promise<{
        data: { user_id: string; blocks_passed: number }[] | null
        error: unknown
      }>,
      supabase
        .from('student_daily_activity')
        .select('activity_date')
        .eq('user_id', profile.id)
        .eq('opened', true),
    ])
    if (passedAllRes.error) console.error('[webhook/progress] passed_blocks_all error', passedAllRes.error)
    const passedRow = (passedAllRes.data ?? []).find((r) => r.user_id === profile.id)
    const passed = passedRow?.blocks_passed ?? 0
    const streak = computeActivity(
      ((act ?? []) as { activity_date: string }[]).map((r) => r.activity_date),
      [],
      7,
    ).streak
    await sendTelegramMessage(
      chatId,
      `<b>Твой прогресс ✝️</b>\n\nПройдено блоков: <b>${passed} из 10</b>\nДней подряд: <b>${streak}</b>\n\nПродолжай — день начинается с вечера 🙏`,
      { withMiniAppButton: true },
    )
    return NextResponse.json({ ok: true })
  }

  // Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const arg = parts.length > 1 ? parts.slice(1).join(' ').trim() : null

    // /start ref_<token> — приглашение от церкви
    let refToken: string | null = null
    if (arg && arg.startsWith('ref_')) {
      refToken = arg.slice(4)
    }

    const emailArg = arg && arg.includes('@') ? arg : null

    if (emailArg) {
      // /start email@example.com — link account by email
      try {
        const supabase = createServiceSupabase()

        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('id, email, telegram_chat_id')
          .eq('email', emailArg.toLowerCase())
          .single()

        if (findError || !profile) {
          await sendTelegramMessage(
            chatId,
            `<b>Аккаунт не найден</b>\n\nПользователь с email <code>${emailArg}</code> не зарегистрирован на платформе КРЕСТ.\n\nСначала зарегистрируйтесь на сайте, затем вернитесь сюда.`,
          )
          return NextResponse.json({ ok: true })
        }

        if (profile.telegram_chat_id && profile.telegram_chat_id === chatId) {
          await sendTelegramMessage(
            chatId,
            `<b>Уже подключено!</b>\n\nВаш Telegram уже связан с аккаунтом КРЕСТ.`,
          )
          return NextResponse.json({ ok: true })
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: chatId })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Failed to update telegram_chat_id:', updateError)
          await sendTelegramMessage(
            chatId,
            `<b>Ошибка</b>\n\nНе удалось связать аккаунт. Попробуйте позже.`,
          )
          return NextResponse.json({ ok: true })
        }

        await sendTelegramMessage(
          chatId,
          `<b>Аккаунт подключен!</b>\n\nВы будете получать уведомления об одобрении блоков лидером.\n\nУдачи в прохождении курса КРЕСТ!`,
        )
      } catch (error) {
        console.error('Error linking Telegram account:', error)
        await sendTelegramMessage(chatId, `<b>Ошибка</b>\n\nПроизошла ошибка. Попробуйте позже.`)
      }
    } else {
      // /start без аргументов или с ref-токеном церкви
      const welcomeText = refToken
        ? `<b>Добро пожаловать в КРЕСТ! ✝️</b>\n\nВас пригласила церковь-партнёр.\n\nОткройте приложение и пройдите 10 блоков знакомства с верой — с живым наставником и в кругу таких же ищущих.`
        : `<b>Добро пожаловать в КРЕСТ! ✝️</b>\n\nПлатформа для изучения Креста.\n\n<b>Что внутри:</b>\n• 10 блоков для изучения\n• Видео-уроки и конспекты\n• Практика по каждому блоку\n\nНажмите кнопку ниже, чтобы открыть приложение.`

      await sendTelegramMessage(chatId, welcomeText, {
        withMiniAppButton: true,
        ...(refToken ? { inlineKeyboard: undefined } : {}),
      })
    }

    return NextResponse.json({ ok: true })
  }

  // Handle other messages
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any

    // ── Проверяем pending_action (команда без ников, ники обещали прислать) ──
    const PENDING_TTL_MS = 15 * 60 * 1000 // 15 минут
    const { data: pending } = (await supabase
      .from('bot_pending_action')
      .select('action, created_at')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()) as {
      data: { action: string; created_at: string } | null
    }

    if (pending) {
      const age = Date.now() - new Date(pending.created_at).getTime()
      if (age > PENDING_TTL_MS) {
        // Устарело — удаляем, идём дальше
        await supabase.from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
      } else if (pending.action === 'addleader' || pending.action === 'addleader_city') {
        // Лидеры города: ждём ники (addleader) или нажатие кнопки города (addleader_city).
        const adminProfile = (await getAdminProfile(supabase, chatId)) as {
          id: string
          role: string
        } | null
        if (adminProfile) {
          const handles = parseHandles(text)
          if (handles.length > 0) {
            await promptLeaderCity(supabase, chatId, handles)
          } else {
            await sendTelegramMessage(
              chatId,
              pending.action === 'addleader_city'
                ? 'Выбери город кнопкой 👆 или пришли ник(и) лидеров заново.'
                : 'Пришли ник или ники лидеров (через пробел/запятую/с новой строки).',
            )
          }
          return NextResponse.json({ ok: true })
        }
        // Не админ — чистим pending, продолжаем обычным ответом
        await supabase.from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
      } else {
        // Проверяем, есть ли в тексте хоть один допустимый ник
        const hasNick = parseHandles(text).length > 0
        if (hasNick) {
          // Проверяем права отправителя
          const adminProfile = (await getAdminProfile(supabase, chatId)) as {
            id: string
            role: string
          } | null

          if (adminProfile) {
            // Догружаем full_name и contact_info для уведомления
            const { data: fullAdminData } = (await supabase
              .from('profiles')
              .select('id, role, full_name, contact_info')
              .eq('telegram_chat_id', chatId)
              .maybeSingle()) as {
              data: {
                id: string
                role: string
                full_name: string | null
                contact_info: string | null
              } | null
            }

            const role: 'student' | 'curator' =
              pending.action === 'addcurator' ? 'curator' : 'student'

            await supabase.from('bot_pending_action').delete().eq('telegram_chat_id', chatId)

            if (fullAdminData) {
              await processAddNicks(supabase, chatId, fullAdminData, text, role)
            }
            return NextResponse.json({ ok: true })
          }
        }
        // Ников нет (или нет прав) — удаляем pending, продолжаем обычным ответом
        await supabase.from('bot_pending_action').delete().eq('telegram_chat_id', chatId)
      }
    }

    // ── Обычный ответ на произвольное сообщение ───────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', chatId)
      .single()

    if (profile) {
      await sendTelegramMessage(
        chatId,
        `<b>Привет, ${(profile as { full_name: string | null }).full_name || 'ученик'}!</b>\n\nВаш аккаунт подключен. Вы получите уведомление, когда лидер одобрит ваш блок.`,
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `<b>Аккаунт не подключен</b>\n\nОтправьте команду:\n<code>/start ваш@email.com</code>\n\nчтобы связать Telegram с аккаунтом КРЕСТ.`,
      )
    }
  } catch (error) {
    console.error('Error checking profile:', error)
  }

  return NextResponse.json({ ok: true })
}

// Handle GET requests (Telegram webhook verification)
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook endpoint active' })
}
