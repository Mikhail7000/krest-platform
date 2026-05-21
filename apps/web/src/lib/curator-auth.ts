import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export type CuratorRole = 'curator' | 'admin' | 'super_admin'

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
