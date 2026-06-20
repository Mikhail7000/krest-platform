// Получатели уведомлений бота = ТОЛЬКО админы (super_admin + admin).
// Ученики (role=student) НИКОГДА не должны получать административные уведомления.

/** Fallback chat_id владельца, если в БД ещё нет привязанных админов. */
function envFallbackChatIds(): number[] {
  return (process.env.ADMIN_TELEGRAM_CHAT_IDS || '255214568')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))
}

/**
 * Возвращает chat_id всех админов платформы (super_admin + admin),
 * у которых привязан Telegram. Если в БД таких нет — fallback на
 * ADMIN_TELEGRAM_CHAT_IDS (владелец), чтобы уведомления не терялись.
 *
 * Принимает service-клиент Supabase (нетипизированный — таблицы через as any).
 */
export async function getAdminChatIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .in('role', ['admin', 'super_admin'])
      .not('telegram_chat_id', 'is', null)

    if (error) {
      console.error('[admin-recipients] query error:', error)
      return envFallbackChatIds()
    }

    const ids = Array.from(
      new Set(
        ((data ?? []) as { telegram_chat_id: number | string | null }[])
          .map((r) => Number(r.telegram_chat_id))
          .filter((n) => Number.isFinite(n) && n !== 0),
      ),
    )

    return ids.length > 0 ? ids : envFallbackChatIds()
  } catch (e) {
    console.error('[admin-recipients] unexpected error:', e)
    return envFallbackChatIds()
  }
}
