#!/usr/bin/env node
/**
 * transcripts-to-summaries.mjs
 *
 * Этап 2 AI-first потока: переписывает сырые ASR-транскрипты видео курса КРЕСТ
 * (block_resources.transcript_md) в красивые markdown-конспекты (summary_md)
 * через Claude Sonnet.
 *
 * Обрабатывает только resource_type IN ('main_video', 'additional_video') —
 * gude_pdf и прочие текстовые ресурсы не трогаем.
 *
 * Идемпотентность: по умолчанию пропускает записи где summary_md уже NOT NULL.
 *
 * Логирование каждого вызова — в ai_call_log (purpose='summarize_transcript').
 *
 * Запуск:
 *   set -a; source apps/web/.env.local; set +a
 *   node scripts/transcripts-to-summaries.mjs              # все необработанные
 *   node scripts/transcripts-to-summaries.mjs --block=1    # только блок 1
 *   node scripts/transcripts-to-summaries.mjs --force      # перегенерить все, даже с готовыми
 *   node scripts/transcripts-to-summaries.mjs --dry-run    # ничего не вызывать и не писать в БД
 *   node scripts/transcripts-to-summaries.mjs --verbose    # подробный лог
 *
 * Требует в окружении:
 *   - SUPABASE_SERVICE_ROLE_KEY  (запись в block_resources.summary_md и ai_call_log)
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

const PURPOSE = 'summarize_transcript';
const SLEEP_BETWEEN_CALLS_MS = 1000;
const MIN_TRANSCRIPT_LEN = 500; // короче — даже не отправляем в Sonnet

const TARGET_RESOURCE_TYPES = ['main_video', 'additional_video'];

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
    `Usage: node scripts/transcripts-to-summaries.mjs [--block=N] [--force] [--dry-run] [--verbose]\n\n` +
      `  --block=N    обработать только блок N (1..10)\n` +
      `  --force      перегенерировать даже если summary_md уже есть\n` +
      `  --dry-run    показать что обработал бы, не вызывать API и не писать в БД\n` +
      `  --verbose    подробный лог (показывать промпты/превью ответа)\n`
  );
}

// ============================================================
// Промпт
// ============================================================

const SYSTEM_PROMPT = `Ты редактор-конспектист духовных проповедей курса «КРЕСТ». На вход — сырая ASR-транскрипция русскоязычной проповеди (поток слов, без знаков препинания, в нижнем регистре, с повторами, оговорками и словами-паразитами).

Твоя задача — превратить её в чистый markdown-конспект для ученика.

Правила:
1. НЕ АТРИБУТИРОВАТЬ тезисы спикеру. Никаких «Алекс сказал», «автор объясняет», «проповедник учит», «лектор подчёркивает». Излагай суть от темы: «Малый Крест — это…», «Цель эпохи пятницы — …», «Молитва по кресту состоит из…».
2. СТРУКТУРА конспекта (порядок строго такой):
   - строка 1: заголовок \`# {Заголовок видео}\` (тебе дадут его в user message);
   - строка 2: пустая;
   - строка 3: ОБЯЗАТЕЛЬНАЯ контекстная плашка строго в формате \`**Блок {N} «{Название блока}» · {тип видео на русском}**\` (значения возьми из user message, не выдумывай);
   - строка 4: пустая;
   - 1 короткий абзац-аннотация (2-4 строки): что это и зачем;
   - 3-7 разделов \`##\` по содержанию, при необходимости с подзаголовками \`###\`;
   - финальный раздел \`## Ключевые писания\` — маркированный список всех упомянутых ссылок (если их нет в транскрипте — секцию опусти).
3. ЦИТАТЫ ПИСАНИЯ оформляй блок-цитатой:
   > И сказал им: идите по всему миру и проповедуйте Евангелие всей твари.
   *— Марк 16:15*
4. Без воды: убери «э-э», «ну», «вот», «короче», повторы, оговорки и заминки. Сохрани смысл, не пересказ дословно. Текст должен читаться легко и быть полезен для повторения материала.
5. ОБЪЁМ — ЖЁСТКОЕ ОГРАНИЧЕНИЕ: итоговая длина markdown в символах ДОЛЖНА быть в диапазоне 30-45% от длины исходного транскрипта. ВЕРХНИЙ ПОТОЛОК — 50%, превышать запрещено. Если получается длиннее — сокращай дополнительно: убирай повторяющиеся примеры, второстепенные иллюстрации, дублирующие формулировки. Цель — компактный конспект для повторения, а не пересказ.
6. ТОН: спокойный, обучающий, без пафоса и фраз «это очень важно!», «обязательно запомните». Просто содержание.
7. ЯЗЫК: русский. Английские слова из исходника оставь как были.
8. ВЫХОД: только markdown конспекта, начиная сразу с \`# \`. Никаких предисловий «Вот конспект:», никаких \`\`\`fenced\`\`\`, никаких послесловий.

Если исходный транскрипт невнятный, обрывочный или явно не содержит проповеди — верни одну строку:
_Конспект недоступен: исходный транскрипт неполный или невнятный._`;

function buildUserMessage({ blockId, blockTitle, resourceType, title, transcript }) {
  const typeLabel =
    resourceType === 'main_video'
      ? 'основное видео'
      : resourceType === 'additional_video'
        ? 'дополнительное видео'
        : resourceType;
  return [
    `Заголовок видео: ${title}`,
    `Блок: ${blockId} «${blockTitle}»`,
    `Тип: ${typeLabel}`,
    '',
    'Сырая ASR-транскрипция:',
    '',
    transcript,
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

async function fetchTargets() {
  // resource_type IN (main_video, additional_video)
  // transcript_md NOT NULL
  // [if not --force] summary_md IS NULL
  // [if --block=N]   block_id = N
  const params = new URLSearchParams();
  params.set('select', 'id,block_id,resource_type,title_ru,transcript_md,summary_md');
  params.set(
    'resource_type',
    `in.(${TARGET_RESOURCE_TYPES.map(encodeURIComponent).join(',')})`
  );
  params.set('transcript_md', 'not.is.null');
  if (!args.force) params.set('summary_md', 'is.null');
  if (args.block !== null) params.set('block_id', `eq.${args.block}`);
  params.set('order', 'block_id.asc,resource_type.asc,order_num.asc');

  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    die(`Ошибка чтения block_resources: ${res.status} ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchBlockTitle(blockId) {
  const url = `${SUPABASE_URL}/rest/v1/blocks?select=title_ru&id=eq.${blockId}&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return `Блок ${blockId}`;
  const rows = await res.json();
  return rows?.[0]?.title_ru || `Блок ${blockId}`;
}

async function updateSummary(resourceId, summaryMd) {
  const url = `${SUPABASE_URL}/rest/v1/block_resources?id=eq.${resourceId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ summary_md: summaryMd }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PATCH block_resources ${resourceId}: ${res.status} ${t.slice(0, 300)}`);
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
// Цена (информативно)
// ============================================================

// Sonnet 4.6 pricing (USD per 1M tokens) — обновить если поменяется.
const PRICE_INPUT_PER_1M = 3.0;
const PRICE_OUTPUT_PER_1M = 15.0;

function estimateCostUsd(inputTokens, outputTokens) {
  const cost =
    (inputTokens * PRICE_INPUT_PER_1M) / 1_000_000 +
    (outputTokens * PRICE_OUTPUT_PER_1M) / 1_000_000;
  return cost;
}

// ============================================================
// Очистка ответа
// ============================================================

function cleanSummaryOutput(text) {
  let t = String(text || '').trim();
  // Снимаем потенциальный ```markdown ... ``` или ``` ... ```
  const fenced = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  return t;
}

// ============================================================
// Main
// ============================================================

function die(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!SERVICE_KEY) die('SUPABASE_SERVICE_ROLE_KEY не задан.');
  if (!args.dryRun && !ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY не задан.');

  console.log(
    `[transcripts-to-summaries] start | dryRun=${args.dryRun} force=${args.force} block=${args.block ?? 'all'} verbose=${args.verbose}`
  );

  const targets = await fetchTargets();
  if (targets.length === 0) {
    console.log(
      args.force
        ? '[transcripts-to-summaries] нет видео с transcript_md (resource_type IN main_video/additional_video). Нечего обрабатывать.'
        : '[transcripts-to-summaries] все видео уже имеют summary_md. Используй --force для пересборки.'
    );
    return;
  }

  // Подгрузим заголовки блоков один раз (кеш)
  const blockTitleCache = new Map();
  for (const t of targets) {
    if (!blockTitleCache.has(t.block_id)) {
      blockTitleCache.set(t.block_id, await fetchBlockTitle(t.block_id));
    }
  }

  console.log(`[transcripts-to-summaries] найдено к обработке: ${targets.length}`);
  for (const t of targets) {
    const len = (t.transcript_md || '').length;
    console.log(
      `   • Блок ${t.block_id} «${blockTitleCache.get(t.block_id)}» / ${t.resource_type} / «${t.title_ru}» — transcript ${len} симв${t.summary_md ? ' (есть summary_md, пересборка)' : ''}`
    );
  }

  if (args.dryRun) {
    console.log('\n[transcripts-to-summaries] --dry-run: API не вызываем, БД не трогаем.');
    return;
  }

  let done = 0;
  let skippedShort = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalMs = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const blockTitle = blockTitleCache.get(t.block_id) || `Блок ${t.block_id}`;
    const transcript = (t.transcript_md || '').trim();

    console.log(
      `\n[${i + 1}/${targets.length}] Блок ${t.block_id} / ${t.resource_type} «${t.title_ru}»`
    );

    if (transcript.length < MIN_TRANSCRIPT_LEN) {
      const stub = `_Конспект недоступен: исходный транскрипт слишком короткий (${transcript.length} симв)._`;
      console.log(`   ⚠ транскрипт короче ${MIN_TRANSCRIPT_LEN} симв — записываю заглушку, без вызова API.`);
      try {
        await updateSummary(t.id, stub);
        skippedShort++;
      } catch (e) {
        console.error(`   ✗ ошибка PATCH:`, e?.message || e);
        failed++;
      }
      continue;
    }

    const userMessage = buildUserMessage({
      blockId: t.block_id,
      blockTitle,
      resourceType: t.resource_type,
      title: t.title_ru,
      transcript,
    });

    if (args.verbose) {
      console.log(`   --- system prompt (${SYSTEM_PROMPT.length} симв) ---`);
      console.log(`   --- user message (${userMessage.length} симв, ${transcript.length} из них транскрипт) ---`);
    }

    let result;
    try {
      result = await callAnthropic({ systemPrompt: SYSTEM_PROMPT, userMessage });
    } catch (e) {
      console.error(`   ✗ Anthropic упал:`, e?.message || e);
      failed++;
      continue;
    }

    const summary = cleanSummaryOutput(result.text);
    if (!summary || summary.length < 100) {
      console.error(`   ✗ Sonnet вернул пустой/слишком короткий ответ (${summary.length} симв) — пропускаю.`);
      failed++;
      continue;
    }

    try {
      await updateSummary(t.id, summary);
    } catch (e) {
      console.error(`   ✗ ошибка PATCH:`, e?.message || e);
      failed++;
      continue;
    }

    done++;
    totalIn += result.inputTokens;
    totalOut += result.outputTokens;
    totalMs += result.durationMs;

    const ratio = ((summary.length / transcript.length) * 100).toFixed(0);
    console.log(
      `   ✓ summary_md записан: ${summary.length} симв (${ratio}% от исходного), ${result.inputTokens} in / ${result.outputTokens} out, ${(result.durationMs / 1000).toFixed(1)}с`
    );
    if (args.verbose) {
      const preview = summary.split('\n').slice(0, 6).join('\n');
      console.log(`   --- preview ---\n${preview}\n   ---`);
    }

    // Gentle rate-limit между вызовами
    if (i < targets.length - 1) await sleep(SLEEP_BETWEEN_CALLS_MS);
  }

  const cost = estimateCostUsd(totalIn, totalOut);
  console.log(
    `\n[transcripts-to-summaries] итог: обработано ${done}, заглушки коротких ${skippedShort}, ошибок ${failed}.`
  );
  console.log(
    `   токены: ${totalIn} in / ${totalOut} out — ≈ $${cost.toFixed(4)} (Sonnet 4.6, ${PRICE_INPUT_PER_1M}/${PRICE_OUTPUT_PER_1M} per 1M)`
  );
  console.log(`   суммарное время вызовов: ${(totalMs / 1000).toFixed(1)}с`);

  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error('[FATAL]', err?.stack || err);
  process.exit(1);
});
