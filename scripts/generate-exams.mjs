#!/usr/bin/env node
/**
 * generate-exams.mjs
 *
 * Этап 5 AI-first потока: генерирует вопросы промежуточного (mid) и финального
 * (final) экзаменов курса «КРЕСТ» через Claude Sonnet и заливает результат
 * в таблицу block_quiz_questions.
 *
 * Mid-exam (--type=mid):
 *   15 вопросов по блокам 1-5 (по 3 вопроса на каждый block_id).
 *   Флаги: is_mid_exam=TRUE, is_final_exam=FALSE.
 *   Pass-порог: MID_EXAM_PASS_PCT=80 (константа в apps/web/src/lib/ai/constants.ts).
 *
 * Final-exam (--type=final):
 *   25 вопросов по блокам 1-10 (~2-3 вопроса на блок, Sonnet решает распределение).
 *   Флаги: is_mid_exam=FALSE, is_final_exam=TRUE.
 *   Pass-порог: FINAL_EXAM_PASS_PCT=85 (константа в apps/web/src/lib/ai/constants.ts).
 *
 * Типы вопросов: ~70% single_choice, ~20% multi_choice, ~10% free_text.
 *
 * Идемпотентность: по умолчанию пропускает тип экзамена если вопросы уже есть.
 * --force делает DELETE существующих вопросов + INSERT новых.
 *
 * Логирование каждого вызова Sonnet — в ai_call_log (purpose='generate_quiz').
 *
 * Запуск:
 *   set -a; source apps/web/.env.local; set +a
 *   node scripts/generate-exams.mjs --type=mid --dry-run
 *   node scripts/generate-exams.mjs --type=mid --verbose
 *   node scripts/generate-exams.mjs --type=final --verbose
 *   node scripts/generate-exams.mjs --type=mid --force
 *   node scripts/generate-exams.mjs --help
 *
 * Требует в окружении:
 *   - SUPABASE_SERVICE_ROLE_KEY  (чтение block_resources, запись в block_quiz_questions и ai_call_log)
 *   - ANTHROPIC_API_KEY          (вызов Claude)
 *
 * Опционально:
 *   - NEXT_PUBLIC_SUPABASE_URL   (по умолчанию project ref aejhlmoydnhgedgfndql)
 */

// ============================================================
// Конфиг
// ============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aejhlmoydnhgedgfndql.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

// 25 вопросов финального экзамена ~250 токенов каждый + JSON-обёртка — запас 8192
const ANTHROPIC_MAX_TOKENS = 8192;
const ANTHROPIC_TIMEOUT_MS = 120_000;
const ANTHROPIC_RETRY_ATTEMPTS = 3;

const PURPOSE = 'generate_quiz';
const MIN_SUMMARY_LEN = 100; // минимальная длина каждого summary_md чтобы включить блок

// Количество вопросов по типам экзамена
const MID_EXAM_QUESTIONS = 15;
const MID_EXAM_BLOCKS = [1, 2, 3, 4, 5];
const MID_EXAM_PER_BLOCK = 3; // ровно 3 на каждый из 5 блоков

const FINAL_EXAM_QUESTIONS = 25;
const FINAL_EXAM_BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Sonnet 4.6 pricing (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 3.0;
const PRICE_OUTPUT_PER_1M = 15.0;

const TARGET_RESOURCE_TYPES = ['main_video', 'additional_video'];

// ============================================================
// CLI
// ============================================================

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { type: null, force: false, dryRun: false, verbose: false };
  for (const a of argv) {
    if (a === '--force') out.force = true;
    else if (a === '--dry-run' || a === '--dryrun') out.dryRun = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--type=')) {
      const t = a.slice('--type='.length);
      if (t !== 'mid' && t !== 'final') {
        die(`--type должен быть 'mid' или 'final', получено: ${a}`);
      }
      out.type = t;
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      die(`Неизвестный аргумент: ${a}. Запусти с --help.`);
    }
  }
  if (!out.type) {
    die(`Обязательный флаг --type=mid|final не задан. Запусти с --help.`);
  }
  return out;
}

function printHelp() {
  console.log(
    `Usage: node scripts/generate-exams.mjs --type=<mid|final> [--force] [--dry-run] [--verbose]\n\n` +
      `  --type=mid     промежуточный экзамен (15 вопросов, блоки 1-5)\n` +
      `  --type=final   финальный экзамен (25 вопросов, блоки 1-10)\n` +
      `  --force        удалить существующие вопросы экзамена и сгенерить заново\n` +
      `  --dry-run      показать план без вызовов API и записи в БД\n` +
      `  --verbose      подробный лог (системный промпт, сырой JSON-ответ, превью вопросов)\n`
  );
}

// ============================================================
// Системные промпты Sonnet
// ============================================================

function buildSystemPromptMid() {
  return `Ты — методист курса «КРЕСТ», составляешь промежуточный экзамен по первой половине курса (Блоки 1-5).

На вход — конспекты каждого из пяти блоков, разделённые строкой «=== БЛОК N: [Название] ===».

Твоя задача — вернуть ровно ${MID_EXAM_QUESTIONS} вопросов строго в виде JSON-массива.

**Распределение по блокам (обязательно):**
- Ровно 3 вопроса с block_num=1 (Малый Крест)
- Ровно 3 вопроса с block_num=2 (Принцип Сотворения)
- Ровно 3 вопроса с block_num=3 (Коренная Проблема)
- Ровно 3 вопроса с block_num=4 (Состояние Мира)
- Ровно 3 вопроса с block_num=5 (Состояние Неверующего)

**Распределение типов (~):**
- ~11 вопросов типа single_choice
- ~3 вопроса типа multi_choice
- ~1 вопрос типа free_text

**Фокус экзамена:**
- Промежуточный экзамен строже блочного квиза (порог сдачи 80%, не 75%).
- Акцент на Блоке 1: структуру и значение Малого Креста (евангелизационная схема), ключевые части Евреям 9:27 и Иоанна 19:30.
- Вопросы должны быть интегральными — связывать концепции разных блоков, а не просто воспроизводить факт одного блока. Пример: «Как принцип сотворения (Блок 2) объясняет коренную проблему (Блок 3)?»
- Вопросы по Блокам 4-5 проверяют понимание последствий грехопадения — для мира и для неверующего конкретно.
- Вопросы НЕ должны дублировать блочные квизы (они независимые, с разными формулировками).

**Структура каждого вопроса:**
{
  "question_text": "Полный текст вопроса на русском языке",
  "question_type": "single_choice" | "multi_choice" | "free_text",
  "block_num": 1-5,
  "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"] | null,
  "correct_indices": [0] | [1, 3] | null,
  "expected_answer": "краткое содержание правильного ответа (для free_text)" | null,
  "rubric": "критерии AI-проверки (для free_text): ответ верный если упоминает X, Y, Z; частично верный если только X; неверный если..." | null,
  "order_index": 1
}

**Обязательные правила:**
1. Опирайся ТОЛЬКО на содержание конспектов. Не выдумывай.
2. Проверяй ПОНИМАНИЕ и умение связывать концепции, а не зубрёжку.
3. НЕ повторяй один тезис в разных вопросах.
4. Варианты ответов — одинаковой длины (±20%), реалистичные дистракторы.
5. single_choice: correct_indices — массив из ровно одного индекса (0-based).
6. multi_choice: correct_indices — массив из 2-3 индексов (0-based).
7. free_text: options=null, correct_indices=null. rubric в стиле «верный если упоминает X, Y и Z» — ориентир для AI-проверки, не жёсткий чеклист.
8. order_index начинается с 1 и идёт по порядку до ${MID_EXAM_QUESTIONS}.
9. Вопросы расположи от простых (факт, определение) к сложным (связи, выводы). free_text — последним.

Выводи ТОЛЬКО JSON-массив из ${MID_EXAM_QUESTIONS} объектов. Никаких предисловий, пояснений, обёрток. Начинай сразу с [.`;
}

function buildSystemPromptFinal() {
  return `Ты — методист курса «КРЕСТ», составляешь финальный экзамен по всему курсу (Блоки 1-10).

На вход — конспекты каждого из десяти блоков, разделённые строкой «=== БЛОК N: [Название] ===».

Твоя задача — вернуть ровно ${FINAL_EXAM_QUESTIONS} вопросов строго в виде JSON-массива.

**Распределение по блокам (~2-3 вопроса на блок):**
Ты сам распределяешь вопросы по блокам, исходя из содержания и важности. Стремись к балансу: 2-3 вопроса на каждый блок.
Обязательные акценты:
- Блок 1 (Малый Крест): минимум 3 вопроса — структура схемы, ключевые стихи, смысл.
- Блок 8 (Иисус Христос): минимум 2 вопроса — роль Христа, искупление, жертва.
- Блок 10 (5 Уверенностей): минимум 3 вопроса — каждая из уверенностей, их Biblical-основание.

**Распределение типов (~):**
- ~17-18 вопросов типа single_choice
- ~5 вопросов типа multi_choice
- ~2-3 вопроса типа free_text

**Фокус финального экзамена:**
- Финальный экзамен — ИНТЕГРАЛЬНЫЙ. Большинство вопросов должны связывать концепции РАЗНЫХ блоков.
  Примеры интегральных вопросов:
  «Как принцип сотворения (Блок 2) связан с усилием человека (Блок 6) и его бесплодностью?»
  «Почему состояние неверующего (Блок 5) делает обетования (Блок 7) необходимыми?»
  «Чем благословения верующего (Блок 9) отличаются от состояния мира (Блок 4)?»
- Для free_text — вопросы концептуального уровня: объяснить суть Малого Креста как инструмента евангелизации, или описать путь от состояния неверующего до благословений верующего через крест Иисуса.
- Вопросы НЕ должны дублировать блочные квизы (независимые, свежие формулировки).
- Pass-порог: 85% — финальный экзамен строже промежуточного.

**Структура каждого вопроса:**
{
  "question_text": "Полный текст вопроса на русском языке",
  "question_type": "single_choice" | "multi_choice" | "free_text",
  "block_num": 1-10,
  "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"] | null,
  "correct_indices": [0] | [1, 3] | null,
  "expected_answer": "краткое содержание правильного ответа (для free_text)" | null,
  "rubric": "критерии AI-проверки (для free_text): ответ верный если упоминает X, Y, Z; частично верный если только X; неверный если..." | null,
  "order_index": 1
}

**Обязательные правила:**
1. Опирайся ТОЛЬКО на содержание конспектов. Не выдумывай.
2. Проверяй ПОНИМАНИЕ и умение связывать концепции между блоками.
3. НЕ повторяй один тезис в разных вопросах.
4. Варианты ответов — одинаковой длины (±20%), реалистичные дистракторы.
5. single_choice: correct_indices — массив из ровно одного индекса (0-based).
6. multi_choice: correct_indices — массив из 2-3 индексов (0-based).
7. free_text: options=null, correct_indices=null. rubric — ориентир для AI-проверки, не жёсткий чеклист.
8. order_index начинается с 1 и идёт по порядку до ${FINAL_EXAM_QUESTIONS}.
9. Вопросы расположи от простых к сложным. Интегральные и free_text — в конце.

Выводи ТОЛЬКО JSON-массив из ${FINAL_EXAM_QUESTIONS} объектов. Никаких предисловий, пояснений, обёрток. Начинай сразу с [.`;
}

function buildUserMessage({ examType, blockSummaries }) {
  // blockSummaries: [{blockId, blockNum, blockTitle, summaryText}]
  const sections = blockSummaries.map(
    (b) => `=== БЛОК ${b.blockNum}: ${b.blockTitle} ===\n\n${b.summaryText}`
  );
  const label = examType === 'mid'
    ? 'Промежуточный экзамен — блоки 1-5'
    : 'Финальный экзамен — блоки 1-10';

  return [
    label,
    '',
    sections.join('\n\n'),
  ].join('\n');
}

// ============================================================
// Supabase REST helpers (service-role)
// ============================================================

function sbHeaders(extra = {}) {
  if (!SERVICE_KEY) die('SUPABASE_SERVICE_ROLE_KEY не задан в окружении.');
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchBlockInfo(blockId) {
  const params = new URLSearchParams();
  params.set('select', 'id,title_ru,order_num');
  params.set('id', `eq.${blockId}`);
  params.set('limit', '1');

  const url = `${SUPABASE_URL}/rest/v1/blocks?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return { id: blockId, title_ru: `Блок ${blockId}`, order_num: blockId };
  const rows = await res.json();
  return rows?.[0] || { id: blockId, title_ru: `Блок ${blockId}`, order_num: blockId };
}

/**
 * Читает summary_md для одного блока (main_video + additional_video).
 * Возвращает конкатенат через «---» если их несколько.
 */
async function fetchSummaryForBlock(blockId) {
  const params = new URLSearchParams();
  params.set('select', 'resource_type,title_ru,summary_md');
  params.set('block_id', `eq.${blockId}`);
  params.set('resource_type', `in.(${TARGET_RESOURCE_TYPES.join(',')})`);
  params.set('summary_md', 'not.is.null');
  params.set('order', 'resource_type.asc');

  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка чтения summary_md для блока ${blockId}: ${res.status} ${t.slice(0, 300)}`);
  }
  const rows = await res.json();
  if (rows.length === 0) return null;
  return rows.map((r) => r.summary_md.trim()).join('\n\n---\n\n');
}

/**
 * Проверяет, есть ли уже вопросы нужного типа экзамена в БД.
 */
async function hasExistingExamQuestions(examType) {
  const isMid = examType === 'mid';
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('is_mid_exam', `eq.${isMid}`);
  params.set('is_final_exam', `eq.${!isMid}`);
  params.set('limit', '1');

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка проверки block_quiz_questions: ${res.status} ${t.slice(0, 300)}`);
  }
  const rows = await res.json();
  return rows.length > 0;
}

/**
 * Удаляет существующие вопросы нужного типа экзамена (--force).
 */
async function deleteExistingExamQuestions(examType) {
  const isMid = examType === 'mid';
  const params = new URLSearchParams();
  params.set('is_mid_exam', `eq.${isMid}`);
  params.set('is_final_exam', `eq.${!isMid}`);

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions?${params.toString()}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка DELETE экзаменационных вопросов (${examType}): ${res.status} ${t.slice(0, 300)}`);
  }
}

/**
 * INSERT вопросов экзамена в block_quiz_questions.
 * blockIdByNum: Map<blockNum, blockId> — маппинг порядкового номера блока на UUID/int id в БД.
 */
async function insertExamQuestions(examType, questions, blockIdByNum) {
  const isMid = examType === 'mid';

  const rows = questions.map((q) => {
    const blockId = blockIdByNum.get(q.block_num);
    if (!blockId) {
      throw new Error(`block_num=${q.block_num} не найден в маппинге blockIdByNum`);
    }
    return {
      block_id: blockId,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options !== null && q.options !== undefined ? q.options : null,
      correct_indices:
        q.correct_indices !== null && q.correct_indices !== undefined ? q.correct_indices : null,
      expected_answer: q.expected_answer || null,
      rubric: q.rubric || null,
      order_index: q.order_index,
      is_mid_exam: isMid,
      is_final_exam: !isMid,
      generated_by_ai: true,
      edited_manually: false,
    };
  });

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка INSERT экзаменационных вопросов (${examType}): ${res.status} ${t.slice(0, 300)}`);
  }
}

async function logAiCall({
  model,
  inputTokens,
  outputTokens,
  durationMs,
  success,
  errorMessage,
}) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/ai_call_log`;
    const res = await fetch(url, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        provider: 'anthropic',
        model,
        purpose: PURPOSE,
        user_id: null,
        input_tokens: inputTokens ?? null,
        output_tokens: outputTokens ?? null,
        duration_ms: durationMs ?? null,
        success,
        error_message: errorMessage ?? null,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[ai_call_log] insert failed: ${res.status} ${t.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn(`[ai_call_log] exception:`, e?.message || e);
  }
}

// ============================================================
// Anthropic
// ============================================================

async function callAnthropic({ systemPrompt, userMessage }) {
  if (!ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY не задан в окружении.');

  let lastError = null;
  const startedAt = Date.now();
  const model = CLAUDE_SONNET_MODEL;

  for (let attempt = 1; attempt <= ANTHROPIC_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`);
        if (res.status >= 500 || res.status === 429) {
          await sleep(backoffMs(attempt));
          continue;
        }
        await logAiCall({
          model,
          inputTokens: null,
          outputTokens: null,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: String(lastError),
        });
        throw lastError;
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      const inputTokens = data?.usage?.input_tokens ?? 0;
      const outputTokens = data?.usage?.output_tokens ?? 0;
      const durationMs = Date.now() - startedAt;

      await logAiCall({
        model,
        inputTokens,
        outputTokens,
        durationMs,
        success: true,
        errorMessage: null,
      });

      return { text, inputTokens, outputTokens, durationMs };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < ANTHROPIC_RETRY_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  await logAiCall({
    model,
    inputTokens: null,
    outputTokens: null,
    durationMs: Date.now() - startedAt,
    success: false,
    errorMessage: String(lastError),
  });
  throw lastError instanceof Error ? lastError : new Error('Anthropic call failed');
}

function backoffMs(attempt) {
  return 500 * 3 ** (attempt - 1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// JSON-парсер с поддержкой ```json fenced```
// ============================================================

function parseExamJson(rawText) {
  let text = String(rawText || '').trim();

  // Снять обёртку ```json ... ``` или ``` ... ```
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  // Если модель добавила что-то до/после JSON-массива — вырезаем
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart === -1 || arrEnd === -1 || arrEnd < arrStart) {
    throw new Error(`JSON-массив не найден в ответе Sonnet. Начало ответа: ${text.slice(0, 200)}`);
  }
  text = text.slice(arrStart, arrEnd + 1);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Не удалось распарсить JSON: ${e.message}. Фрагмент: ${text.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Ожидался JSON-массив, получено: ${typeof parsed}`);
  }

  return parsed;
}

// ============================================================
// Валидация вопросов
// ============================================================

const ALLOWED_TYPES = new Set(['single_choice', 'multi_choice', 'free_text']);

function validateExamQuestions(questions, examType) {
  const errors = [];
  const expectedCount = examType === 'mid' ? MID_EXAM_QUESTIONS : FINAL_EXAM_QUESTIONS;
  const allowedBlocks = examType === 'mid' ? MID_EXAM_BLOCKS : FINAL_EXAM_BLOCKS;

  if (questions.length !== expectedCount) {
    errors.push(`Ожидалось ${expectedCount} вопросов, получено ${questions.length}`);
  }

  const typeCounts = { single_choice: 0, multi_choice: 0, free_text: 0 };
  const blockCounts = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prefix = `Вопрос #${i + 1}`;

    if (!q.question_text || typeof q.question_text !== 'string' || q.question_text.trim().length < 5) {
      errors.push(`${prefix}: question_text пустой или слишком короткий`);
    }
    if (!ALLOWED_TYPES.has(q.question_type)) {
      errors.push(`${prefix}: недопустимый question_type «${q.question_type}»`);
      continue;
    }

    typeCounts[q.question_type] = (typeCounts[q.question_type] || 0) + 1;

    if (typeof q.block_num !== 'number' || !allowedBlocks.includes(q.block_num)) {
      errors.push(`${prefix}: block_num=${q.block_num} не входит в допустимые блоки [${allowedBlocks.join(', ')}]`);
    } else {
      blockCounts[q.block_num] = (blockCounts[q.block_num] || 0) + 1;
    }

    if (q.question_type === 'single_choice' || q.question_type === 'multi_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`${prefix}: options должен быть массивом минимум из 2 элементов`);
      }
      if (!Array.isArray(q.correct_indices) || q.correct_indices.length === 0) {
        errors.push(`${prefix}: correct_indices должен быть непустым массивом`);
      } else if (q.question_type === 'single_choice' && q.correct_indices.length !== 1) {
        errors.push(`${prefix}: single_choice должен иметь ровно 1 correct_index, получено ${q.correct_indices.length}`);
      } else if (q.question_type === 'multi_choice' && (q.correct_indices.length < 2 || q.correct_indices.length > 3)) {
        errors.push(`${prefix}: multi_choice должен иметь 2-3 correct_indices, получено ${q.correct_indices.length}`);
      }
    }

    if (q.question_type === 'free_text') {
      if (!q.expected_answer || q.expected_answer.trim().length < 10) {
        errors.push(`${prefix}: free_text должен иметь expected_answer`);
      }
      if (!q.rubric || q.rubric.trim().length < 10) {
        errors.push(`${prefix}: free_text должен иметь rubric`);
      }
    }

    if (typeof q.order_index !== 'number' || q.order_index < 1) {
      q.order_index = i + 1;
    }
  }

  // Предупреждения (не fatal)
  if (examType === 'mid') {
    for (const bn of MID_EXAM_BLOCKS) {
      const cnt = blockCounts[bn] || 0;
      if (cnt !== MID_EXAM_PER_BLOCK) {
        console.warn(`   Предупреждение: ожидалось ${MID_EXAM_PER_BLOCK} вопросов для блока ${bn}, получено ${cnt}`);
      }
    }
  } else {
    for (const bn of FINAL_EXAM_BLOCKS) {
      const cnt = blockCounts[bn] || 0;
      if (cnt < 2 || cnt > 4) {
        console.warn(`   Предупреждение: для блока ${bn} получено ${cnt} вопросов (ожидалось 2-3)`);
      }
    }
  }

  // Предупреждения по типам
  const totalQ = questions.length;
  const expectedSingle = Math.round(totalQ * 0.70);
  const expectedMulti = Math.round(totalQ * 0.20);
  if (typeCounts.single_choice < expectedSingle - 3) {
    console.warn(`   Предупреждение: single_choice=${typeCounts.single_choice}, ожидалось ~${expectedSingle}`);
  }
  if (typeCounts.multi_choice < 1) {
    console.warn(`   Предупреждение: нет ни одного multi_choice вопроса`);
  }
  if (typeCounts.free_text < 1) {
    console.warn(`   Предупреждение: нет ни одного free_text вопроса`);
  }

  // Принудительно присваиваем order_index по позиции
  questions.forEach((q, idx) => {
    q.order_index = idx + 1;
  });

  return errors;
}

// ============================================================
// Стоимость
// ============================================================

function estimateCostUsd(inputTokens, outputTokens) {
  return (
    (inputTokens * PRICE_INPUT_PER_1M) / 1_000_000 +
    (outputTokens * PRICE_OUTPUT_PER_1M) / 1_000_000
  );
}

// ============================================================
// Утилиты
// ============================================================

function die(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

// ============================================================
// Main
// ============================================================

async function main() {
  if (!SERVICE_KEY) die('SUPABASE_SERVICE_ROLE_KEY не задан.');
  if (!args.dryRun && !ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY не задан.');

  const examType = args.type;
  const blockNums = examType === 'mid' ? MID_EXAM_BLOCKS : FINAL_EXAM_BLOCKS;
  const totalExpected = examType === 'mid' ? MID_EXAM_QUESTIONS : FINAL_EXAM_QUESTIONS;
  const examLabel = examType === 'mid' ? 'Промежуточный (mid)' : 'Финальный (final)';

  console.log(
    `[generate-exams] start | type=${examType} dryRun=${args.dryRun} force=${args.force} verbose=${args.verbose}`
  );
  console.log(`[generate-exams] ${examLabel} экзамен — ${totalExpected} вопросов, блоки: ${blockNums.join(', ')}`);

  // 1. Идемпотентность: проверяем наличие существующих вопросов
  if (!args.force) {
    let hasExisting = false;
    try {
      hasExisting = await hasExistingExamQuestions(examType);
    } catch (e) {
      die(`Ошибка проверки существующих вопросов: ${e?.message || e}`);
    }
    if (hasExisting) {
      console.log(
        `[generate-exams] вопросы ${examLabel} экзамена уже есть в БД. ` +
        `Используй --force для удаления и повторной генерации.`
      );
      return;
    }
  }

  // 2. Загружаем инфо о блоках и их summary_md
  console.log(`[generate-exams] загружаем конспекты для ${blockNums.length} блоков...`);

  const blockSummaries = [];
  const blockIdByNum = new Map(); // blockNum -> blockId (из БД)
  const missingSummaries = [];

  for (const blockNum of blockNums) {
    const blockInfo = await fetchBlockInfo(blockNum);
    blockIdByNum.set(blockNum, blockInfo.id ?? blockNum);

    const summaryText = await fetchSummaryForBlock(blockNum).catch((e) => {
      console.warn(`   Предупреждение: не удалось загрузить summary_md для блока ${blockNum}: ${e?.message}`);
      return null;
    });

    if (!summaryText || summaryText.length < MIN_SUMMARY_LEN) {
      missingSummaries.push(blockNum);
      console.warn(
        `   Предупреждение: блок ${blockNum} «${blockInfo.title_ru}» — ` +
        (summaryText ? `summary_md слишком короткий (${summaryText.length} симв)` : 'нет summary_md') +
        '. Заменяем на заглушку.'
      );
      // Используем заглушку чтобы не падать — Sonnet должен сгенерить что-то по названию
      blockSummaries.push({
        blockId: blockInfo.id ?? blockNum,
        blockNum,
        blockTitle: blockInfo.title_ru,
        summaryText: `[Конспект для блока «${blockInfo.title_ru}» пока недоступен. Блок посвящён теме: ${blockInfo.title_ru}.]`,
      });
    } else {
      console.log(`   + Блок ${blockNum} «${blockInfo.title_ru}» — ${summaryText.length} симв конспекта`);
      blockSummaries.push({
        blockId: blockInfo.id ?? blockNum,
        blockNum,
        blockTitle: blockInfo.title_ru,
        summaryText,
      });
    }
  }

  if (missingSummaries.length > 0) {
    console.warn(
      `[generate-exams] Предупреждение: ${missingSummaries.length} блоков без summary_md: ${missingSummaries.join(', ')}. ` +
      `Качество вопросов по этим блокам будет ниже. ` +
      `Рекомендуется сначала запустить transcripts-to-summaries.mjs.`
    );
  }

  // 3. Показываем план (dry-run — останавливаемся)
  const totalLen = blockSummaries.reduce((s, b) => s + b.summaryText.length, 0);
  console.log(
    `[generate-exams] план: ${examLabel} экзамен, ${blockSummaries.length} блоков, ` +
    `суммарно ~${totalLen} симв конспектов, ожидается ${totalExpected} вопросов.`
  );

  if (args.verbose) {
    const sysPrompt = examType === 'mid' ? buildSystemPromptMid() : buildSystemPromptFinal();
    console.log(`[generate-exams] системный промпт (${sysPrompt.length} симв):`);
    console.log(sysPrompt.slice(0, 400) + '\n   ...');
  }

  if (args.dryRun) {
    console.log('\n[generate-exams] --dry-run: API не вызываем, БД не трогаем.');
    return;
  }

  // 4. Если --force — удаляем существующие вопросы
  if (args.force) {
    try {
      await deleteExistingExamQuestions(examType);
      console.log(`[generate-exams] --force: существующие вопросы ${examLabel} экзамена удалены.`);
    } catch (e) {
      die(`Ошибка удаления существующих вопросов: ${e?.message || e}`);
    }
  }

  // 5. Вызываем Sonnet
  const systemPrompt = examType === 'mid' ? buildSystemPromptMid() : buildSystemPromptFinal();
  const userMessage = buildUserMessage({ examType, blockSummaries });

  if (args.verbose) {
    console.log(`[generate-exams] user message (${userMessage.length} симв), первые 500 симв:`);
    console.log(userMessage.slice(0, 500) + '\n   ...');
  }

  console.log(`[generate-exams] вызываем Sonnet (max_tokens=${ANTHROPIC_MAX_TOKENS})...`);

  let result;
  try {
    result = await callAnthropic({ systemPrompt, userMessage });
  } catch (e) {
    die(`Anthropic упал: ${e?.message || e}`);
  }

  console.log(
    `[generate-exams] Sonnet ответил за ${(result.durationMs / 1000).toFixed(1)}с | ` +
    `${result.inputTokens} in / ${result.outputTokens} out tokens`
  );

  if (args.verbose) {
    console.log(`[generate-exams] raw response (${result.text.length} симв), первые 800 симв:`);
    console.log(result.text.slice(0, 800));
    console.log('   ---');
  }

  // 6. Парсим JSON
  let questions;
  try {
    questions = parseExamJson(result.text);
  } catch (e) {
    die(`Не удалось распарсить JSON из ответа Sonnet: ${e?.message || e}\nОтвет: ${result.text.slice(0, 500)}`);
  }

  // 7. Валидируем
  const validationErrors = validateExamQuestions(questions, examType);
  if (validationErrors.length > 0) {
    console.error(`[generate-exams] валидация не прошла (${validationErrors.length} ошибок):`);
    for (const err of validationErrors) {
      console.error(`   - ${err}`);
    }
    die('Остановлено из-за ошибок валидации. Запусти с --verbose чтобы увидеть сырой ответ.');
  }

  console.log(`[generate-exams] распарсено ${questions.length} вопросов, валидация OK.`);

  if (args.verbose) {
    console.log('[generate-exams] превью вопросов:');
    for (const q of questions) {
      const typeBadge =
        q.question_type === 'single_choice' ? '[1]' :
        q.question_type === 'multi_choice' ? '[M]' : '[?]';
      console.log(`   ${q.order_index}. Блок ${q.block_num} ${typeBadge} ${q.question_text.slice(0, 80)}...`);
    }
  }

  // 8. INSERT в БД
  try {
    await insertExamQuestions(examType, questions, blockIdByNum);
  } catch (e) {
    die(`Ошибка INSERT в block_quiz_questions: ${e?.message || e}`);
  }

  // 9. Итоговая сводка
  const cost = estimateCostUsd(result.inputTokens, result.outputTokens);
  console.log(
    `\n[generate-exams] итог: ${questions.length} вопросов записано в block_quiz_questions ` +
    `(is_${examType}_exam=TRUE).`
  );
  console.log(
    `   токены: ${result.inputTokens} in / ${result.outputTokens} out — ` +
    `≈ $${cost.toFixed(4)} (Sonnet 4.6, ${PRICE_INPUT_PER_1M}/${PRICE_OUTPUT_PER_1M} per 1M)`
  );
  console.log(
    `   время вызова API: ${(result.durationMs / 1000).toFixed(1)}с`
  );
  console.log(
    `   Pass-порог: ${examType === 'mid' ? 'MID_EXAM_PASS_PCT=80%' : 'FINAL_EXAM_PASS_PCT=85%'} ` +
    `(константа в apps/web/src/lib/ai/constants.ts)`
  );
}

main().catch((err) => {
  console.error('[FATAL]', err?.stack || err);
  process.exit(1);
});
