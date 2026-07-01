import { resolveIsOwner } from './owner'

/**
 * Персональный замок владельца: профили с owner_locked=TRUE может изменять
 * (роль, куратор, город, удаление, whitelist-слот) ТОЛЬКО владелец платформы
 * (профиль с is_protected=TRUE, Михаил). Используется во всех мутирующих
 * роутах панели и обработчиках Telegram-бота.
 *
 * Отличие от is_protected: is_protected защищает владельца от всех,
 * owner_locked — аккаунт от всех, кроме владельца.
 */

export const OWNER_LOCKED_ERROR =
  'Этого пользователя может изменять только владелец платформы'

/**
 * true = действие НАДО заблокировать: среди целей есть замкнутый профиль,
 * а актор — не владелец.
 */
export async function ownerLockBlocksIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  actorUid: string,
  targetIds: string[],
): Promise<boolean> {
  if (targetIds.length === 0) return false
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', targetIds)
    .eq('owner_locked', true)
    .limit(1)
  // Fail-closed: сбой БД = «замок есть» — иначе транзиентная ошибка снимала бы защиту.
  if (error) return true
  if (!data || (data as unknown[]).length === 0) return false
  return !(await resolveIsOwner(supabase, actorUid))
}

/**
 * Какие из @ников принадлежат замкнутым профилям (для username-путей:
 * whitelist-добавления, /attach, /transfer по никам). Возвращает []
 * если актор — владелец (ему можно всё).
 */
export async function ownerLockedHandles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  actorUid: string,
  handles: string[],
): Promise<string[]> {
  if (handles.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('contact_info')
    .eq('owner_locked', true)
  // Fail-closed: сбой БД = блокируем все ники, а не пропускаем молча.
  if (error) return handles
  const locked = new Set(
    ((data ?? []) as { contact_info: string | null }[])
      .map((r) => (r.contact_info ?? '').toLowerCase())
      .filter(Boolean),
  )
  const hit = handles.filter((h) => locked.has(h.toLowerCase()))
  if (hit.length === 0) return []
  return (await resolveIsOwner(supabase, actorUid)) ? [] : hit
}
