import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Streak механика — записывает дневную активность и обновляет счётчик.
 *
 * POST /api/miniapp/streak
 * Body: { user_id: string, activity?: 'login' | 'video_watched' | 'forum_submitted' | 'verse_memorized' }
 *
 * Логика:
 * - Запись в streak_logs (UNIQUE по user_id+log_date+activity, дубликаты игнорируются)
 * - Обновление profiles.streak_count:
 *   - Если last_active_date = вчера → streak_count + 1
 *   - Если last_active_date = сегодня → не меняем
 *   - Если last_active_date <= 7 дней назад → "Catch Me Up" (streak сохраняется)
 *   - Если > 7 дней → streak сбрасывается до 1
 * - last_active_date = CURRENT_DATE
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { user_id, activity = 'login' } = await request.json() as {
      user_id: string
      activity?: 'login' | 'video_watched' | 'forum_submitted' | 'verse_memorized'
    }

    if (!user_id) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'user_id required' } }, { status: 400 })
    }

    // Запись в streak_logs (idempotent через UNIQUE constraint)
    const { error: logError } = await supabaseAdmin
      .from('streak_logs')
      .insert({ user_id, activity })

    // Дубликат за день — это OK (UNIQUE constraint вернёт ошибку 23505)
    if (logError && logError.code !== '23505') {
      console.error('streak log error', logError)
      return NextResponse.json({ error: { code: 'DB_ERROR', message: logError.message } }, { status: 500 })
    }

    // Получаем текущий streak и last_active_date
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('streak_count, last_active_date')
      .eq('id', user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profile not found' } }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)

    const lastActive = profile.last_active_date ? new Date(profile.last_active_date) : null
    if (lastActive) lastActive.setHours(0, 0, 0, 0)

    let newStreak = profile.streak_count || 0
    let isNewDay = false
    let catchMeUpAvailable = false

    if (!lastActive) {
      // Первый день
      newStreak = 1
      isNewDay = true
    } else {
      const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff === 0) {
        // Уже были сегодня — не меняем
        isNewDay = false
      } else if (daysDiff === 1) {
        // Вчера были — продолжаем серию
        newStreak += 1
        isNewDay = true
      } else if (daysDiff <= 7) {
        // Пропуск 2-7 дней — Catch Me Up активен, серия НЕ сбрасывается, но и не растёт
        catchMeUpAvailable = true
        isNewDay = true
      } else {
        // Пропуск >7 дней — сброс до 1
        newStreak = 1
        isNewDay = true
      }
    }

    // Обновляем profile если новый день
    if (isNewDay) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ streak_count: newStreak, last_active_date: todayStr })
        .eq('id', user_id)

      if (updateError) {
        console.error('streak update error', updateError)
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        streak_count: newStreak,
        is_new_day: isNewDay,
        catch_me_up_available: catchMeUpAvailable,
      },
    })
  } catch (e) {
    console.error('streak error', e)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, { status: 500 })
  }
}
