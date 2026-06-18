import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram/init-data'
import { sendTelegramMessage } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/m/location-request
 *
 * Пользователь в онбординге нажал «нет моей страны/города» → шлём заявку
 * с его ником владельцу платформы (ADMIN_TELEGRAM_CHAT_IDS) в Telegram-бот.
 *
 * Body: { initData, kind?: 'country' | 'city' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      kind?: 'country' | 'city'
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Server configuration error' } },
        { status: 500 },
      )
    }

    const valid = validateTelegramInitData(body.initData ?? '', botToken)
    if (!valid.ok) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: valid.reason } },
        { status: 401 },
      )
    }

    const name = [valid.firstName, valid.lastName].filter(Boolean).join(' ') || 'Без имени'
    const handle = valid.username ? `@${valid.username}` : 'без username'
    const what =
      body.kind === 'country' ? 'страну' : body.kind === 'city' ? 'город' : 'страну/город'

    const text =
      `📍 <b>Заявка на локацию</b>\n\n` +
      `${name} (${handle}, chat_id <code>${valid.chatId}</code>) просит добавить свою ${what} — её нет в списке онбординга.`

    const adminChatIds = (process.env.ADMIN_TELEGRAM_CHAT_IDS || '255214568')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))

    await Promise.all(adminChatIds.map((cid) => sendTelegramMessage(cid, text)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[location-request]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
