import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Регистрация студента БЕЗ email-подтверждения (обход Resend rate limit).
 *
 * POST /api/miniapp/signup
 * Body: { email, password, full_name, contact_info?, referral_source?, referral_detail? }
 *
 * Использует supabase.auth.admin.createUser с email_confirm=true.
 * Не отправляет реальное письмо → не упирается в rate limit.
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json() as {
      email: string
      password: string
      full_name: string
      contact_info?: string
      referral_source?: string
      referral_detail?: string
      ref?: string  // invite_token церкви (опционально)
    }

    const { email, password, full_name, contact_info, referral_source, referral_detail, ref } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({
        error: { code: 'BAD_REQUEST', message: 'email, password, full_name обязательны' },
      }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({
        error: { code: 'WEAK_PASSWORD', message: 'Пароль должен быть не менее 6 символов' },
      }, { status: 400 })
    }

    // Создаём пользователя с email_confirm=true (без отправки реального письма)
    const { data: created, error: signupError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (signupError || !created?.user) {
      const msg = signupError?.message || 'Не удалось создать аккаунт'
      const code = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')
        ? 'EMAIL_EXISTS'
        : 'SIGNUP_FAILED'
      const userMessage = code === 'EMAIL_EXISTS'
        ? 'Этот email уже зарегистрирован. Войдите в аккаунт.'
        : 'Ошибка регистрации. Попробуйте ещё раз.'
      return NextResponse.json({ error: { code, message: userMessage } }, { status: 400 })
    }

    const userId = created.user.id

    // Привязка к церкви если был ref-токен
    let churchId: string | null = null
    let nastavnikId: string | null = null
    if (ref) {
      const { data: church } = await supabaseAdmin
        .from('churches')
        .select('id, pastor_id')
        .eq('invite_token', ref)
        .single()
      if (church) {
        churchId = church.id
        nastavnikId = church.pastor_id
      }
    }

    // Обновляем профиль с дополнительными полями
    await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        contact_info: contact_info || null,
        referral_source: referral_source || null,
        referral_detail: referral_detail || null,
        church_id: churchId,
        nastavnik_id: nastavnikId,
      })
      .eq('id', userId)

    return NextResponse.json({
      ok: true,
      data: {
        user_id: userId,
        email,
      },
    })
  } catch (e) {
    console.error('signup error', e)
    return NextResponse.json({
      error: { code: 'INTERNAL', message: 'Internal error' },
    }, { status: 500 })
  }
}
