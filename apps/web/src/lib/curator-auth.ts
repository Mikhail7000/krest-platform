import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export type CuratorRole = 'curator' | 'admin' | 'super_admin'

const CURATOR_ROLES: CuratorRole[] = ['curator', 'admin', 'super_admin']

/**
 * Guard для curator endpoints в Telegram MiniApp.
 * Авторизация через Telegram initData (как весь /m/*), т.к. в miniapp нет
 * cookie-сессии Supabase. initData передаётся в заголовке X-Init-Data.
 * Возвращает service-supabase (RLS минуется) — доступ ограничиваем в коде:
 * curator видит только своих (curator_id), admin/super_admin — всех.
 */
export async function requireCuratorViaInitData(
  initData: string,
): Promise<{ curator: AuthedCurator } | { errorResponse: NextResponse }> {
  const auth = await resolveUserId(initData)
  if (!auth.ok) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: auth.code, message: auth.message } },
        { status: auth.status },
      ),
    }
  }

  const supabase = createServiceSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  const role = profile?.role as CuratorRole | undefined
  if (!role || !CURATOR_ROLES.includes(role)) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Curator role required' } },
        { status: 403 },
      ),
    }
  }

  return { curator: { userId: auth.userId, role, supabase } }
}

export interface AuthedCurator {
  userId: string
  role: CuratorRole
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}

/**
 * Guard для curator endpoints.
 * Возвращает { curator } или { errorResponse } (если доступ запрещён).
 * Использовать в каждом curator API route:
 *
 *   const auth = await requireCuratorAuth()
 *   if ('errorResponse' in auth) return auth.errorResponse
 *   const { userId, role, supabase } = auth.curator
 */
export async function requireCuratorAuth(): Promise<
  { curator: AuthedCurator } | { errorResponse: NextResponse }
> {
  const supabase = await createServerSupabase()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      ),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('id, role')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } },
        { status: 403 },
      ),
    }
  }

  const validRoles: CuratorRole[] = ['curator', 'admin', 'super_admin']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!validRoles.includes((profile as any).role as CuratorRole)) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Curator role required' } },
        { status: 403 },
      ),
    }
  }

  return {
    curator: {
      userId: authData.user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: (profile as any).role as CuratorRole,
      supabase,
    },
  }
}
