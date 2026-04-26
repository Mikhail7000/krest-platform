import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { name, email, contact, source, detail } = await request.json() as {
      name: string
      email: string
      contact: string
      source: string
      detail: string
    }

    // Get all admin telegram_chat_ids
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id, full_name')
      .eq('role', 'admin')
      .not('telegram_chat_id', 'is', null)

    if (!admins || admins.length === 0) {
      return NextResponse.json({ ok: true, note: 'no admins with telegram' })
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    const text = `🆕 <b>Новый студент зарегистрировался!</b>\n\n` +
      `👤 <b>${name}</b>\n` +
      `📧 ${email}\n` +
      `📱 Контакт: ${contact}\n\n` +
      `📣 Откуда узнал: <b>${source}</b>\n` +
      `💬 Подробнее: ${detail}`

    await Promise.all(admins.map(admin =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: admin.telegram_chat_id,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{
              text: '👥 Открыть панель лидера',
              web_app: { url: 'https://krest-platform-web.vercel.app/miniapp/admin.html' }
            }]]
          }
        })
      })
    ))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('notify-registration error', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
