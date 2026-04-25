import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Telegram Update types
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

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// Create Supabase client with service role for writing without RLS
function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Send message back to Telegram
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not configured')
    return
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('Failed to send Telegram message:', error)
  }
}

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
    update = await request.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  // Only process messages with text
  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  // Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const emailArg = parts.length > 1 ? parts.slice(1).join(' ').trim() : null

    if (emailArg && emailArg.includes('@')) {
      // /start email@example.com — link account by email
      try {
        const supabase = createServiceSupabase()

        // Find profile by email
        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('id, email, telegram_chat_id')
          .eq('email', emailArg.toLowerCase())
          .single()

        if (findError || !profile) {
          await sendTelegramMessage(
            chatId,
            `<b>Аккаунт не найден</b>\n\nПользователь с email <code>${emailArg}</code> не зарегистрирован на платформе КРЕСТ.\n\nСначала зарегистрируйтесь на сайте, затем вернитесь сюда.`
          )
          return NextResponse.json({ ok: true })
        }

        // Check if already linked
        if (profile.telegram_chat_id && profile.telegram_chat_id === chatId) {
          await sendTelegramMessage(
            chatId,
            `<b>Уже подключено!</b>\n\nВаш Telegram уже связан с аккаунтом КРЕСТ.`
          )
          return NextResponse.json({ ok: true })
        }

        // Update telegram_chat_id
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: chatId })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Failed to update telegram_chat_id:', updateError)
          await sendTelegramMessage(
            chatId,
            `<b>Ошибка</b>\n\nНе удалось связать аккаунт. Попробуйте позже.`
          )
          return NextResponse.json({ ok: true })
        }

        await sendTelegramMessage(
          chatId,
          `<b>Аккаунт подключен!</b>\n\nВы будете получать уведомления об одобрении блоков лидером.\n\nУдачи в прохождении курса КРЕСТ!`
        )
      } catch (error) {
        console.error('Error linking Telegram account:', error)
        await sendTelegramMessage(
          chatId,
          `<b>Ошибка</b>\n\nПроизошла ошибка. Попробуйте позже.`
        )
      }
    } else {
      // /start without email — show welcome message
      await sendTelegramMessage(
        chatId,
        `<b>Добро пожаловать в КРЕСТ!</b>\n\nЭто бот для уведомлений платформы ученичества КРЕСТ.\n\n<b>Как подключить аккаунт:</b>\n1. Зарегистрируйтесь на платформе КРЕСТ\n2. В личном кабинете скопируйте команду привязки\n3. Отправьте её сюда\n\nИли отправьте команду:\n<code>/start ваш@email.com</code>`
      )
    }

    return NextResponse.json({ ok: true })
  }

  // Handle other messages — check if user's chat_id matches any profile
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
        `<b>Привет, ${profile.full_name || 'ученик'}!</b>\n\nВаш аккаунт подключен. Вы получите уведомление, когда лидер одобрит ваш блок.`
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `<b>Аккаунт не подключен</b>\n\nОтправьте команду:\n<code>/start ваш@email.com</code>\n\nчтобы связать Telegram с аккаунтом КРЕСТ.`
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
