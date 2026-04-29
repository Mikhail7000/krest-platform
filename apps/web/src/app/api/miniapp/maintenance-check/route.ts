import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const MAINTENANCE_ON = process.env.MAINTENANCE_MODE === 'true'

  if (!MAINTENANCE_ON) {
    return NextResponse.json({ allowed: true, maintenance: false })
  }

  const ALLOWED = (process.env.MAINTENANCE_ALLOWED_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!BOT_TOKEN || ALLOWED.length === 0) {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'config' })
  }

  let initData = ''
  try {
    const body = (await request.json()) as { initData?: string }
    initData = body.initData || ''
  } catch {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'no_init_data' })
  }

  if (!initData) {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'no_init_data' })
  }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'no_hash' })
  }
  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== hash) {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'bad_hmac' })
  }

  const userJson = params.get('user')
  if (!userJson) {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'no_user' })
  }

  let tgId = 0
  try {
    const u = JSON.parse(userJson) as { id?: number }
    tgId = u.id || 0
  } catch {
    return NextResponse.json({ allowed: false, maintenance: true, reason: 'bad_user' })
  }

  const allowed = ALLOWED.includes(String(tgId))
  return NextResponse.json({ allowed, maintenance: true, reason: allowed ? 'whitelisted' : 'not_whitelisted' })
}
