import { NextResponse } from 'next/server'
import { createServerSupabase } from './supabase-server'

export type SuperAdminRole = 'super_admin'

export type AuthedSuperAdmin = {
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}

export async function requireSuperAdmin(): Promise<
  | { superAdmin: AuthedSuperAdmin }
  | { errorResponse: NextResponse }
> {
  try {
    const supabase = await createServerSupabase()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return {
        errorResponse: NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          { status: 401 }
        ),
      }
    }

    const userId = userData.user.id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return {
        errorResponse: NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } },
          { status: 404 }
        ),
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((profile as any).role !== 'super_admin') {
      return {
        errorResponse: NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Super admin role required' } },
          { status: 403 }
        ),
      }
    }

    return {
      superAdmin: {
        userId,
        supabase,
      },
    }
  } catch (err) {
    console.error('[requireSuperAdmin]', err)
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        { status: 500 }
      ),
    }
  }
}
