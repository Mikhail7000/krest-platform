import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `PRESENT (${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8)}...${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-4)}, len=${process.env.SUPABASE_SERVICE_ROLE_KEY.length})`
      : 'MISSING',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'PRESENT' : 'MISSING',
  })
}
