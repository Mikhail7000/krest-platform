/**
 * GET /api/telegram/setup-commands
 * Регистрирует меню команд бота ПО РОЛЯМ (scope), чтобы обычные ученики НЕ
 * видели админ-команды:
 *   - default (все): /start, /progress, /help
 *   - кураторы (scope chat): + /students, /student
 *   - админы/супер-админы (scope chat): полный набор
 * Вызывать после деплоя и после смены ролей.
 */
import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const BASE = [
  { command: 'start', description: 'Открыть приложение КРЕСТ' },
  { command: 'progress', description: 'Мой прогресс' },
  { command: 'help', description: 'Помощь и поддержка' },
]

const CURATOR = [
  { command: 'start', description: 'Открыть приложение КРЕСТ' },
  { command: 'progress', description: 'Мой прогресс' },
  { command: 'students', description: 'Мои ученики и их прогресс' },
  { command: 'student', description: 'Прогресс ученика: /student @ник' },
  { command: 'help', description: 'Помощь и поддержка' },
]

const ADMIN = [
  { command: 'start', description: 'Открыть приложение КРЕСТ' },
  { command: 'progress', description: 'Мой прогресс' },
  { command: 'students', description: 'Ученики и прогресс' },
  { command: 'student', description: 'Прогресс ученика: /student @ник' },
  { command: 'curators', description: 'Кураторы и ученики' },
  { command: 'add', description: 'Добавить ученика: /add @ник' },
  { command: 'addcurator', description: 'Добавить куратора: /addcurator @ник' },
  { command: 'stats', description: 'Статистика потока' },
  { command: 'transfer', description: 'Перевод: /transfer @ученик @куратор' },
  { command: 'delete', description: 'Удалить ученика: /delete @ник' },
  { command: 'panel', description: 'Веб-дашборд администратора' },
  { command: 'help', description: 'Помощь и поддержка' },
]

type Cmd = { command: string; description: string }
type Scope = { type: 'default' } | { type: 'chat'; chat_id: number }

async function setCommands(token: string, commands: Cmd[], scope: Scope): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands, scope }),
  })
  return res.ok
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'NO_BOT_TOKEN' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any
  const { data: rows } = await supabase
    .from('profiles')
    .select('telegram_chat_id, role')
    .in('role', ['admin', 'super_admin', 'curator'])
    .not('telegram_chat_id', 'is', null)

  const admins: number[] = []
  const curators: number[] = []
  for (const r of (rows ?? []) as { telegram_chat_id: number; role: string }[]) {
    if (r.role === 'curator') curators.push(r.telegram_chat_id)
    else admins.push(r.telegram_chat_id)
  }

  // Базовое меню — всем
  await setCommands(token, BASE, { type: 'default' })
  // Кураторам — свой набор
  for (const cid of curators) await setCommands(token, CURATOR, { type: 'chat', chat_id: cid })
  // Админам — полный
  for (const cid of admins) await setCommands(token, ADMIN, { type: 'chat', chat_id: cid })

  return NextResponse.json({ ok: true, admins: admins.length, curators: curators.length })
}
