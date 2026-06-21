/**
 * resolveIsOwner — проверяет, является ли пользователь владельцем платформы.
 * Владелец = единственный профиль с is_protected=TRUE (Михаил).
 * Используется в API-роутах панели для решения: показывать скрытых учеников или нет.
 *
 * Намеренно не кешируется в сессии: is_protected — привилегированный флаг,
 * не должен храниться в cookie-токене во избежание подделки.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveIsOwner(supabase: any, uid: string): Promise<boolean> {
  const { data } = (await supabase
    .from('profiles')
    .select('is_protected')
    .eq('id', uid)
    .maybeSingle()) as { data: { is_protected: boolean | null } | null }
  return !!(data as any)?.is_protected
}
