import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * B2B регистрация церкви-партнёра.
 *
 * POST /api/admin/church/register
 * Body: { church_name, pastor_email, pastor_name, pastor_password, size?, region? }
 *
 * Логика:
 * 1. Регистрация пастора в auth.users через signup (email/password)
 * 2. Профиль создаётся автоматически через trigger handle_new_user
 * 3. UPDATE profile: full_name, role='admin'
 * 4. INSERT в churches с pastor_id
 * 5. Возвращаем church_id, invite_token и invite-ссылку
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json() as {
      church_name: string
      pastor_email: string
      pastor_name: string
      pastor_password: string
      size?: 'small' | 'medium' | 'large' | 'network'
      region?: string
    }

    const { church_name, pastor_email, pastor_name, pastor_password, size = 'small', region } = body

    if (!church_name || !pastor_email || !pastor_name || !pastor_password) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Все поля обязательны' } }, { status: 400 })
    }
    if (pastor_password.length < 8) {
      return NextResponse.json({ error: { code: 'WEAK_PASSWORD', message: 'Минимум 8 символов' } }, { status: 400 })
    }

    // 1. Создание пастора через auth admin API
    const { data: created, error: signupError } = await supabaseAdmin.auth.admin.createUser({
      email: pastor_email,
      password: pastor_password,
      email_confirm: true,
      user_metadata: { full_name: pastor_name },
    })

    if (signupError || !created?.user) {
      const msg = signupError?.message || 'Не удалось создать аккаунт'
      const code = msg.includes('already') ? 'EMAIL_EXISTS' : 'SIGNUP_FAILED'
      return NextResponse.json({ error: { code, message: msg } }, { status: 400 })
    }

    const pastorId = created.user.id

    // 2. Обновление профиля: имя + роль admin
    await supabaseAdmin
      .from('profiles')
      .update({ full_name: pastor_name, role: 'admin' })
      .eq('id', pastorId)

    // 3. Создание церкви
    const { data: church, error: churchError } = await supabaseAdmin
      .from('churches')
      .insert({
        name: church_name,
        pastor_id: pastorId,
        size,
        region: region || null,
      })
      .select('id, invite_token')
      .single()

    if (churchError || !church) {
      // Cleanup: удалить созданного пастора если церковь не создалась
      await supabaseAdmin.auth.admin.deleteUser(pastorId)
      return NextResponse.json({ error: { code: 'CHURCH_CREATE_FAILED', message: churchError?.message } }, { status: 500 })
    }

    // 4. Привязать пастора к церкви
    await supabaseAdmin
      .from('profiles')
      .update({ church_id: church.id })
      .eq('id', pastorId)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://krest-platform-web.vercel.app'
    const inviteLink = `${baseUrl}/miniapp/index.html?ref=${church.invite_token}`
    const telegramInviteLink = `https://t.me/cross_bot?start=ref_${church.invite_token}`

    return NextResponse.json({
      ok: true,
      data: {
        church_id: church.id,
        invite_token: church.invite_token,
        invite_link: inviteLink,
        telegram_invite_link: telegramInviteLink,
      },
    })
  } catch (e) {
    console.error('church register error', e)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, { status: 500 })
  }
}
