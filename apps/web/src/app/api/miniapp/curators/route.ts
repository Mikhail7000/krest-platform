import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram/init-data'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/miniapp/curators
 *
 * Список кураторов выбранного города для шага онбординга.
 *
 * Зачем серверный route: RLS на profiles (is_visible_to) режет анонимного
 * браузерного клиента — в Telegram MiniApp нет Supabase-сессии (auth.uid()=NULL),
 * поэтому прямое чтение из браузера возвращает пусто. Читаем service-ролью
 * после валидации Telegram initData (HMAC достаточно — список наставников
 * города не приватен, а пользователь ещё в онбординге и может быть не whitelisted).
 *
 * Body: { initData, city_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      city_id?: number | string
    }
    const { initData, city_id } = body

    if (!city_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Missing city_id' } },
        { status: 400 },
      )
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Server configuration error' } },
        { status: 500 },
      )
    }

    const valid = validateTelegramInitData(initData ?? '', botToken)
    if (!valid.ok) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: valid.reason } },
        { status: 401 },
      )
    }

    const supabase = createServiceSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'curator')
      .eq('city_id', Number(city_id))
      .order('full_name')

    if (error) {
      console.error('[miniapp/curators] select error:', error)
      return NextResponse.json(
        { error: { code: 'QUERY_FAILED', message: 'Failed to load curators' } },
        { status: 500 },
      )
    }

    return NextResponse.json({ curators: data ?? [] })
  } catch (err) {
    console.error('[miniapp/curators]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
