import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '../../../../packages/supabase/src/types'

export type { Database }
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Block = Database['public']['Tables']['blocks']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row']
export type StudentProgress = Database['public']['Tables']['student_progress']['Row']

export const createServerSupabase = async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore set errors
          }
        },
      },
    }
  )
}
