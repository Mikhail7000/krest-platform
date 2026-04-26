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

  // Miniapp static files — bypass auth entirely
  if (pathname.startsWith('/miniapp/')) {
    return NextResponse.next()
  }

  // API routes — handle their own auth (or operate with service role)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
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
