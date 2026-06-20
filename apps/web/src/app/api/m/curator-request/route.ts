import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram/init-data'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { createServiceSupabase } from '@/lib/supabase-service'
import { getAdminChatIds } from '@/lib/telegram/admin-recipients'

export const dynamic = 'force-dynamic'

/**
 * POST /api/m/curator-request
 *
 * Шаг онбординга «ваш наставник»: ученик вводит ник Telegram своего куратора.
 * - Если ник совпал с кем-то из кураторов → привязываем curator_id автоматически.
 * - В любом случае шлём владельцу платформы заявку с ником куратора (он сверяет/привязывает).
 *
 * Body: { initData, curator_nick }
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      curator_nick?: string
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

    const nick = (body.curator_nick ?? '').trim().replace(/^@+/, '').toLowerCase()
    if (!/^[a-z0-9_]{4,32}$/.test(nick)) {
      return NextResponse.json(
        { error: { code: 'BAD_NICK', message: 'Некорректный ник' } },
        { status: 400 },
      )
    }
    const curatorHandle = `@${nick}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any

    // Ученик (по chat_id) — для имени и привязки
    const { data: student } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', valid.chatId)
      .maybeSingle()

    // Куратор по нику (contact_info), регистронезависимо
    const { data: curator } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'curator')
      .ilike('contact_info', curatorHandle)
      .maybeSingle()

    let linked = false
    if (curator && student) {
      await supabase.from('profiles').update({ curator_id: curator.id }).eq('id', student.id)
      linked = true
    }

    const studentName = escapeHtml(
      student?.full_name ||
        [valid.firstName, valid.lastName].filter(Boolean).join(' ') ||
        'Ученик',
    )
    const studentHandle = valid.username ? `@${escapeHtml(valid.username)}` : 'без username'
    const text =
      `👤 <b>Ученик указал куратора</b>\n\n` +
      `${studentName} (${studentHandle}) выбрал наставника: <b>${escapeHtml(curatorHandle)}</b>\n\n` +
      (linked
        ? `✅ Привязал автоматически к ${escapeHtml(curator.full_name || curatorHandle)}.`
        : `⚠️ Куратора с таким ником пока нет в системе — привяжи вручную или добавь его.`)

    // Уведомление о выборе наставника — ВСЕМ админам (super_admin + admin)
    const adminChatIds = await getAdminChatIds(supabase)
    await Promise.all(adminChatIds.map((cid) => sendTelegramMessage(cid, text)))

    return NextResponse.json({ ok: true, linked })
  } catch (err) {
    console.error('[curator-request]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
