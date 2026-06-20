/**
 * GET /api/telegram/setup-commands
 * Регистрирует меню команд бота в Telegram (setMyCommands). Вызвать один раз
 * после деплоя. Команды: /start, /help, /progress, /students, /student,
 * /curators, /stats, /transfer, /delete.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'NO_BOT_TOKEN' }, { status: 500 })
  }

  const commands = [
    { command: 'start', description: 'Открыть приложение КРЕСТ' },
    { command: 'progress', description: 'Мой прогресс' },
    { command: 'students', description: 'Ученики и прогресс (для наставников)' },
    { command: 'student', description: 'Прогресс ученика: /student @ник' },
    { command: 'curators', description: 'Кураторы и ученики' },
    { command: 'addcurator', description: 'Добавить куратора: /addcurator @ник' },
    { command: 'stats', description: 'Статистика потока' },
    { command: 'panel', description: 'Веб-дашборд администратора' },
    { command: 'transfer', description: 'Перевод: /transfer @ученик @куратор' },
    { command: 'delete', description: 'Удалить ученика: /delete @ник' },
    { command: 'help', description: 'Помощь и поддержка' },
  ]

  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json({ ok: res.ok, telegram: data })
}
