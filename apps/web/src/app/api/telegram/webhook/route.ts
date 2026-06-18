import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeActivity } from '@/lib/activity/streak'
import { createTelegramProfile } from '@/lib/telegram/ensure-profile'
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
} from '@/lib/telegram/send'

// ─── Telegram Update types ────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: { message_id: number; chat: { id: number } }
  data?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface AccessRequest {
  id: string
  telegram_chat_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_role: 'student' | 'curator' | null
}

// ─── Service Supabase client ──────────────────────────────────────────────

function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase configuration')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Обработчик callback_query ────────────────────────────────────────────

async function handleCallbackQuery(cq: TelegramCallbackQuery): Promise<void> {
  const adminChatIds = (process.env.ADMIN_TELEGRAM_CHAT_IDS || '255214568')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))

  // Проверяем права
  if (!adminChatIds.includes(cq.from.id)) {
    await answerCallbackQuery(cq.id, 'Недостаточно прав')
    return
  }

  const data = cq.data ?? ''
  const colonIdx = data.indexOf(':')
  if (colonIdx === -1) {
    await answerCallbackQuery(cq.id, 'Неверный формат данных')
    return
  }

  const action = data.slice(0, colonIdx)
  const requestId = data.slice(colonIdx + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceSupabase() as any

  const { data: req, error: fetchErr } = await service
    .from('access_requests')
    .select('id, telegram_chat_id, username, first_name, last_name, status, approved_role')
    .eq('id', requestId)
    .maybeSingle() as { data: AccessRequest | null; error: unknown }

  if (fetchErr || !req) {
    await answerCallbackQuery(cq.id, 'Заявка не найдена')
    return
  }

  if (req.status !== 'pending') {
    await answerCallbackQuery(cq.id, 'Заявка уже обработана')
    return
  }

  const name =
    [req.first_name, req.last_name].filter(Boolean).join(' ') ||
    (req.username ? `@${req.username}` : `id ${req.telegram_chat_id}`)

  if (action === 'approve_student' || action === 'approve_curator') {
    const role: 'student' | 'curator' = action === 'approve_student' ? 'student' : 'curator'
    const roleLabel = role === 'student' ? 'ученик' : 'куратор'

    // Создаём профиль
    const result = await createTelegramProfile({
      chatId: Number(req.telegram_chat_id),
      username: req.username,
      firstName: req.first_name,
      lastName: req.last_name,
      role,
    })

    if (!result.ok) {
      console.error('[webhook] createTelegramProfile failed:', result)
      await answerCallbackQuery(cq.id, 'Ошибка создания профиля')
      return
    }

    // Обновляем заявку
    await service.from('access_requests').update({
      status: 'approved',
      approved_role: role,
      decided_by: cq.from.id,
      decided_at: new Date().toISOString(),
    }).eq('id', requestId)

    await answerCallbackQuery(cq.id, 'Одобрено')

    // Редактируем сообщение у всех админов (только у того, кто нажал — message доступен)
    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `✅ Одобрено как ${roleLabel}: <b>${name}</b>`,
      )
    }

    // Уведомляем заявителя
    await sendTelegramMessage(
      Number(req.telegram_chat_id),
      'Тебя одобрили! ✝️ Открой приложение и начни обучение.',
      { withMiniAppButton: true },
    )
    return
  }

  if (action === 'reject') {
    await service.from('access_requests').update({
      status: 'rejected',
      decided_by: cq.from.id,
      decided_at: new Date().toISOString(),
    }).eq('id', requestId)

    await answerCallbackQuery(cq.id, 'Отклонено')

    if (cq.message) {
      await editMessageText(
        cq.message.chat.id,
        cq.message.message_id,
        `✖️ Отклонено: <b>${name}</b>`,
      )
    }
    return
  }

  await answerCallbackQuery(cq.id, 'Неизвестное действие')
}

// ─── Хелпер: прогресс учеников для команды /students ─────────────────────

interface StudentProgressRow {
  user_id: string
  block_id: number
  block_passed_at: string | null
}

interface StudentProfileRow {
  id: string
  full_name: string | null
}

interface StudentSummary {
  id: string
  full_name: string
  passed: number
  currentBlock: number
}

/**
 * Загружает учеников куратора и считает их прогресс.
 * Возвращает упорядоченный список StudentSummary.
 */
async function loadStudentsSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  curatorId: string,
): Promise<StudentSummary[]> {
  const { data: students, error: studentsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'student')
    .eq('curator_id', curatorId)

  if (studentsError) {
    console.error('[webhook/students] profiles query error', studentsError)
    return []
  }

  const profiles = (students ?? []) as StudentProfileRow[]
  if (profiles.length === 0) return []

  const ids = profiles.map((p) => p.id)

  const { data: bpRows } = await supabase
    .from('student_block_progress')
    .select('user_id, block_id, block_passed_at')
    .in('user_id', ids)

  const progressByUser: Record<string, StudentProgressRow[]> = {}
  for (const row of (bpRows ?? []) as StudentProgressRow[]) {
    ;(progressByUser[row.user_id] ??= []).push(row)
  }

  return profiles.map((student) => {
    const rows = progressByUser[student.id] ?? []
    const passed = rows.filter((r) => r.block_passed_at !== null).length
    const currentBlock =
      rows.length > 0 ? Math.max(...rows.map((r) => r.block_id)) : 1
    return {
      id: student.id,
      full_name: student.full_name ?? 'Без имени',
      passed,
      currentBlock,
    }
  })
}

/**
 * Форматирует HTML-сообщение со списком учеников.
 * Обрезает до лимита Telegram 4096 символов.
 */
function formatStudentsList(students: StudentSummary[]): string {
  if (students.length === 0) {
    return 'Пока нет привязанных учеников.'
  }

  const LIMIT = 4000 // оставляем буфер от 4096
  const header = `<b>Твои ученики (${students.length})</b>\n\n`

  const lines: string[] = []
  let bodyLen = 0

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const line = `${i + 1}. ${s.full_name} — ${s.passed}/10 блоков, сейчас Блок ${s.currentBlock}\n`
    if (header.length + bodyLen + line.length > LIMIT) {
      const remaining = students.length - i
      lines.push(`<i>...и ещё ${remaining} учеников — откройте приложение для полного списка</i>`)
      break
    }
    lines.push(line)
    bodyLen += line.length
  }

  return header + lines.join('')
}

// ─── HTTP handlers ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Validate webhook secret if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  // callback_query — обработка нажатия inline-кнопок
  if (update.callback_query) {
    try {
      await handleCallbackQuery(update.callback_query)
    } catch (err) {
      console.error('[webhook] handleCallbackQuery error:', err)
    }
    return NextResponse.json({ ok: true })
  }

  // Only process messages with text
  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  // /students — список учеников (только для curator / admin / super_admin)
  if (text.startsWith('/students')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle() as { data: { id: string; role: string; full_name: string | null } | null }

    if (!profile) {
      await sendTelegramMessage(
        chatId,
        'Сначала открой приложение командой /start.',
        { withMiniAppButton: true },
      )
      return NextResponse.json({ ok: true })
    }

    const allowedRoles = ['curator', 'admin', 'super_admin']
    if (!allowedRoles.includes(profile.role)) {
      await sendTelegramMessage(
        chatId,
        'Команда /students доступна только наставникам.',
      )
      return NextResponse.json({ ok: true })
    }

    const students = await loadStudentsSummary(supabase, profile.id)
    const replyText = formatStudentsList(students)
    await sendTelegramMessage(chatId, replyText, { withMiniAppButton: true })
    return NextResponse.json({ ok: true })
  }

  // /help — помощь и связь с разработчиком
  if (text.startsWith('/help')) {
    await sendTelegramMessage(
      chatId,
      `<b>Помощь ✝️</b>\n\nНужна помощь или нашёл ошибку — напиши разработчику: @Rogue02\n\nВнутри приложения тоже есть кнопка «Помощь и поддержка».`,
      { withMiniAppButton: true },
    )
    return NextResponse.json({ ok: true })
  }

  // /progress — мой прогресс
  if (text.startsWith('/progress')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceSupabase() as any
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()
    if (!profile) {
      await sendTelegramMessage(chatId, `Сначала открой приложение командой /start.`, {
        withMiniAppButton: true,
      })
      return NextResponse.json({ ok: true })
    }
    const [{ data: bp }, { data: act }] = await Promise.all([
      supabase.from('student_block_progress').select('block_passed_at').eq('user_id', profile.id),
      supabase
        .from('student_daily_activity')
        .select('activity_date')
        .eq('user_id', profile.id)
        .eq('opened', true),
    ])
    const passed = ((bp ?? []) as { block_passed_at: string | null }[]).filter(
      (b) => b.block_passed_at,
    ).length
    const streak = computeActivity(
      ((act ?? []) as { activity_date: string }[]).map((r) => r.activity_date),
      [],
      7,
    ).streak
    await sendTelegramMessage(
      chatId,
      `<b>Твой прогресс ✝️</b>\n\nПройдено блоков: <b>${passed} из 10</b>\nДней подряд: <b>${streak}</b>\n\nПродолжай — день начинается с вечера 🙏`,
      { withMiniAppButton: true },
    )
    return NextResponse.json({ ok: true })
  }

  // Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const arg = parts.length > 1 ? parts.slice(1).join(' ').trim() : null

    // /start ref_<token> — приглашение от церкви
    let refToken: string | null = null
    if (arg && arg.startsWith('ref_')) {
      refToken = arg.slice(4)
    }

    const emailArg = arg && arg.includes('@') ? arg : null

    if (emailArg) {
      // /start email@example.com — link account by email
      try {
        const supabase = createServiceSupabase()

        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('id, email, telegram_chat_id')
          .eq('email', emailArg.toLowerCase())
          .single()

        if (findError || !profile) {
          await sendTelegramMessage(
            chatId,
            `<b>Аккаунт не найден</b>\n\nПользователь с email <code>${emailArg}</code> не зарегистрирован на платформе КРЕСТ.\n\nСначала зарегистрируйтесь на сайте, затем вернитесь сюда.`,
          )
          return NextResponse.json({ ok: true })
        }

        if (profile.telegram_chat_id && profile.telegram_chat_id === chatId) {
          await sendTelegramMessage(
            chatId,
            `<b>Уже подключено!</b>\n\nВаш Telegram уже связан с аккаунтом КРЕСТ.`,
          )
          return NextResponse.json({ ok: true })
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: chatId })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Failed to update telegram_chat_id:', updateError)
          await sendTelegramMessage(
            chatId,
            `<b>Ошибка</b>\n\nНе удалось связать аккаунт. Попробуйте позже.`,
          )
          return NextResponse.json({ ok: true })
        }

        await sendTelegramMessage(
          chatId,
          `<b>Аккаунт подключен!</b>\n\nВы будете получать уведомления об одобрении блоков лидером.\n\nУдачи в прохождении курса КРЕСТ!`,
        )
      } catch (error) {
        console.error('Error linking Telegram account:', error)
        await sendTelegramMessage(chatId, `<b>Ошибка</b>\n\nПроизошла ошибка. Попробуйте позже.`)
      }
    } else {
      // /start без аргументов или с ref-токеном церкви
      const welcomeText = refToken
        ? `<b>Добро пожаловать в КРЕСТ! ✝️</b>\n\nВас пригласила церковь-партнёр.\n\nОткройте приложение и пройдите 10 блоков знакомства с верой — с живым наставником и в кругу таких же ищущих.`
        : `<b>Добро пожаловать в КРЕСТ! ✝️</b>\n\nПлатформа для изучения Креста.\n\n<b>Что внутри:</b>\n• 10 блоков для изучения\n• Видео-уроки и конспекты\n• Практика по каждому блоку\n\nНажмите кнопку ниже, чтобы открыть приложение.`

      await sendTelegramMessage(chatId, welcomeText, {
        withMiniAppButton: true,
        ...(refToken ? { inlineKeyboard: undefined } : {}),
      })
    }

    return NextResponse.json({ ok: true })
  }

  // Handle other messages
  try {
    const supabase = createServiceSupabase()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_chat_id', chatId)
      .single()

    if (profile) {
      await sendTelegramMessage(
        chatId,
        `<b>Привет, ${profile.full_name || 'ученик'}!</b>\n\nВаш аккаунт подключен. Вы получите уведомление, когда лидер одобрит ваш блок.`,
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `<b>Аккаунт не подключен</b>\n\nОтправьте команду:\n<code>/start ваш@email.com</code>\n\nчтобы связать Telegram с аккаунтом КРЕСТ.`,
      )
    }
  } catch (error) {
    console.error('Error checking profile:', error)
  }

  return NextResponse.json({ ok: true })
}

// Handle GET requests (Telegram webhook verification)
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook endpoint active' })
}
