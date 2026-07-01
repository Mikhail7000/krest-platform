import { sendTelegramMessage, escapeHtml } from '@/lib/telegram/send'
import { getAdminChatIds } from '@/lib/telegram/admin-recipients'

/**
 * Если ученик ТОЛЬКО ЧТО закрыл день (все 4 источника за дату localDate) — шлёт
 * его куратору уведомление в Telegram; при достижении 7/7 дней блока — отдельное
 * событие «блок готов к сдаче» (куратору, а без куратора — админам), чтобы ключевой
 * момент не тонул в потоке одинаковых «закрыл день».
 * Идемпотентно: раз на (ученик, событие, ключ) через UNIQUE в curator_notify_state.
 * Best-effort, ошибки глушатся. Вызывать fire-and-forget из submit-роутов.
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

    const { data: stu } = await supabase
      .from('profiles')
      .select('full_name, contact_info, curator_id')
      .eq('id', userId)
      .maybeSingle()
    const name = stu?.full_name || stu?.contact_info || 'Ученик'

    // Чат куратора (может отсутствовать — ученик без куратора).
    let curatorChat: number | null = null
    if (stu?.curator_id) {
      const { data: cur } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', stu.curator_id)
        .maybeSingle()
      curatorChat =
        cur?.telegram_chat_id != null && Number.isFinite(Number(cur.telegram_chat_id))
          ? Number(cur.telegram_chat_id)
          : null
    }

    // 1) «Закрыл день» — только куратору, раз на (ученик, дата).
    const { error: insErr } = await supabase
      .from('curator_notify_state')
      .insert({ student_id: userId, event_type: 'day_closed', event_key: localDate })
    if (!insErr && curatorChat) {
      await sendTelegramMessage(curatorChat, `✅ <b>${escapeHtml(name)}</b> закрыл(а) день (${localDate}).`)
      await supabase.from('notifications_log').insert({
        user_id: userId,
        channel: 'telegram',
        type: 'curator_day_closed',
        status: 'sent',
      })
    }

    // 2) «7/7 — блок готов к сдаче» — раз на блок.
    await notifyBlockReady(supabase, userId, name, curatorChat)
  } catch (e) {
    console.error('[curator day-closed notify]', e)
  }
}

/** Блок достиг 7/7 закрытых дней → пуш куратору (без куратора — админам). */
async function notifyBlockReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  name: string,
  curatorChat: number | null,
): Promise<void> {
  const { data: cd } = await supabase.rpc('user_closed_days', { p_user_id: userId })
  const ready = ((cd ?? []) as { block_id: number; days: number }[]).filter(
    (r) => Number(r.days) >= 7,
  )
  for (const r of ready) {
    // Идемпотентность: UNIQUE(student, event_type, event_key=block_id).
    const { error } = await supabase
      .from('curator_notify_state')
      .insert({ student_id: userId, event_type: 'block_ready', event_key: String(r.block_id) })
    if (error) continue // уже уведомляли

    const { data: blk } = await supabase
      .from('blocks')
      .select('order_num, title_ru')
      .eq('id', r.block_id)
      .maybeSingle()
    const label = blk?.order_num != null ? `Блок ${blk.order_num}` : 'Блок'
    const title = blk?.title_ru ? ` «${escapeHtml(blk.title_ru)}»` : ''
    const text = `🎓 <b>${escapeHtml(name)}</b> закрыл(а) 7/7 дней — ${label}${title} готов к сдаче. Договоритесь о встрече.`

    const targets: number[] = curatorChat ? [curatorChat] : await getAdminChatIds(supabase)
    await Promise.all(targets.map((c) => sendTelegramMessage(c, text)))
    await supabase.from('notifications_log').insert({
      user_id: userId,
      channel: 'telegram',
      type: 'curator_block_ready',
      status: 'sent',
    })
  }
}
