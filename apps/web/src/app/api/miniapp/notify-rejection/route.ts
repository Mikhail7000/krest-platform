import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { student_id, block_id, block_num, block_name, comment, leader_name } =
      await request.json() as {
        student_id: string
        block_id: number
        block_num: number
        block_name: string
        comment: string
        leader_name: string
      }

    if (!student_id || !block_id || !comment) {
      return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
    }

    // Delete forum answers and progress so student can resubmit
    await supabaseAdmin
      .from('journal_entries')
      .delete()
      .eq('user_id', student_id)
      .eq('block_id', block_id)
      .is('lesson_id', null)

    await supabaseAdmin
      .from('student_progress')
      .delete()
      .eq('user_id', student_id)
      .eq('block_id', block_id)
      .is('lesson_id', null)

    // Notify student via Telegram if they have a chat_id
    const { data: student } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id, full_name')
      .eq('id', student_id)
      .single()

    if (student?.telegram_chat_id) {
      const token = process.env.TELEGRAM_BOT_TOKEN
      const leaderName = leader_name || 'Лидер'
      const text =
        `🔄 <b>Блок требует доработки</b>\n\n` +
        `Блок ${block_num}: <b>${block_name}</b>\n\n` +
        `💬 Комментарий от ${leaderName}:\n<i>${comment}</i>\n\n` +
        `Пожалуйста, пересмотрите видео и отправьте ответы заново.`

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: student.telegram_chat_id, text, parse_mode: 'HTML' }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('notify-rejection error', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
