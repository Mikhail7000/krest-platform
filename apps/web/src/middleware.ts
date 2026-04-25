import { createMiddlewareSupabase } from '@krest/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createMiddlewareSupabase(request)

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes
  if (pathname === '/login' || pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/student', request.url))
    }
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
