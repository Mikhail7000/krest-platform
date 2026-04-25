import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import type { Profile } from '@/lib/supabase-server'

async function sendTelegram(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { data: rawAdmin } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()
  const admin = rawAdmin as unknown as Profile | null
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await request.json() as { userId: string; blockId: string; progressId: string }
  const { userId, blockId } = body

  // Approve the block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('student_progress')
    .update({ admin_approved: true })
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .is('lesson_id', null)

  if (error) {
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  // Unlock next block
  const { data: rawBlock } = await supabase
    .from('blocks')
    .select('order_num')
    .eq('id', blockId)
    .single()
  const block = rawBlock as unknown as { order_num: number } | null

  if (block) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ blocks_unlocked: Math.min(block.order_num + 1, 6) })
      .eq('id', userId)
      .lt('blocks_unlocked', 6)
  }

  // Send Telegram to student if they have chat_id
  const { data: rawStudent } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  const student = rawStudent as unknown as Profile | null

  if (student?.telegram_chat_id) {
    const blockNum = block?.order_num ?? '?'
    await sendTelegram(
      student.telegram_chat_id,
      `✅ <b>Блок ${blockNum} одобрен!</b>\n\nЛидер проверил ваш ответ. Следующий блок открыт.`
    )
  }

  return NextResponse.json({ ok: true })
}
