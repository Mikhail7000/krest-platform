import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { createServiceSupabase } from '@/lib/supabase-service'

/**
 * Гарантирует, что у whitelisted Telegram-пользователя есть профиль.
 *
 * Доступ ведётся в testing_whitelist по username (@handle). При первом входе
 * профиль создаётся автоматически (signUp → триггер handle_new_user), а слот
 * whitelist «занимается» текущим chat_id (claimed_chat_id). После этого доступ
 * привязан к конкретному аккаунту: даже если username освободится, второй
 * человек по этому слоту не войдёт.
 */

const PRIVILEGED_ROLES = new Set(['super_admin', 'admin', 'curator'])

const WAITLIST_MESSAGE =
  'Платформа ещё не открыта публично. Спасибо что ждёшь — мы скоро откроемся.'

export type EnsureProfileResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; code: string; message: string }

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

  // 2. Доступ ведётся по username — проверяем whitelist (и для новых, и для
  //    уже существующих, но ещё не whitelisted профилей).
  if (!username) {
    return {
      ok: false,
      status: 400,
      code: 'NO_USERNAME',
      message: 'Установите username в профиле Telegram, чтобы получить доступ.',
    }
  }
  const handle = `@${username}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slot } = await (service as any)
    .from('testing_whitelist')
    .select('id, claimed_chat_id')
    .eq('telegram_username', handle)
    .maybeSingle()

  if (!slot) {
    return { ok: false, status: 403, code: 'WAITLIST', message: WAITLIST_MESSAGE }
  }
  if (slot.claimed_chat_id && slot.claimed_chat_id !== chatId) {
    return {
      ok: false,
      status: 403,
      code: 'SLOT_TAKEN',
      message: 'Доступ по этому username уже активирован другим аккаунтом.',
    }
  }

  // 3a. Профиль уже есть — проставляем whitelist + тестовый байпас, занимаем слот
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from('profiles')
      .update({ is_whitelisted: true, can_skip_block_lock: true, contact_info: handle })
      .eq('id', existing.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from('testing_whitelist')
      .update({ claimed_chat_id: chatId })
      .eq('id', slot.id)
    return { ok: true, userId: existing.id }
  }

  // 3b. Профиля нет — создаём auth-пользователя (профиль создаст триггер)
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!botToken || !url || !anonKey) {
    return { ok: false, status: 500, code: 'CONFIG_ERROR', message: 'Server configuration error' }
  }

  const anon = createClient(url, anonKey)
  const techEmail = `tg${chatId}@krest.local`
  const password = createHmac('sha256', botToken).update(`tg-pwd-${chatId}`).digest('hex').slice(0, 32)
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram ${chatId}`

  const signUp = await anon.auth.signUp({
    email: techEmail,
    password,
    options: { data: { full_name: fullName } },
  })
  let userId = signUp.data?.user?.id

  if (!userId) {
    // already registered → войти существующим
    const signIn = await anon.auth.signInWithPassword({ email: techEmail, password })
    userId = signIn.data?.user?.id
  }

  if (!userId) {
    return { ok: false, status: 500, code: 'AUTH_FAILED', message: 'Не удалось создать аккаунт' }
  }

  // 4. Обновляем профиль: привязка chat_id + whitelist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      full_name: fullName,
      is_whitelisted: true,
      can_skip_block_lock: true,
      contact_info: handle,
    })
    .eq('id', userId)

  // 5. Занимаем слот whitelist за этим chat_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from('testing_whitelist')
    .update({ claimed_chat_id: chatId })
    .eq('id', slot.id)

  return { ok: true, userId }
}
