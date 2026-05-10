#!/usr/bin/env node
/**
 * generate-quizzes.mjs
 *
 * Этап 3 AI-first потока: генерирует квиз-вопросы по блокам курса «КРЕСТ»
 * на основе summary_md (конспектов) через Claude Sonnet и заливает результат
 * в таблицу block_quiz_questions.
 *
 * Читает summary_md из block_resources (main_video / additional_video),
 * конкатенирует оба если два, отправляет в Sonnet, парсит JSON-массив из 8
 * вопросов (5 single_choice, 2 multi_choice, 1 free_text), INSERT в БД.
 *
 * Идемпотентность: по умолчанию пропускает блок если в block_quiz_questions
 * уже есть записи с is_mid_exam=FALSE AND is_final_exam=FALSE для этого блока.
 *
 * Логирование каждого вызова Sonnet — в ai_call_log (purpose='generate_quiz').
 *
 * Запуск:
 *   set -a; source apps/web/.env.local; set +a
 *   node scripts/generate-quizzes.mjs              # все блоки без квизов
 *   node scripts/generate-quizzes.mjs --block=1    # только блок 1
 *   node scripts/generate-quizzes.mjs --force      # перегенерить даже если уже есть
 *   node scripts/generate-quizzes.mjs --dry-run    # показать план без вызовов API/БД
 *   node scripts/generate-quizzes.mjs --verbose    # подробный лог (промпт, JSON-ответ)
 *   node scripts/generate-quizzes.mjs --help
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
const ANTHROPIC_MAX_TOKENS = 4096;
const ANTHROPIC_TIMEOUT_MS = 90_000;
const ANTHROPIC_RETRY_ATTEMPTS = 3;

const PURPOSE = 'generate_quiz';
const SLEEP_BETWEEN_CALLS_MS = 1000;
const MIN_SUMMARY_LEN = 200; // короче — даже не отправляем в Sonnet
const QUESTIONS_PER_BLOCK = 8;

const TARGET_RESOURCE_TYPES = ['main_video', 'additional_video'];

// Sonnet 4.6 pricing (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 3.0;
const PRICE_OUTPUT_PER_1M = 15.0;

// ============================================================
// CLI
// ============================================================

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { block: null, force: false, dryRun: false, verbose: false };
  for (const a of argv) {
    if (a === '--force') out.force = true;
    else if (a === '--dry-run' || a === '--dryrun') out.dryRun = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--block=')) {
      const n = Number(a.slice('--block='.length));
      if (!Number.isFinite(n) || n < 1 || n > 10) {
        die(`--block должен быть числом 1..10, получено: ${a}`);
      }
      out.block = n;
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      die(`Неизвестный аргумент: ${a}. Запусти с --help.`);
    }
  }
  return out;
}

function printHelp() {
  console.log(
    `Usage: node scripts/generate-quizzes.mjs [--block=N] [--force] [--dry-run] [--verbose]\n\n` +
      `  --block=N    обработать только блок N (1..10)\n` +
      `  --force      перегенерировать даже если квизы уже есть (удаляет старые и вставляет новые)\n` +
      `  --dry-run    показать план без вызовов API и записи в БД\n` +
      `  --verbose    подробный лог (показывать системный промпт, сырой JSON-ответ, превью вопросов)\n`
  );
}

// ============================================================
// Системный промпт Sonnet
// ============================================================

const SYSTEM_PROMPT = `Ты — методист курса «КРЕСТ», создаёшь тест по блоку курса.

На вход — markdown-конспект одного или нескольких видео блока (если два видео — разделены строкой «---»).

Твоя задача — вернуть ровно ${QUESTIONS_PER_BLOCK} вопросов теста строго в виде JSON-массива.

Структура каждого вопроса:
{
  "question_text": "Полный текст вопроса на русском языке",
  "question_type": "single_choice" | "multi_choice" | "free_text",
  "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"] | null,
  "correct_indices": [0] | [1, 3] | null,
  "expected_answer": "краткое содержание правильного ответа (для free_text)" | null,
  "rubric": "критерии AI-проверки (для free_text)" | null,
  "order_index": 1
}

Распределение типов (ровно):
- 5 вопросов типа single_choice (4 варианта, ровно 1 правильный)
- 2 вопроса типа multi_choice (4-5 вариантов, от 2 до 3 правильных)
- 1 вопрос типа free_text (открытый ответ 2-4 предложения, с expected_answer и rubric)

Обязательные правила:
1. Опирайся ТОЛЬКО на содержание конспекта. Если факта нет в конспекте — не выдумывай.
2. Проверяй ПОНИМАНИЕ, а не зубрёжку: вопросы уровня «что такое X», «зачем Y», «почему X следует из Y», «какое из утверждений верно о Z».
3. НЕ повторяй один и тот же тезис разными формулировками в разных вопросах.
4. Варианты ответов для single_choice и multi_choice — одинаковой длины (±20% символов), реалистичные дистракторы (не очевидно неправильные, не абсурдные).
5. Для single_choice: correct_indices — массив из ровно одного индекса (0-based).
6. Для multi_choice: correct_indices — массив из 2-3 индексов (0-based).
7. Для free_text: options=null, correct_indices=null. expected_answer — краткий правильный ответ (1-3 предложения). rubric — инструкция для AI-проверки в стиле «ответ верный если упоминает X, Y и Z; частично верный если упоминает только X; неверный если...».
8. order_index начинается с 1 и идёт по порядку до ${QUESTIONS_PER_BLOCK}.
9. Вопросы расположи от простых (определение, факт) к сложным (связи, выводы). free_text — последним.

Выводи ТОЛЬКО JSON-массив из ${QUESTIONS_PER_BLOCK} объектов. Никаких предисловий, пояснений, обёрток. Начинай сразу с [.`;

function buildUserMessage({ blockTitle, summaryText }) {
  return [
    `Блок: «${blockTitle}»`,
    '',
    'Конспект блока:',
    '',
    summaryText,
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

/**
 * Возвращает уникальные block_id из block_resources, у которых есть summary_md,
 * в порядке возрастания. Если --block=N — только тот блок.
 */
async function fetchBlockIds() {
  const params = new URLSearchParams();
  params.set('select', 'block_id');
  params.set(
    'resource_type',
    `in.(${TARGET_RESOURCE_TYPES.join(',')})`
  );
  params.set('summary_md', 'not.is.null');
  if (args.block !== null) params.set('block_id', `eq.${args.block}`);
  params.set('order', 'block_id.asc');

  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    die(`Ошибка чтения block_resources: ${res.status} ${t.slice(0, 300)}`);
  }
  const rows = await res.json();
  // Дедуплицируем — нужны уникальные block_id
  const seen = new Set();
  const ids = [];
  for (const r of rows) {
    if (!seen.has(r.block_id)) {
      seen.add(r.block_id);
      ids.push(r.block_id);
    }
  }
  return ids;
}

/**
 * Читает summary_md для всех ресурсов блока (main_video + additional_video).
 * Возвращает конкатенат через «---» если их несколько.
 */
async function fetchSummariesForBlock(blockId) {
  const params = new URLSearchParams();
  params.set('select', 'resource_type,title_ru,summary_md');
  params.set('block_id', `eq.${blockId}`);
  params.set(
    'resource_type',
    `in.(${TARGET_RESOURCE_TYPES.join(',')})`
  );
  params.set('summary_md', 'not.is.null');
  params.set('order', 'resource_type.asc'); // main_video перед additional_video

  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка чтения summary_md для блока ${blockId}: ${res.status} ${t.slice(0, 300)}`);
  }
  const rows = await res.json();
  return rows; // [{resource_type, title_ru, summary_md}, ...]
}

/**
 * Проверяет, есть ли в block_quiz_questions обычные вопросы для блока
 * (is_mid_exam=FALSE AND is_final_exam=FALSE).
 */
async function hasExistingQuestions(blockId) {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('block_id', `eq.${blockId}`);
  params.set('is_mid_exam', 'eq.false');
  params.set('is_final_exam', 'eq.false');
  params.set('limit', '1');

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка проверки block_quiz_questions для блока ${blockId}: ${res.status} ${t.slice(0, 300)}`);
  }
  const rows = await res.json();
  return rows.length > 0;
}

/**
 * Удаляет существующие обычные вопросы блока перед перегенерацией (--force).
 */
async function deleteExistingQuestions(blockId) {
  const params = new URLSearchParams();
  params.set('block_id', `eq.${blockId}`);
  params.set('is_mid_exam', 'eq.false');
  params.set('is_final_exam', 'eq.false');

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions?${params.toString()}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка DELETE block_quiz_questions для блока ${blockId}: ${res.status} ${t.slice(0, 300)}`);
  }
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
 * INSERT 8 строк в block_quiz_questions для данного блока.
 */
async function insertQuestions(blockId, questions) {
  const rows = questions.map((q) => ({
    block_id: blockId,
    question_type: q.question_type,
    question_text: q.question_text,
    options: q.options !== null && q.options !== undefined ? q.options : null,
    correct_indices:
      q.correct_indices !== null && q.correct_indices !== undefined ? q.correct_indices : null,
    expected_answer: q.expected_answer || null,
    rubric: q.rubric || null,
    order_index: q.order_index,
    is_mid_exam: false,
    is_final_exam: false,
    generated_by_ai: true,
    edited_manually: false,
  }));

  const url = `${SUPABASE_URL}/rest/v1/block_quiz_questions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Ошибка INSERT block_quiz_questions для блока ${blockId}: ${res.status} ${t.slice(0, 300)}`);
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

function parseQuizJson(rawText) {
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
// Валидация вопросов (проверяем что Sonnet выполнил инструкции)
// ============================================================

const ALLOWED_TYPES = new Set(['single_choice', 'multi_choice', 'free_text']);

function validateQuestions(questions, blockId) {
  const errors = [];

  if (questions.length !== QUESTIONS_PER_BLOCK) {
    errors.push(`Ожидалось ${QUESTIONS_PER_BLOCK} вопросов, получено ${questions.length}`);
  }

  const typeCounts = { single_choice: 0, multi_choice: 0, free_text: 0 };

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
      // Исправляем автоматически — не фатальная ошибка
      q.order_index = i + 1;
    }
  }

  // Предупреждения о распределении типов (не fatal)
  if (typeCounts.single_choice !== 5) {
    console.warn(`   ⚠ блок ${blockId}: ожидалось 5 single_choice, получено ${typeCounts.single_choice}`);
  }
  if (typeCounts.multi_choice !== 2) {
    console.warn(`   ⚠ блок ${blockId}: ожидалось 2 multi_choice, получено ${typeCounts.multi_choice}`);
  }
  if (typeCounts.free_text !== 1) {
    console.warn(`   ⚠ блок ${blockId}: ожидалось 1 free_text, получено ${typeCounts.free_text}`);
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

  console.log(
    `[generate-quizzes] start | dryRun=${args.dryRun} force=${args.force} block=${args.block ?? 'all'} verbose=${args.verbose}`
  );

  // 1. Получаем блоки с готовыми summary_md
  const blockIds = await fetchBlockIds();
  if (blockIds.length === 0) {
    console.log(
      args.block !== null
        ? `[generate-quizzes] блок ${args.block} не найден или у него нет summary_md в block_resources.`
        : '[generate-quizzes] нет блоков с summary_md в block_resources. Сначала запусти transcripts-to-summaries.mjs.'
    );
    return;
  }

  // 2. Загружаем инфо о блоках и summary_md, фильтруем пропуски
  console.log(`[generate-quizzes] найдено блоков с summary_md: ${blockIds.length}`);

  const plan = []; // [{blockId, blockInfo, summaries, summaryText, skip, skipReason}]

  for (const blockId of blockIds) {
    const blockInfo = await fetchBlockInfo(blockId);
    const summaries = await fetchSummariesForBlock(blockId);

    if (summaries.length === 0) {
      plan.push({ blockId, blockInfo, summaries, summaryText: '', skip: true, skipReason: 'нет summary_md' });
      continue;
    }

    // Конкатенируем summary_md через разделитель если их несколько
    const summaryText = summaries
      .map((s) => s.summary_md.trim())
      .join('\n\n---\n\n');

    if (summaryText.length < MIN_SUMMARY_LEN) {
      plan.push({ blockId, blockInfo, summaries, summaryText, skip: true, skipReason: `summary_md слишком короткий (${summaryText.length} симв)` });
      continue;
    }

    // Проверяем идемпотентность
    if (!args.force) {
      const hasQuestions = await hasExistingQuestions(blockId);
      if (hasQuestions) {
        plan.push({ blockId, blockInfo, summaries, summaryText, skip: true, skipReason: 'квизы уже есть (используй --force для пересоздания)' });
        continue;
      }
    }

    plan.push({ blockId, blockInfo, summaries, summaryText, skip: false, skipReason: null });
  }

  // 3. Выводим план
  const toProcess = plan.filter((p) => !p.skip);
  const toSkip = plan.filter((p) => p.skip);

  if (toSkip.length > 0) {
    console.log(`[generate-quizzes] пропускаем ${toSkip.length} блоков:`);
    for (const p of toSkip) {
      console.log(`   — Блок ${p.blockId} «${p.blockInfo.title_ru}»: ${p.skipReason}`);
    }
  }

  if (toProcess.length === 0) {
    console.log('[generate-quizzes] нечего обрабатывать. Используй --force для пересоздания.');
    return;
  }

  console.log(`[generate-quizzes] к обработке ${toProcess.length} блоков:`);
  for (const p of toProcess) {
    const totalLen = p.summaryText.length;
    const parts = p.summaries.map((s) => `${s.resource_type}`).join(' + ');
    console.log(
      `   • Блок ${p.blockId} «${p.blockInfo.title_ru}» [${parts}] — конспект ${totalLen} симв${args.force ? ' (--force: старые вопросы будут удалены)' : ''}`
    );
  }

  if (args.dryRun) {
    console.log('\n[generate-quizzes] --dry-run: API не вызываем, БД не трогаем.');
    return;
  }

  // 4. Обрабатываем блоки
  let done = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalMs = 0;
  let totalQuestions = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    const { blockId, blockInfo, summaryText } = p;

    console.log(
      `\n[${i + 1}/${toProcess.length}] Блок ${blockId} «${blockInfo.title_ru}»`
    );

    const userMessage = buildUserMessage({
      blockTitle: blockInfo.title_ru,
      summaryText,
    });

    if (args.verbose) {
      console.log(`   --- system prompt (${SYSTEM_PROMPT.length} симв) ---`);
      console.log(`   --- user message (${userMessage.length} симв) ---`);
    }

    // Вызываем Sonnet
    let result;
    try {
      result = await callAnthropic({ systemPrompt: SYSTEM_PROMPT, userMessage });
    } catch (e) {
      console.error(`   ✗ Anthropic упал:`, e?.message || e);
      failed++;
      continue;
    }

    console.log(
      `   ✓ Anthropic ответил за ${(result.durationMs / 1000).toFixed(1)}с | ${result.inputTokens} in / ${result.outputTokens} out`
    );

    if (args.verbose) {
      console.log(`   --- raw response (${result.text.length} симв) ---`);
      console.log(result.text.slice(0, 600));
      console.log('   ---');
    }

    // Парсим JSON
    let questions;
    try {
      questions = parseQuizJson(result.text);
    } catch (e) {
      console.error(`   ✗ Не удалось распарсить JSON:`, e?.message || e);
      failed++;
      continue;
    }

    // Валидируем
    const validationErrors = validateQuestions(questions, blockId);
    if (validationErrors.length > 0) {
      console.error(`   ✗ Валидация не прошла (${validationErrors.length} ошибок):`);
      for (const err of validationErrors) {
        console.error(`      - ${err}`);
      }
      failed++;
      continue;
    }

    console.log(`   ✓ Распарсено ${questions.length} вопросов, валидация OK`);

    if (args.verbose) {
      console.log('   --- превью вопросов ---');
      for (const q of questions) {
        const typeBadge = q.question_type === 'single_choice' ? '[1]' : q.question_type === 'multi_choice' ? '[M]' : '[?]';
        console.log(`   ${q.order_index}. ${typeBadge} ${q.question_text.slice(0, 80)}...`);
      }
      console.log('   ---');
    }

    // Если --force — удаляем старые перед вставкой
    if (args.force) {
      try {
        await deleteExistingQuestions(blockId);
        console.log(`   ✓ Старые вопросы удалены (--force)`);
      } catch (e) {
        console.error(`   ✗ Ошибка удаления старых вопросов:`, e?.message || e);
        failed++;
        continue;
      }
    }

    // INSERT в БД
    try {
      await insertQuestions(blockId, questions);
    } catch (e) {
      console.error(`   ✗ Ошибка INSERT:`, e?.message || e);
      failed++;
      continue;
    }

    done++;
    totalIn += result.inputTokens;
    totalOut += result.outputTokens;
    totalMs += result.durationMs;
    totalQuestions += questions.length;

    console.log(`   ✓ ${questions.length} вопросов записано в block_quiz_questions`);

    // Rate-limit между вызовами
    if (i < toProcess.length - 1) await sleep(SLEEP_BETWEEN_CALLS_MS);
  }

  // 5. Итоговая сводка
  const cost = estimateCostUsd(totalIn, totalOut);
  console.log(
    `\n[generate-quizzes] итог: обработано блоков ${done}, создано вопросов ${totalQuestions}, ошибок ${failed}.`
  );
  console.log(
    `   токены: ${totalIn} in / ${totalOut} out — ≈ $${cost.toFixed(4)} (Sonnet 4.6, ${PRICE_INPUT_PER_1M}/${PRICE_OUTPUT_PER_1M} per 1M)`
  );
  console.log(`   суммарное время вызовов API: ${(totalMs / 1000).toFixed(1)}с`);

  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error('[FATAL]', err?.stack || err);
  process.exit(1);
});
