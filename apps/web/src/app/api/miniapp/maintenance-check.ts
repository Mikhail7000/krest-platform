import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { validateInitData } from '@/lib/telegram/validate'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { initData } = body as { initData?: string }

    if (!initData) {
      return NextResponse.json({ allowed: false, reason: 'NO_INIT_DATA' }, { status: 400 })
    }

    // Валидируем Telegram initData
    const tgUser = validateInitData(initData)
    if (!tgUser) {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INIT_DATA' }, { status: 401 })
    }

    // Создаём Supabase клиент для проверки в БД
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      }
    )

    // Проверяем, есть ли профиль юзера
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, status, role, is_whitelisted')
      .eq('telegram_chat_id', tgUser.id)
      .single()

    if (profile) {
      // Профиль существует
      // Если на waitlist — блокируем
      if (profile.status === 'pending_city_activation') {
        return NextResponse.json({
          allowed: false,
          reason: 'WAITLIST',
          message: 'Ваш город ещё не активирован. Мы скоро откроемся в вашем регионе!',
        })
      }
      return NextResponse.json({ allowed: true })
    }

    // Профиля нет — проверяем вайтлист
    const { data: whitelist } = await supabase
      .from('testing_whitelist')
      .select('id, assign_role')
      .eq('telegram_username', tgUser.username || '')
      .single()

    if (whitelist) {
      // В вайтлисте — разрешаем
      return NextResponse.json({ allowed: true })
    }

    // Не в вайтлисте и нет профиля — запускали ли /start бота?
    // (без профиля и вайтлиста → нужно запустить бота)
    return NextResponse.json({
      allowed: false,
      reason: 'PROFILE_NOT_FOUND',
    })
  } catch (error) {
    console.error('maintenance-check error:', error)
    return NextResponse.json(
      { allowed: false, reason: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
