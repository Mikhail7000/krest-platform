import { sendTelegramMessage, escapeHtml } from '@/lib/telegram/send'

/**
 * Если ученик ТОЛЬКО ЧТО закрыл день (все 4 источника за дату localDate) — шлёт
 * его куратору уведомление в Telegram. Идемпотентно: один раз на (ученик, дата)
 * через UNIQUE в curator_notify_state. Best-effort, ошибки глушатся.
 *
 * Вызывать fire-and-forget из submit-роутов после успешной записи практики.
 */
export async function notifyCuratorIfDayClosed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  localDate: string,
): Promise<void> {
  try {
    const { data: closed } = await supabase.rpc('is_day_closed', {
      p_user_id: userId,
      p_d: localDate,
    })
    if (!closed) return

    // Идемпотентность: если строка уже есть — день уже отмечен, не дублируем.
    const { error: insErr } = await supabase
      .from('curator_notify_state')
      .insert({ student_id: userId, event_type: 'day_closed', event_key: localDate })
    if (insErr) return // конфликт UNIQUE → уже уведомляли

    const { data: stu } = await supabase
      .from('profiles')
      .select('full_name, contact_info, curator_id')
      .eq('id', userId)
      .maybeSingle()
    if (!stu?.curator_id) return

    const { data: cur } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', stu.curator_id)
      .maybeSingle()
    const chatId =
      cur?.telegram_chat_id != null && Number.isFinite(Number(cur.telegram_chat_id))
        ? Number(cur.telegram_chat_id)
        : null
    if (!chatId) return

    const name = stu.full_name || stu.contact_info || 'Ученик'
    await sendTelegramMessage(chatId, `✅ <b>${escapeHtml(name)}</b> закрыл(а) день (${localDate}).`)
    await supabase.from('notifications_log').insert({
      user_id: userId,
      channel: 'telegram',
      type: 'curator_day_closed',
      status: 'sent',
    })
  } catch (e) {
    console.error('[curator day-closed notify]', e)
  }
}
