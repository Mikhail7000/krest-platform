/**
 * Серверная проверка доступа к блоку через SQL-функцию is_block_unlocked.
 *
 * Функция is_block_unlocked(p_user_id, p_block_id) возвращает TRUE если:
 *   - order_num блока <= 1 (первый блок всегда открыт), ИЛИ
 *   - profiles.can_skip_block_lock = TRUE (тестировщик / admin), ИЛИ
 *   - NOW() >= profiles.course_started_at + (order_num - 1) * 7 дней.
 *
 * EXECUTE выдан только service_role — используем createServiceSupabase().
 *
 * Fail-closed: при ошибке RPC возвращаем false (блок закрыт), чтобы не
 * допускать несанкционированного прохождения при деградации БД.
 */

import { createServiceSupabase } from '@/lib/supabase-service'

export async function isBlockUnlocked(
  userId: string,
  blockId: number,
): Promise<boolean> {
  try {
    const supabase = createServiceSupabase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('is_block_unlocked', {
      p_user_id: userId,
      p_block_id: blockId,
    })

    if (error) {
      console.error('[block-gate] is_block_unlocked rpc error:', error)
      return false // fail-closed
    }

    return data === true
  } catch (err) {
    console.error('[block-gate] is_block_unlocked unexpected error:', err)
    return false // fail-closed
  }
}
