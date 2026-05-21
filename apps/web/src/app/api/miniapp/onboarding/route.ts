import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createHmac } from 'crypto'

/**
 * POST /api/miniapp/onboarding
 *
 * Завершение онбординга: сохранение выбора страны, города, куратора, имени.
 *
 * Body: { initData, country_id, city_id, curator_id, full_name }
 *
 * Поток:
 *  1. Валидация initData HMAC (подтверждение от Telegram)
 *  2. Проверка авторизации (session cookie)
 *  3. Обновление профиля: country_id, city_id, curator_id, full_name, onboarding_done=true
 *  4. Возвращаем success
 */
export async function POST(request: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: { code: 'NO_BOT_TOKEN', message: 'Bot not configured' } },
      { status: 500 }
    )
  }

  try {
    const { initData, country_id, city_id, curator_id, full_name } = (await request.json()) as {
      initData: string
      country_id: string
      city_id: string
      curator_id: string
      full_name: string
    }

    // Валидация обязательных полей
    if (!initData || !country_id || !city_id || !curator_id || !full_name) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Missing required fields' } },
        { status: 400 }
      )
    }

    // 1. Валидация initData HMAC
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) {
      return NextResponse.json(
        { error: { code: 'INVALID_INIT_DATA', message: 'no hash' } },
        { status: 401 }
      )
    }
    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) {
      return NextResponse.json(
        { error: { code: 'INVALID_HMAC', message: 'Telegram signature invalid' } },
        { status: 401 }
      )
    }

    // 2. Проверка авторизации
    const supabase = await createServerSupabase()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const userId = userData.user.id

    // 3. Обновляем профиль
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        country_id,
        city_id,
        curator_id,
        full_name,
        onboarding_done: true,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[onboarding POST] profile update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to save onboarding data' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[onboarding POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
