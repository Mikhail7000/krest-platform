import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Profile } from '@/lib/supabase-server'

async function sendTelegramToLeader(text: string, replyMarkup?: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_LEADER_CHAT_ID
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: parseInt(chatId, 10),
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
      { status: 401 }
    )
  }
  const user = authData.user

  const body = await request.json() as { blockId?: string; content?: string }
  const { blockId, content } = body

  if (!blockId || !content || typeof content !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Неверные данные' } },
      { status: 400 }
    )
  }

  if (content.trim().length < 20) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Минимум 20 символов' } },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .maybeSingle()

  if (existing) {
    const entry = existing as unknown as { id: string }
    return NextResponse.json({ data: { id: entry.id } })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from('journal_entries')
    .insert({
      user_id: user.id,
      block_id: blockId,
      content: content.trim(),
      submitted_to_leader: true,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Ошибка сохранения' } },
      { status: 500 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('student_progress').insert({
    user_id: user.id,
    block_id: blockId,
    lesson_id: null,
    admin_approved: false,
  })

  // Fetch student info and block info for Telegram notification
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as Profile | null

  const { data: rawBlock } = await supabase
    .from('blocks')
    .select('order_num, title_ru')
    .eq('id', blockId)
    .single()
  const block = rawBlock as unknown as { order_num: number; title_ru: string } | null

  // Send Telegram notification to leader
  if (profile && block) {
    const studentName = profile.full_name || profile.email || 'Неизвестный студент'
    const contentPreview = content.trim().slice(0, 200)
    const contentText = contentPreview.length < content.trim().length
      ? `${contentPreview}...`
      : contentPreview

    const message = `📩 <b>Новый ответ на проверку</b>

Студент: ${studentName}
Блок: ${block.order_num} — ${block.title_ru}

"${contentText}"

<a href="https://krest-platform-web.vercel.app/admin/students/${user.id}">Открыть в веб-панели</a>`

    const replyMarkup = {
      inline_keyboard: [[{
        text: '📋 Открыть в веб-панели',
        url: `https://krest-platform-web.vercel.app/admin/students/${user.id}`,
      }]],
    }

    await sendTelegramToLeader(message, replyMarkup)
  }

  const result = inserted as unknown as { id: string }
  return NextResponse.json({ data: result }, { status: 201 })
}
