/**
 * POST /api/m/trainer/ai-chat
 * Чат-тренажёр местописаний «Учиться вместе с ИИ».
 *
 * Body: { initData, blockId, messages: [{ role:'user'|'assistant', content }] }
 * Возвращает: { ok, reply } — следующая реплика ИИ (квиз по стихам блока).
 *
 * ИИ заземлён на эталонные стихи блока (block_locations_to_recite). Это учебный
 * режим (по желанию), не официальная сдача — статус дня не трогаем.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { callAnthropic } from '@/lib/ai/anthropic'
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/constants'

export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 24
const MAX_CONTENT = 2000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    initData?: string
    blockId?: number
    messages?: ChatMessage[]
  }

  const auth = await resolveUserId(body.initData ?? '')
  if (!auth.ok) return err(auth.message, auth.code, auth.status)

  const blockId = Number(body.blockId)
  if (!Number.isFinite(blockId) || blockId < 1) return err('Invalid block id', 'BAD_BLOCK_ID', 400)

  // Нормализуем историю: только валидные роли, обрезаем длину и количество.
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }))
    .slice(-MAX_MESSAGES)

  const supabase = createServiceSupabase()

  const [{ data: verses }, { data: block }] = await Promise.all([
    supabase
      .from('block_locations_to_recite')
      .select('reference, exact_text')
      .eq('block_id', blockId)
      .order('order_index'),
    supabase.from('blocks').select('order_num, title_ru').eq('id', blockId).maybeSingle(),
  ])

  const verseList = (verses ?? []) as Array<{ reference: string; exact_text: string }>
  if (verseList.length === 0) {
    return NextResponse.json({
      ok: true,
      reply: 'В этом блоке пока нет местописаний для тренировки. Загляни позже 🙏',
    })
  }

  const blockOrder = (block as { order_num?: number } | null)?.order_num ?? blockId
  const blockTitle = (block as { title_ru?: string } | null)?.title_ru ?? `Блок ${blockOrder}`
  const versesText = verseList.map((v) => `- ${v.reference}: «${v.exact_text}»`).join('\n')

  const systemPrompt = `Ты — тёплый наставник-тренажёр по заучиванию местописаний курса «Крест», блок ${blockOrder} «${blockTitle}».

Эталонные стихи этого блока (только из этого списка, ничего не выдумывай):
${versesText}

Веди живой чат-квиз, помогая ученику выучить эти стихи наизусть. Чередуй типы заданий, по ОДНОМУ за раз:
1) дай ТЕКСТ стиха (или часть) → попроси назвать ССЫЛКУ (книга глава:стих);
2) дай ССЫЛКУ → попроси written/устно привести ТЕКСТ;
3) «вставь пропущенные слова» — приведи стих с несколькими пропусками ___;
4) спроси, из какого блока стих, или его смысл своими словами;
5) иногда предложи записать ответ голосом (просто словами, без кнопок).

Оценивай СНИСХОДИТЕЛЬНО к форме — важен смысл, а не оформление:
- ССЫЛКА считается ПОЛНОСТЬЮ ВЕРНОЙ, если правильно названы книга, глава и стих — НЕЗАВИСИМО от разделителя, пробелов и регистра. «Евреям 9:27», «Евреям 927», «евреям 9 27» — всё ВЕРНО. НЕ пиши «почти» и НЕ снижай оценку из-за двоеточия/пробела — просто похвали («Верно!»). Можешь один раз мягко напомнить привычную запись «глава:стих», но это НЕ ошибка.
- ТЕКСТ стиха считается ВЕРНЫМ, если переданы ключевые слова и смысл. ИГНОРИРУЙ знаки препинания, восклицательные и вопросительные знаки, регистр, мелкие союзы и частицы (и, же, а, вот, бо), порядок слов и мелкие орфографические/словоформенные варианты (например «совершилось»/«свершилось», «преклонив»/«преклонил»). Поправляй ТОЛЬКО если искажён СМЫСЛ или пропущены КЛЮЧЕВЫЕ слова — тогда мягко покажи точный вариант. Если смысл и ключевые слова на месте — это «Верно!», не придирайся к мелочам.

Хвали за верное и сразу давай следующее задание. Будь кратким и тёплым, отвечай по-русски, используй редкие уместные эмодзи. Никогда не показывай сразу весь список стихов. Если ученик просит — дай подсказку.

Форматирование ответа: разрешён лёгкий Markdown — **жирным** выделяй ключевое (ссылку стиха, слово «Задание»), сам текст стиха приводи цитатой через «> ». НЕ используй заголовки (#) и горизонтальные линии (---) — это чат.`

  // Первый вход (пустая история) — попросим ИИ поздороваться и дать первое задание.
  const chatMessages: ChatMessage[] =
    history.length > 0 ? history : [{ role: 'user', content: 'Привет! Давай начнём тренировку.' }]

  try {
    const result = await callAnthropic({
      model: CLAUDE_SONNET_MODEL,
      systemPrompt,
      messages: chatMessages,
      purpose: 'generate_quiz',
      userId: auth.userId,
      maxTokens: 700,
    })
    const reply = result.text?.trim() || 'Давай попробуем ещё раз — назови любой стих этого блока 🙂'
    return NextResponse.json({ ok: true, reply })
  } catch (e) {
    console.error('[trainer/ai-chat] anthropic error:', e)
    return err('ИИ-тренажёр сейчас недоступен, попробуй чуть позже.', 'AI_ERROR', 502)
  }
}
