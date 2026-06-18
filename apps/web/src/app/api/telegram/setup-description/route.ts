/**
 * GET /api/telegram/setup-description
 * Устанавливает описание и короткое описание бота через Telegram Bot API.
 * Вызвать вручную один раз после деплоя.
 *
 * ЗАЩИТА: передать ?secret=<CRON_SECRET> или заголовок x-cron-secret.
 * Если CRON_SECRET не задан в env — запрос пропускается без проверки
 * (только для локальной отладки; в продакшне CRON_SECRET обязателен).
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DESCRIPTION = `✝️ Платформа для изучения Креста

Что вас ждёт внутри:
• 10 последовательных блоков для изучения
• Видео-уроки и подробные конспекты
• Практические задания по каждому блоку для закрепления материала

Чтобы начать обучение, нажмите кнопку «СТАРТ» 👆`

const SHORT_DESCRIPTION =
  '✝️ Платформа для изучения Креста — 10 блоков, видео-уроки и практика'

// 68 символов — в пределах лимита 120

export async function GET(req: NextRequest) {
  // --- Защита эндпоинта ---
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const fromQuery = req.nextUrl.searchParams.get('secret')
    const fromHeader = req.headers.get('x-cron-secret')
    if (fromQuery !== cronSecret && fromHeader !== cronSecret) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }
  // ВНИМАНИЕ: если CRON_SECRET не задан — эндпоинт открыт.
  // Обязательно задайте CRON_SECRET в Vercel env для продакшна.

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'NO_BOT_TOKEN' }, { status: 500 })
  }

  const base = `https://api.telegram.org/bot${token}`

  // 1. setMyDescription — длинное описание (≤512 символов, 247 символов)
  const descRes = await fetch(`${base}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: DESCRIPTION }),
  })
  const descData = await descRes.json().catch(() => ({}))

  // 2. setMyShortDescription — короткое описание (≤120 символов, 68 символов)
  const shortRes = await fetch(`${base}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ short_description: SHORT_DESCRIPTION }),
  })
  const shortData = await shortRes.json().catch(() => ({}))

  const allOk = descRes.ok && shortRes.ok

  return NextResponse.json(
    {
      ok: allOk,
      results: {
        setMyDescription: { ok: descRes.ok, telegram: descData },
        setMyShortDescription: { ok: shortRes.ok, telegram: shortData },
      },
    },
    { status: allOk ? 200 : 500 },
  )
}
