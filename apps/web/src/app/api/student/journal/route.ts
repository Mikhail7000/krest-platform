import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

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

  const result = inserted as unknown as { id: string }
  return NextResponse.json({ data: result }, { status: 201 })
}
