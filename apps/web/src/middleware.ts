import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function createMiddlewareSupabase(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  return { supabase, supabaseResponse }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Miniapp static files — bypass auth entirely (внутренний JS-гейт по chat_id)
  if (pathname.startsWith('/miniapp/')) {
    return NextResponse.next()
  }

  // API routes — handle their own auth (или service role)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Maintenance gate — блокирует весь Next.js фронтенд кроме /maintenance
  // Bypass: query ?bypass=<MAINTENANCE_BYPASS_TOKEN> ставит cookie crest_bypass
  const MAINTENANCE_ON = process.env.MAINTENANCE_MODE === 'true'
  if (MAINTENANCE_ON && pathname !== '/maintenance') {
    const expected = process.env.MAINTENANCE_BYPASS_TOKEN || ''
    const queryToken = request.nextUrl.searchParams.get('bypass') || ''
    const cookieToken = request.cookies.get('crest_bypass')?.value || ''

    const allowed = expected !== '' && (queryToken === expected || cookieToken === expected)

    if (allowed) {
      const res = NextResponse.next()
      if (queryToken === expected && cookieToken !== expected) {
        res.cookies.set('crest_bypass', expected, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          secure: true,
        })
      }
      return res
    }

    return NextResponse.redirect(new URL('/maintenance', request.url))
  }

  const { supabase, supabaseResponse } = createMiddlewareSupabase(request)

  const { data: { user } } = await supabase.auth.getUser()

  // Public routes (no auth required)
  if (pathname === '/login' || pathname === '/register-church') {
    if (user) {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    return supabaseResponse
  }

  // Landing page — public for all (logged-in users see it too if they go to /)
  if (pathname === '/') {
    return supabaseResponse
  }

  // Protected routes - require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|miniapp/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
}
