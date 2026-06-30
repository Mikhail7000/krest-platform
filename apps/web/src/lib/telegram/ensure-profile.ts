import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { createServiceSupabase } from '@/lib/supabase-service'
import { sendTelegramMessage, escapeHtml } from './send'
import { getAdminChatIds } from './admin-recipients'

/**
 * Гарантирует, что у whitelisted Telegram-пользователя есть профиль.
 *
 * Доступ ведётся в testing_whitelist по username (@handle). При первом входе
 * профиль создаётся автоматически (signUp → триггер handle_new_user), а слот
 * whitelist «занимается» текущим chat_id (claimed_chat_id). После этого доступ
 * привязан к конкретному аккаунту.
 *
 * Незнакомые пользователи (не в whitelist) получают заявку access_requests,
 * которая одобряется/отклоняется через Telegram inline-кнопки админом.
 */

const PRIVILEGED_ROLES = new Set(['super_admin', 'admin', 'curator'])

export type EnsureProfileResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; code: string; message: string }

// ─── Вспомогательные типы для access_requests ─────────────────────────────

interface AccessRequest {
  id: string
  telegram_chat_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_role: 'student' | 'curator' | 'city_leader' | null
  approved_city_id?: number | null
}

// ─── Переиспользуемое создание Telegram-профиля ───────────────────────────

export interface CreateTelegramProfileParams {
  chatId: number
  username: string | null
  firstName: string | null
  lastName: string | null
  /** Если передан — после создания ставится этот role (ПОСЛЕ триггера, отдельным update). */
  role?: 'student' | 'curator' | 'city_leader'
  /** Город (для куратора/лидера, если задан при одобрении заявки). */
  cityId?: number | null
  /** Скрыть из общего трекинга (скрытые тестировщики, напр. единичка). */
  hidden?: boolean
}

/**
 * Создаёт auth-пользователя + профиль для Telegram-юзера.
 * При «уже зарегистрирован» — входит через signInWithPassword.
 * Возвращает { ok: true, userId } или ошибку.
 */
export async function createTelegramProfile(
  params: CreateTelegramProfileParams,
): Promise<EnsureProfileResult> {
  const { chatId, username, firstName, lastName, role, cityId, hidden } = params
  const service = createServiceSupabase()

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!botToken || !url || !anonKey) {
    return { ok: false, status: 500, code: 'CONFIG_ERROR', message: 'Server configuration error' }
  }

  const anon = createClient(url, anonKey)
  const techEmail = `tg${chatId}@krest.local`
  const password = createHmac('sha256', botToken).update(`tg-pwd-${chatId}`).digest('hex').slice(0, 32)
  const handle = username ? `@${username}` : null
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram ${chatId}`

  // Попытка signUp
  const signUp = await anon.auth.signUp({
    email: techEmail,
    password,
    options: { data: { full_name: fullName } },
  })
  let userId = signUp.data?.user?.id

  if (!userId) {
    // Уже зарегистрирован — войти существующим
    const signIn = await anon.auth.signInWithPassword({ email: techEmail, password })
    userId = signIn.data?.user?.id
  }

  if (!userId) {
    return { ok: false, status: 500, code: 'AUTH_FAILED', message: 'Не удалось создать аккаунт' }
  }

  // Базовый update профиля (триггер handle_new_user уже создал запись)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any).from('profiles').update({
    telegram_chat_id: chatId,
    full_name: fullName,
    is_whitelisted: true,
    ...(handle ? { contact_info: handle } : {}),
    ...(hidden ? { hidden_from_tracking: true } : {}),
  }).eq('id', userId)

  // Если нужна конкретная роль/город — ставим отдельным update ПОСЛЕ триггера,
  // чтобы триггер apply_whitelist_role не перезаписал curator → student и т.п.
  if (role || cityId != null) {
    const patch: Record<string, unknown> = {}
    if (role) patch.role = role
    if (cityId != null) patch.city_id = cityId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: patchErr } = await (service as any).from('profiles').update(patch).eq('id', userId)
    // Не глушим: невалидный city_id (FK) иначе оставил бы профиль без роли/города,
    // а вызывающий счёл бы создание успешным.
    if (patchErr) {
      console.error('[ensure-profile] role/city patch failed:', patchErr)
      return {
        ok: false,
        status: 400,
        code: 'PROFILE_PATCH_FAILED',
        message: 'Не удалось задать роль/город (проверьте город)',
      }
    }
  }

  return { ok: true, userId }
}

// ─── Уведомление админу с кнопками решения ────────────────────────────────

async function notifyAdminsAboutRequest(
  request: AccessRequest,
): Promise<void> {
  // Получатели = все админы (super_admin + admin) с привязанным Telegram.
  // Fallback на ADMIN_TELEGRAM_CHAT_IDS внутри хелпера, если в БД пусто.
  const service = createServiceSupabase()
  const adminChatIds = await getAdminChatIds(service)

  // parse_mode=HTML — экранируем user-controlled значения, иначе символ < > & в
  // имени/нике даёт Telegram 400 и уведомление о заявке молча теряется.
  const name = escapeHtml(
    [request.first_name, request.last_name].filter(Boolean).join(' ') || 'Без имени',
  )
  const usernameStr = request.username ? `@${escapeHtml(request.username)}` : 'нет username'

  const text =
    `👤 <b>Новая заявка на доступ</b>\n\n` +
    `Имя: ${name}\n` +
    `Username: ${usernameStr}\n` +
    `Chat id: ${request.telegram_chat_id}`

  const inlineKeyboard = [[
    { text: '✅ Впустить учеником', callback_data: `approve_student:${request.id}` },
  ], [
    { text: '👤 Сделать куратором', callback_data: `approve_curator:${request.id}` },
  ], [
    { text: '👑 Лидером города',    callback_data: `leader_pick:${request.id}` },
  ], [
    { text: '✖️ Отклонить',         callback_data: `reject:${request.id}` },
  ]]

  await Promise.all(
    adminChatIds.map((cid) => sendTelegramMessage(cid, text, { inlineKeyboard })),
  )
}

// ─── Основная функция ──────────────────────────────────────────────────────

export async function ensureWhitelistedProfile(params: {
  chatId: number
  username: string | null
  firstName: string | null
  lastName: string | null
}): Promise<EnsureProfileResult> {
  const { chatId, username, firstName, lastName } = params
  const service = createServiceSupabase()

  // 1. Профиль уже существует по chat_id
  const { data: existing } = await service
    .from('profiles')
    .select('id, role, is_whitelisted')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  // Привилегированные/уже whitelisted — пускаем сразу
  if (existing) {
    const privileged = existing.role !== null && PRIVILEGED_ROLES.has(existing.role)
    if (privileged || existing.is_whitelisted === true) {
      return { ok: true, userId: existing.id }
    }
  }

  // 2. Проверяем whitelist по username (и для новых, и для существующих но не whitelisted)
  if (username) {
    const handle = `@${username}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: slot } = await (service as any)
      .from('testing_whitelist')
      .select('id, claimed_chat_id, hidden, assigned_curator_id')
      .ilike('telegram_username', handle) // ники Telegram регистронезависимы
      .maybeSingle()

    if (slot) {
      // Слот занят другим аккаунтом
      if (slot.claimed_chat_id && slot.claimed_chat_id !== chatId) {
        return {
          ok: false,
          status: 403,
          code: 'SLOT_TAKEN',
          message: 'Доступ по этому username уже активирован другим аккаунтом.',
        }
      }

      // 3a. Профиль уже есть — проставляем whitelist, занимаем слот
      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (service as any)
          .from('profiles')
          .update({
            is_whitelisted: true,
            contact_info: handle,
            ...(slot.hidden ? { hidden_from_tracking: true } : {}),
            ...(slot.assigned_curator_id ? { curator_id: slot.assigned_curator_id } : {}),
          })
          .eq('id', existing.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (service as any)
          .from('testing_whitelist')
          .update({ claimed_chat_id: chatId })
          .eq('id', slot.id)
        return { ok: true, userId: existing.id }
      }

      // 3b. Профиля нет — создаём через общую функцию (с переносом флага hidden)
      const created = await createTelegramProfile({
        chatId,
        username,
        firstName,
        lastName,
        hidden: slot.hidden === true,
      })
      if (!created.ok) return created

      // Привязка к куратору, если задана при массовой привязке (/attach)
      if (slot.assigned_curator_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (service as any)
          .from('profiles')
          .update({ curator_id: slot.assigned_curator_id })
          .eq('id', created.userId)
      }

      // Занимаем слот whitelist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any)
        .from('testing_whitelist')
        .update({ claimed_chat_id: chatId })
        .eq('id', slot.id)

      return { ok: true, userId: created.userId }
    }
  }

  // 4. Не в whitelist — проверяем access_requests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingReq } = await (service as any)
    .from('access_requests')
    .select('id, status, approved_role, approved_city_id, first_name, last_name, username')
    .eq('telegram_chat_id', chatId)
    .maybeSingle() as { data: AccessRequest | null }

  // Если заявка уже одобрена и профиль не создан — создаём профиль сейчас
  // (роль + город из заявки, чтобы лидер/куратор получил свой город).
  if (existingReq?.status === 'approved' && existingReq.approved_role && !existing) {
    return createTelegramProfile({
      chatId,
      username,
      firstName,
      lastName,
      role: existingReq.approved_role,
      cityId: existingReq.approved_city_id ?? null,
    })
  }

  // Pending-заявка уже есть — не спамим, просто возвращаем WAITLIST
  if (existingReq?.status === 'pending') {
    return {
      ok: false,
      status: 403,
      code: 'WAITLIST',
      message: 'Заявка отправлена. Как только наставник одобрит — придёт уведомление в этого бота, и ты сможешь начать.',
    }
  }

  // Нет заявки (или rejected → переподаём) — создаём/обновляем запись и уведомляем
  const name = [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram ${chatId}`

  let requestId: string

  if (!existingReq) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newReq, error: insertErr } = await (service as any)
      .from('access_requests')
      .insert({
        telegram_chat_id: chatId,
        username: username ?? null,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        status: 'pending',
      })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }

    if (insertErr || !newReq) {
      console.error('[ensure-profile] insert access_requests failed:', insertErr)
      return {
        ok: false,
        status: 403,
        code: 'WAITLIST',
        message: 'Заявка отправлена. Как только наставник одобрит — придёт уведомление в этого бота, и ты сможешь начать.',
      }
    }
    requestId = newReq.id
  } else {
    // Rejected → сбрасываем в pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from('access_requests')
      .update({
        status: 'pending',
        username: username ?? null,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        decided_by: null,
        decided_at: null,
        approved_role: null,
      })
      .eq('id', existingReq.id)
    requestId = existingReq.id
  }

  // Отправляем уведомление с кнопками всем админам
  const requestForNotify: AccessRequest = {
    id: requestId,
    telegram_chat_id: chatId,
    username: username ?? null,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    status: 'pending',
    approved_role: null,
  }
  notifyAdminsAboutRequest(requestForNotify).catch((e) =>
    console.error('[ensure-profile] notifyAdmins failed:', e),
  )

  void name // переменная объявлена но не используется в теле (использовалась для fallback имени)

  return {
    ok: false,
    status: 403,
    code: 'WAITLIST',
    message: 'Заявка отправлена. Как только наставник одобрит — придёт уведомление в этого бота, и ты сможешь начать.',
  }
}
