import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Маркер для проверки, что свежий деплой выехал. Публичный, без секретов.
export function GET() {
  return NextResponse.json({ ok: true, marker: 'dc1', commit: '1d64920' })
}
