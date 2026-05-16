import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../packages/supabase/src/types'

/**
 * Service-role клиент Supabase. Обходит RLS — server-only.
 * Использовать только из API routes / server actions / скриптов.
 *
 * Не использовать в Client Components, middleware, любом коде,
 * который собирается в браузерный бандл. Утечка ключа компрометирует БД.
 */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
