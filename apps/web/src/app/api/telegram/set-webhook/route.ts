/**
 * GET /api/telegram/set-webhook
 * Одноразовая установка Telegram-вебхука БЕЗ ручного curl. Токен и секрет берутся
 * из env сервера — вставлять их не нужно. Достаточно открыть ссылку в браузере.
 *
 * Доступ: super_admin (cookie сессии /panel) ИЛИ ?key=<CRON_SECRET>.
 * URL вебхука = текущий origin + /api/telegram/webhook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  const key = req.nextUrl.searchParams.get('key')
  const cronSecret = process.env.CRON_SECRET
  const authorized = session?.role === 'super_admin' || (!!cronSecret && key === cronSecret)
  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: 'Не авторизовано: войди в /panel как super_admin или добавь ?key=<CRON_SECRET>' },
      { status: 403 },
    )
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN не задан в env' }, { status: 500 })
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  const webhookUrl = `${req.nextUrl.origin}/api/telegram/webhook`
  const params = new URLSearchParams({ url: webhookUrl, drop_pending_updates: 'true' })
  if (secret) params.set('secret_token', secret)

  let telegram: unknown = null
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`)
    telegram = await tgRes.json()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'Не удалось вызвать Telegram API', detail: String(e) },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, requested_url: webhookUrl, secret_used: !!secret, telegram })
}
