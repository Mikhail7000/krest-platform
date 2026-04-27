import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

/**
 * Регистрация / вход через Telegram WebApp без email и пароля.
 *
 * POST /api/miniapp/telegram-auth
 * Body: { initData: string, ref?: string }
 *
 * Поток:
 *  1. Валидация initData через HMAC SHA256 + bot token (Telegram-стандарт)
 *  2. Извлечение Telegram user_id, first_name, last_name, username
 *  3. Поиск профиля по telegram_chat_id:
 *     - Найден → вернуть session (логин)
 *     - Не найден → signUp с тех. email tg{user_id}@krest.local + random password
 *       обновить profile (full_name, telegram_chat_id, церковь по ref-токену)
 *  4. Возвращаем { access_token, refresh_token, is_new } для setSession() на клиенте
 *
 * Безопасность:
 *  - HMAC-валидация initData гарантирует, что данные пришли от Telegram
 *  - Без mailer_autoconfirm=true этот flow всё равно работает,
 *    т.к. mailer_autoconfirm уже установлен в config (см. сессию 27.04)
 */
export async function POST(request: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // используем anon — service_role в Vercel некорректный
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: { code: 'NO_BOT_TOKEN', message: 'Bot не настроен' } }, { status: 500 })
  }

  try {
    const { initData, ref } = await request.json() as { initData: string; ref?: string }

    if (!initData) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'initData required' } }, { status: 400 })
    }

    // 1. Валидация initData через HMAC
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) {
      return NextResponse.json({ error: { code: 'INVALID_INIT_DATA', message: 'no hash' } }, { status: 401 })
    }
    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) {
      return NextResponse.json({ error: { code: 'INVALID_HMAC', message: 'Telegram signature invalid' } }, { status: 401 })
    }

    // 2. Извлечение user
    const userJson = params.get('user')
    if (!userJson) {
      return NextResponse.json({ error: { code: 'NO_USER', message: 'No user in initData' } }, { status: 400 })
    }
    const tgUser = JSON.parse(userJson) as {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }

    const tgId = tgUser.id
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || `Telegram ${tgId}`
    const techEmail = `tg${tgId}@krest.local`

    // 3. Anon client для поиска и signup
    const supa = createClient(SUPA_URL, SERVICE_KEY)

    // Ищем профиль по telegram_chat_id
    const { data: existing } = await supa
      .from('profiles')
      .select('id, email')
      .eq('telegram_chat_id', tgId)
      .maybeSingle()

    if (existing) {
      // Логин существующего пользователя — нужен пароль. Вернём детерминированный
      // через HMAC от tgId + bot token (приватный для нашего сервера)
      const password = createHmac('sha256', BOT_TOKEN).update(`tg-pwd-${tgId}`).digest('hex').slice(0, 32)
      const { data: loginData, error: loginErr } = await supa.auth.signInWithPassword({
        email: existing.email!,
        password,
      })
      if (loginErr || !loginData.session) {
        return NextResponse.json({
          error: { code: 'LOGIN_FAILED', message: 'Аккаунт найден, но не удалось войти. Попробуйте позже.', debug: loginErr?.message },
        }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        data: {
          access_token: loginData.session.access_token,
          refresh_token: loginData.session.refresh_token,
          is_new: false,
        },
      })
    }

    // Не найден по telegram_chat_id → попытка signUp с тех. email
    const password = createHmac('sha256', BOT_TOKEN).update(`tg-pwd-${tgId}`).digest('hex').slice(0, 32)
    const signUpRes = await supa.auth.signUp({
      email: techEmail,
      password,
      options: { data: { full_name: fullName } },
    })

    let userId = signUpRes.data?.user?.id
    let session = signUpRes.data?.session

    // Если signUp упал с "already registered" — fallback на signInWithPassword
    if (!userId || !session) {
      const { data: loginData, error: loginErr } = await supa.auth.signInWithPassword({
        email: techEmail,
        password,
      })
      if (loginErr || !loginData?.user || !loginData?.session) {
        return NextResponse.json({
          error: {
            code: 'AUTH_FAILED',
            message: 'Не удалось войти через Telegram. Обратитесь к лидеру.',
            debug: loginErr?.message,
          },
        }, { status: 500 })
      }
      userId = loginData.user.id
      session = loginData.session
    }

    // Привязка к церкви по ref-токену
    let churchId: string | null = null
    let nastavnikId: string | null = null
    if (ref) {
      const { data: church } = await supa
        .from('churches')
        .select('id, pastor_id')
        .eq('invite_token', ref)
        .maybeSingle()
      if (church) {
        churchId = church.id
        nastavnikId = church.pastor_id
      }
    }

    // Обновляем профиль с telegram_chat_id и доп. полями (RLS требует session=своего юзера)
    const supaWithSession = createClient(SUPA_URL, SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    })
    const { error: updateErr } = await supaWithSession
      .from('profiles')
      .update({
        full_name: fullName,
        telegram_chat_id: tgId,
        church_id: churchId,
        nastavnik_id: nastavnikId,
        referral_source: 'telegram',
        contact_info: tgUser.username ? `@${tgUser.username}` : null,
        onboarding_done: true,
      })
      .eq('id', userId)
    if (updateErr) {
      console.error('profile update failed:', updateErr)
    }

    return NextResponse.json({
      ok: true,
      data: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        is_new: true,
      },
    })
  } catch (e) {
    console.error('telegram-auth error', e)
    return NextResponse.json({
      error: { code: 'INTERNAL', message: e instanceof Error ? e.message : 'Internal error' },
    }, { status: 500 })
  }
}
