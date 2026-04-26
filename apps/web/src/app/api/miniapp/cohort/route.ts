import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Auto-cohort: автоматическое объединение студентов одного блока в малую группу.
 *
 * POST /api/miniapp/cohort
 * Body: { user_id: string, block_id: number }
 *
 * Логика:
 * 1. Если студент уже в открытой когорте этого блока → вернуть её
 * 2. Иначе ищем open cohort с member_count<12 и подходящей church_id (если есть)
 * 3. Если нет → создаём новую cohort (status='open')
 * 4. Добавляем cohort_members запись (триггер обновит member_count)
 * 5. Возвращаем { cohort_id, member_count, telegram_invite_link?, is_new_cohort }
 *
 * Telegram-группа создаётся НЕ здесь (требует отдельного флоу: лидер создаёт группу через /admin,
 * либо post-MVP — автоматизированный bot, который создаёт супер-группы).
 * На MVP просто фиксируем когорту в БД, лидер видит список и может создать чат вручную.
 */
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { user_id, block_id } = await request.json() as {
      user_id: string
      block_id: number
    }

    if (!user_id || !block_id) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'user_id and block_id required' } }, { status: 400 })
    }

    // 1. Проверка: студент уже в когорте этого блока?
    const { data: existing } = await supabaseAdmin
      .from('cohort_members')
      .select('cohort_id, cohorts!inner(id, block_id, status, member_count, telegram_invite_link)')
      .eq('user_id', user_id)
      .eq('cohorts.block_id', block_id)
      .eq('cohorts.status', 'open')
      .maybeSingle()

    if (existing) {
      const cohortsField = (existing as unknown as {
        cohorts: { id: string; member_count: number; telegram_invite_link: string | null }
          | { id: string; member_count: number; telegram_invite_link: string | null }[]
      }).cohorts
      const cohort = Array.isArray(cohortsField) ? cohortsField[0] : cohortsField
      if (cohort) {
        return NextResponse.json({
          ok: true,
          data: {
            cohort_id: cohort.id,
            member_count: cohort.member_count,
            telegram_invite_link: cohort.telegram_invite_link,
            is_new_cohort: false,
            already_member: true,
          },
        })
      }
    }

    // 2. Получаем church_id студента (для группировки по церкви)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('church_id')
      .eq('id', user_id)
      .single()

    const churchId = profile?.church_id || null

    // 3. Поиск открытой когорты этого блока с местом
    let query = supabaseAdmin
      .from('cohorts')
      .select('id, member_count, telegram_invite_link')
      .eq('block_id', block_id)
      .eq('status', 'open')
      .lt('member_count', 12)
      .order('member_count', { ascending: false })  // приоритет более полным (быстрее достигнут 12)
      .limit(1)

    query = churchId ? query.eq('church_id', churchId) : query.is('church_id', null)

    const { data: openCohorts } = await query

    let cohortId: string
    let memberCount: number
    let inviteLink: string | null = null
    let isNew = false

    if (openCohorts && openCohorts.length > 0) {
      cohortId = openCohorts[0].id
      memberCount = openCohorts[0].member_count
      inviteLink = openCohorts[0].telegram_invite_link
    } else {
      // 4. Создать новую cohort
      const { data: newCohort, error: createError } = await supabaseAdmin
        .from('cohorts')
        .insert({ block_id, church_id: churchId, status: 'open' })
        .select('id, member_count')
        .single()

      if (createError || !newCohort) {
        console.error('cohort create error', createError)
        return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Failed to create cohort' } }, { status: 500 })
      }

      cohortId = newCohort.id
      memberCount = 0
      isNew = true
    }

    // 5. Добавляем студента в когорту (триггер автоматически инкрементирует member_count)
    const { error: joinError } = await supabaseAdmin
      .from('cohort_members')
      .insert({ cohort_id: cohortId, user_id })

    if (joinError && joinError.code !== '23505') {
      console.error('cohort join error', joinError)
      return NextResponse.json({ error: { code: 'DB_ERROR', message: joinError.message } }, { status: 500 })
    }

    // 6. Если member_count достиг 12 — закрываем когорту
    if (memberCount + 1 >= 12) {
      await supabaseAdmin
        .from('cohorts')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', cohortId)
    }

    return NextResponse.json({
      ok: true,
      data: {
        cohort_id: cohortId,
        member_count: memberCount + 1,
        telegram_invite_link: inviteLink,
        is_new_cohort: isNew,
        already_member: false,
      },
    })
  } catch (e) {
    console.error('cohort error', e)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, { status: 500 })
  }
}
