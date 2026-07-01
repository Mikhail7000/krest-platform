/**
 * POST /api/m/trainer/ai-chat
 * Чат-тренажёр «Учиться вместе с ИИ» — накопительный квиз по ВСЕМ открытым блокам.
 *
 * Body: { initData, blockId, messages: [{ role:'user'|'assistant', content }] }
 * Возвращает: { ok, reply } — следующая реплика ИИ.
 *
 * ИИ заземлён на материал всех открытых блоков ученика (конспект summary_md +
 * стихи block_locations_to_recite). Приоритет — текущему открытому блоку, затем
 * предыдущим. Учебный режим (по желанию), не официальная сдача — статус дня не трогаем.
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

  // Профиль (тест-режим) + текущий блок (его порядок и курс — якорь набора открытых)
  const [{ data: profile }, { data: curBlock }] = await Promise.all([
    supabase.from('profiles').select('can_skip_block_lock').eq('id', auth.userId).maybeSingle(),
    supabase.from('blocks').select('order_num, course_id').eq('id', blockId).maybeSingle(),
  ])
  const canSkip = Boolean((profile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)
  const courseId = (curBlock as { course_id?: number } | null)?.course_id ?? null
  const currentOrder = (curBlock as { order_num?: number } | null)?.order_num ?? 1

  // Несуществующий блок или блок без курса → ранний выход. Иначе courseId=null
  // снимал бы фильтр по курсу и в промпт попадали бы блоки ВСЕХ курсов
  // (латентная утечка перед запуском «10 писем»).
  if (!curBlock || courseId === null) return err('Block not found', 'BLOCK_NOT_FOUND', 404)

  // Все блоки курса по порядку (только основные, order_num >= 1)
  let blocksQuery = supabase
    .from('blocks')
    .select('id, order_num, title_ru')
    .gte('order_num', 1)
    .order('order_num', { ascending: true })
  if (courseId !== null) blocksQuery = blocksQuery.eq('course_id', courseId)
  const { data: allBlocks } = await blocksQuery
  const ordered = (allBlocks ?? []) as Array<{ id: number; order_num: number; title_ru: string | null }>

  // Закрытые дни по блокам — чтобы определить, какие блоки реально ОТКРЫТЫ.
  // rpc user_closed_days вне сгенерированных типов — каст (как в block-status/day-gate).
  const { data: closedRows } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: Array<{ block_id: number; days: number }> | null }>
    }
  ).rpc('user_closed_days', { p_user_id: auth.userId })
  const daysByBlock = new Map<number, number>()
  for (const r of (closedRows ?? []) as Array<{ block_id: number; days: number }>) {
    daysByBlock.set(Number(r.block_id), Number(r.days))
  }

  // Открытые блоки = все пройденные (>=7 дней) + первый текущий открытый.
  // Тест-режим (can_skip) — все блоки с 1-го по текущий включительно.
  let openBlocks: typeof ordered = []
  if (canSkip) {
    openBlocks = ordered.filter((b) => b.order_num <= currentOrder)
  } else {
    for (const b of ordered) {
      openBlocks.push(b)
      if ((daysByBlock.get(b.id) ?? 0) < 7) break
    }
  }
  if (openBlocks.length === 0) openBlocks = ordered.slice(0, 1)
  const openIds = openBlocks.map((b) => b.id)

  if (openIds.length === 0) {
    return NextResponse.json({
      ok: true,
      reply: 'Пока нет открытых блоков для тренировки. Загляни позже 🙏',
    })
  }

  // Материал открытых блоков: конспект (summary_md) + стихи наизусть.
  const [{ data: versesAll }, { data: resAll }] = await Promise.all([
    supabase
      .from('block_locations_to_recite')
      .select('block_id, reference, exact_text, order_index')
      .in('block_id', openIds)
      .order('order_index', { ascending: true }),
    supabase
      .from('block_resources')
      .select('block_id, summary_md')
      .in('block_id', openIds)
      .not('summary_md', 'is', null),
  ])

  const versesByBlock = new Map<number, Array<{ reference: string; exact_text: string }>>()
  for (const v of (versesAll ?? []) as Array<{
    block_id: number
    reference: string
    exact_text: string
  }>) {
    const arr = versesByBlock.get(v.block_id) ?? []
    arr.push({ reference: v.reference, exact_text: v.exact_text })
    versesByBlock.set(v.block_id, arr)
  }

  const SUMMARY_CAP = 1200
  const summaryByBlock = new Map<number, string>()
  for (const r of (resAll ?? []) as Array<{ block_id: number; summary_md: string | null }>) {
    if (!r.summary_md) continue
    const existing = summaryByBlock.get(r.block_id)
    // у блока может быть несколько ресурсов — берём самый содержательный конспект
    if (!existing || r.summary_md.length > existing.length) {
      summaryByBlock.set(r.block_id, r.summary_md.slice(0, SUMMARY_CAP))
    }
  }

  // Материал — от ПОСЛЕДНЕГО открытого к первому (приоритет текущему блоку).
  const blocksForPrompt = [...openBlocks].sort((a, b) => b.order_num - a.order_num)
  const materialText = blocksForPrompt
    .map((b) => {
      const title = b.title_ru ?? `Блок ${b.order_num}`
      const verses = versesByBlock.get(b.id) ?? []
      const versesStr = verses.length
        ? verses.map((v) => `  • ${v.reference}: «${v.exact_text}»`).join('\n')
        : '  (стихов нет)'
      const summary = summaryByBlock.get(b.id) || '  (конспект недоступен)'
      return `### Блок ${b.order_num} «${title}»\nКлючевые мысли (конспект):\n${summary}\nСтихи наизусть:\n${versesStr}`
    })
    .join('\n\n')

  const currentTitle = openBlocks[openBlocks.length - 1]?.title_ru ?? `Блок ${currentOrder}`

  const systemPrompt = `Ты — тёплый наставник-тренажёр курса «Крест». Помогаешь ученику закрепить ВСЕ открытые блоки: и смысл (ключевые мысли), и местописания (стихи наизусть).

Открытые блоки ученика — с 1-го по текущий «${currentTitle}». Спрашивай ТОЛЬКО по этому материалу, ничего не выдумывай:

${materialText}

Правила квиза:
- Сначала прогоняй по ТЕКУЩЕМУ (последнему открытому) блоку, затем по предыдущим — чередуй, чтобы повторить всё.
- Чередуй типы вопросов по ОДНОМУ за раз: (а) ключевая мысль/смысл блока своими словами; (б) «из какого блока эта идея или стих»; (в) дай ТЕКСТ стиха → попроси ССЫЛКУ; (г) дай ССЫЛКУ → попроси ТЕКСТ; (д) «вставь пропущенные слова ___» в стихе.
- Один вопрос за сообщение. Хвали за верное и сразу давай следующий.

Оценивай СНИСХОДИТЕЛЬНО к форме — важен смысл, а не оформление:
- ССЫЛКА верна, если правильно названы книга, глава и стих — НЕЗАВИСИМО от разделителя, пробелов и регистра. «Евреям 9:27», «Евреям 927», «евреям 9 27» — всё ВЕРНО. НЕ пиши «почти» и НЕ снижай за двоеточие/пробел.
- ТЕКСТ стиха верен, если переданы ключевые слова и смысл. ИГНОРИРУЙ пунктуацию, регистр, мелкие союзы и частицы, порядок слов, словоформы. Поправляй ТОЛЬКО при искажении СМЫСЛА или пропуске КЛЮЧЕВЫХ слов.
- СМЫСЛ блока верен, если ученик передал суть своими словами — не требуй формулировок из конспекта дословно.

Хвали за верное и сразу давай следующее задание. Будь кратким и тёплым, отвечай по-русски, редкие уместные эмодзи. Никогда не показывай сразу весь материал. Если ученик просит — дай подсказку.

Форматирование ответа: разрешён лёгкий Markdown — **жирным** выделяй ключевое, текст стиха приводи цитатой через «> ». НЕ используй заголовки (#) и горизонтальные линии (---) — это чат.`

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
