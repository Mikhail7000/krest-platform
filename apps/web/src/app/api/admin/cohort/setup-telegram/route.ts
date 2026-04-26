import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Подключение Telegram-группы к когорте.
 *
 * ВАЖНО: Telegram Bot API не позволяет создавать группы программно.
 * Пастор делает это вручную:
 *  1. Создаёт супер-группу в Telegram
 *  2. Добавляет @cross_bot как администратора (с правом создавать invite-links)
 *  3. Получает chat_id (через @userinfobot или отправкой сообщения боту)
 *  4. Через UI пастор привязывает chat_id к конкретной cohort
 *
 * Этот endpoint:
 *  - Создаёт invite-link через Telegram Bot API (createChatInviteLink)
 *  - Сохраняет chat_id и invite_link в cohorts
 *  - Студенты при join получают эту ссылку автоматически
 *
 * POST /api/admin/cohort/setup-telegram
 * Body: { cohort_id, telegram_chat_id }
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { cohort_id, telegram_chat_id } = await request.json() as {
      cohort_id: string
      telegram_chat_id: number
    }

    if (!cohort_id || !telegram_chat_id) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'cohort_id and telegram_chat_id required' } }, { status: 400 })
    }

    // Создаём invite-link через Telegram Bot API
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return NextResponse.json({ error: { code: 'NO_BOT_TOKEN', message: 'Bot не настроен' } }, { status: 500 })
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_chat_id,
        name: `КРЕСТ Cohort ${cohort_id.slice(0, 8)}`,
        member_limit: 12,
      }),
    })

    const tgJson = await tgRes.json() as { ok: boolean; result?: { invite_link: string }; description?: string }

    if (!tgJson.ok || !tgJson.result?.invite_link) {
      return NextResponse.json({
        error: {
          code: 'TELEGRAM_ERROR',
          message: tgJson.description || 'Не удалось создать ссылку. Проверьте, что бот — администратор группы.',
        },
      }, { status: 500 })
    }

    const inviteLink = tgJson.result.invite_link

    // Сохраняем в cohorts
    const { error: updateError } = await supabaseAdmin
      .from('cohorts')
      .update({
        telegram_chat_id,
        telegram_invite_link: inviteLink,
      })
      .eq('id', cohort_id)

    if (updateError) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      data: { cohort_id, telegram_chat_id, invite_link: inviteLink },
    })
  } catch (e) {
    console.error('cohort setup-telegram error', e)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, { status: 500 })
  }
}
