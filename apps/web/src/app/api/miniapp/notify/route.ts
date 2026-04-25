import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { access_token, block_num, block_name, student_name, preview } =
      await request.json() as {
        access_token: string
        block_num: number
        block_name: string
        student_name: string
        preview: string
      }

    // Verify token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token)
    if (error || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Get leader chat_id via RPC (bypasses RLS)
    const { data: chatId } = await supabaseAdmin.rpc('get_leader_chat_id', {
      student_id: user.id
    })

    if (!chatId) {
      return NextResponse.json({ error: 'NO_LEADER' }, { status: 404 })
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    const text = `📝 <b>Новый ответ студента</b>\n\n👤 <b>${student_name}</b>\n📖 Блок ${block_num}: ${block_name}\n\n${preview}`

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{
            text: '✅ Открыть панель лидера',
            web_app: { url: 'https://krest-platform-web.vercel.app/miniapp/admin.html' }
          }]]
        }
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('notify error', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
