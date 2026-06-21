/**
 * Массовая привязка учеников к куратору (по никам Telegram).
 * Общая логика для бота (/attach) и веб-панели (/api/panel/actions/attach).
 *
 * Для каждого ника:
 *  • заносим/обновляем слот в testing_whitelist с assigned_curator_id
 *    (ученик может зайти, и привязка проставится при входе);
 *  • если профиль уже есть — сразу ставим curator_id.
 */

const HANDLE_RE = /^[a-z0-9_]{4,32}$/

/** Парсит сырой текст в массив уникальных @ников (lowercase). */
export function parseHandles(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^@+/, '').toLowerCase())
        .filter((t) => HANDLE_RE.test(t))
        .map((t) => `@${t}`),
    ),
  )
}

export interface AttachResult {
  attached: string[] // профиль был — curator_id проставлен сразу
  pending: string[] // профиля нет — привяжется при входе
}

export async function attachStudentsToCurator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  curatorId: string,
  handles: string[],
  addedBy: string,
): Promise<AttachResult> {
  const attached: string[] = []
  const pending: string[] = []

  for (const handle of handles) {
    // 1. Слот whitelist: создать или обновить assigned_curator_id
    const { data: existing } = await supabase
      .from('testing_whitelist')
      .select('id')
      .ilike('telegram_username', handle)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('testing_whitelist')
        .update({ assigned_curator_id: curatorId })
        .eq('id', (existing as { id: number }).id)
    } else {
      await supabase
        .from('testing_whitelist')
        .insert({
          telegram_username: handle,
          assign_role: null,
          assigned_curator_id: curatorId,
          added_by: addedBy,
        })
    }

    // 2. Если профиль уже есть — привязываем сразу
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .ilike('contact_info', handle)
      .maybeSingle()

    if (prof) {
      await supabase.from('profiles').update({ curator_id: curatorId }).eq('id', (prof as { id: string }).id)
      attached.push(handle)
    } else {
      pending.push(handle)
    }
  }

  return { attached, pending }
}
