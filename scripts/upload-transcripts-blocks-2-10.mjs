#!/usr/bin/env node
/**
 * upload-transcripts-blocks-2-10.mjs
 *
 * Заливает видео-ресурсы (kinescope_id + transcript_md) для Блоков 2-10
 * курса КРЕСТ в таблицу block_resources.
 *
 * Источник:
 *   - TXT-транскрипты лежат в "/Users/rogue/Desktop/Капсула крест материалы /N {название}/{транскрипт}.txt"
 *   - Kinescope ID — захардкожены здесь, расшифрованы из "Кинескоп ссылки на видео.rtf"
 *
 * Делает 10 INSERT'ов:
 *   - 9 main_video (по одному на блок 2..10)
 *   - 1 additional_video для Блока 2 («Божье благословение»)
 *
 * Идемпотентность:
 *   - Перед INSERT проверяет, что для пары (block_id, resource_type, kinescope_id) ещё ничего нет
 *   - С флагом --force обновляет существующую запись по (block_id, kinescope_id)
 *
 * Запуск:
 *   set -a; source apps/web/.env.local; set +a
 *   node scripts/upload-transcripts-blocks-2-10.mjs              # обычный прогон
 *   node scripts/upload-transcripts-blocks-2-10.mjs --dry-run    # ничего не пишет в БД
 *   node scripts/upload-transcripts-blocks-2-10.mjs --force      # перезаписать существующие
 *
 * Требует SUPABASE_SERVICE_ROLE_KEY в окружении.
 *
 * После заливки:
 *   node scripts/transcripts-to-summaries.mjs   # прогонит Sonnet по всем 11 новым транскриптам
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================
// Конфиг
// ============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aejhlmoydnhgedgfndql.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MATERIALS_ROOT = '/Users/rogue/Desktop/Капсула крест материалы ';

// Карта: блок → папка → файл транскрипта → kinescope_id → название видео.
// Названия видео взяты из RTF «Кинескоп ссылки на видео.rtf».
// Названия папок и .txt — фактические имена в файловой системе (с пробелами/точками как есть).
const BLOCKS = [
  {
    id: 2,
    folder: '2 Принцип Сотворения',
    main: {
      kid: 'tJzZ6vsEsFdCMS4oonkZkD',
      txt: 'Принцип сотворения.txt',
      title: 'Принцип Сотворения',
      description: 'Основное видео Блока 2: принцип сотворения человека и сущность Бога.',
    },
    additional: {
      kid: '3NUFJc6L1Q5cQcWA2B2HoZ',
      txt: 'Божьи благословение.txt',
      title: 'Божье благословение',
      description: 'Дополнительное видео Блока 2: Божье благословение в жизни верующего.',
    },
  },
  {
    id: 3,
    folder: '3 Коренная Проблема',
    main: {
      kid: 'wdJq1c4WCiexnLQe1xsnph',
      txt: 'Коренная проблема.txt',
      title: 'Коренная Проблема',
      description: 'Основное видео Блока 3: грехопадение и власть сатаны над человеком.',
    },
  },
  {
    id: 4,
    folder: '4 Состояние Мира',
    main: {
      kid: 'sZMf83zHvoxHnSt5B5ukTS',
      txt: 'Состояние мира.txt',
      title: 'Состояние Мира',
      description: 'Основное видео Блока 4: что Библия говорит о состоянии мира без Христа.',
    },
  },
  {
    id: 5,
    folder: '5 Состояние неверующего',
    main: {
      kid: 'ntk6dsQYPAeaxrmwDLNQr4',
      txt: 'Состояние неверующего. .txt', // имя файла именно с точкой-пробелом
      title: 'Состояние Неверующего',
      description: 'Основное видео Блока 5: положение неверующего человека.',
    },
  },
  {
    id: 6,
    folder: '6 Усилие человека',
    main: {
      kid: 'vJ4o2gm4gNdK5iQg6eGgiB',
      txt: 'Усилия человека.txt',
      title: 'Усилие Человека',
      description: 'Основное видео Блока 6: ограниченность собственных усилий человека для спасения.',
    },
  },
  {
    id: 7,
    folder: '7 Обетования и исполнения ', // пробел в конце имени папки — это так в файловой системе
    main: {
      kid: '71523EDPaiRHagahZgXzsf',
      txt: 'Обетование и исполнение.txt',
      title: 'Обетование и исполнение',
      description: 'Основное видео Блока 7: ветхозаветные обетования и их исполнение во Христе.',
    },
  },
  {
    id: 8,
    folder: '8 Иисус Христос',
    main: {
      kid: 'udb6rtAoEXLuBiWUtbF4pJ',
      txt: 'Иисус Христос.txt',
      title: 'Иисус Христос',
      description: 'Основное видео Блока 8: личность и тройное служение Иисуса Христа.',
    },
  },
  {
    id: 9,
    folder: '9 Благословения Верующего',
    main: {
      kid: 'e82sBoBn5LHFgjGnHn4RTu',
      txt: 'Благословение верующего.txt',
      title: 'Благословение верующего',
      description: 'Основное видео Блока 9: благословения, которыми Бог наделяет верующего.',
    },
  },
  {
    id: 10,
    folder: '10 5 Уверенностей',
    main: {
      kid: '33xbQzhgwU5riZ3XjVinUe',
      txt: 'Пять уверенностей.txt',
      title: 'Пять Уверенностей',
      description: 'Основное видео Блока 10: пять уверенностей зрелого верующего.',
    },
  },
];

// ============================================================
// CLI
// ============================================================

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { dryRun: false, force: false };
  for (const a of argv) {
    if (a === '--dry-run' || a === '--dryrun') out.dryRun = true;
    else if (a === '--force') out.force = true;
    else if (a === '-h' || a === '--help') {
      console.log(
        `Usage: node scripts/upload-transcripts-blocks-2-10.mjs [--dry-run] [--force]\n\n` +
          `  --dry-run   показать что бы сделал, без чтения файлов и записи в БД\n` +
          `  --force     перезаписать существующие записи (по block_id+kinescope_id)\n`
      );
      process.exit(0);
    } else die(`Неизвестный аргумент: ${a}`);
  }
  return out;
}

// ============================================================
// Supabase REST
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

async function findExisting(blockId, kinescopeId) {
  const params = new URLSearchParams();
  params.set('select', 'id,resource_type,title_ru');
  params.set('block_id', `eq.${blockId}`);
  params.set('kinescope_id', `eq.${kinescopeId}`);
  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`SELECT block_resources failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

async function findMaxOrderNum(blockId) {
  const params = new URLSearchParams();
  params.set('select', 'order_num');
  params.set('block_id', `eq.${blockId}`);
  params.set('order', 'order_num.desc');
  params.set('limit', '1');
  const url = `${SUPABASE_URL}/rest/v1/block_resources?${params.toString()}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows?.[0]?.order_num ?? 0;
}

async function insertResource(row) {
  const url = `${SUPABASE_URL}/rest/v1/block_resources`;
  const res = await fetch(url, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`INSERT block_resources failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data[0];
}

async function updateResource(id, patch) {
  const url = `${SUPABASE_URL}/rest/v1/block_resources?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PATCH block_resources ${id} failed: ${res.status} ${t.slice(0, 300)}`);
  }
}

// ============================================================
// Main
// ============================================================

function die(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

async function processVideo({ blockId, blockFolder, resourceType, info, orderNum }) {
  const filePath = join(MATERIALS_ROOT, blockFolder, info.txt);

  let transcript;
  try {
    transcript = (await readFile(filePath, 'utf8')).trim();
  } catch (e) {
    throw new Error(`не смог прочитать ${filePath}: ${e?.message || e}`);
  }

  if (transcript.length < 200) {
    console.warn(`   ⚠ транскрипт слишком короткий (${transcript.length} симв) — всё равно заливаю.`);
  }

  const existing = await findExisting(blockId, info.kid);

  const row = {
    block_id: blockId,
    resource_type: resourceType,
    title_ru: info.title,
    description_ru: info.description ?? null,
    kinescope_id: info.kid,
    transcript_md: transcript,
    order_num: orderNum,
    is_required: true,
  };

  if (args.dryRun) {
    console.log(
      `   [dry-run] ${existing ? 'UPDATE' : 'INSERT'} block ${blockId} / ${resourceType} «${info.title}» / kinescope=${info.kid} / transcript ${transcript.length} симв${existing ? ` (заменил бы id=${existing.id})` : ''}`
    );
    return { action: 'dry-run', length: transcript.length };
  }

  if (existing) {
    if (!args.force) {
      console.log(
        `   ↷ уже есть (id=${existing.id}, type=${existing.resource_type}, «${existing.title_ru}») — пропускаю. Используй --force для перезаписи.`
      );
      return { action: 'skip', length: transcript.length };
    }
    await updateResource(existing.id, row);
    console.log(
      `   ✎ UPDATE id=${existing.id}: «${info.title}», ${transcript.length} симв транскрипта`
    );
    return { action: 'update', length: transcript.length };
  }

  const inserted = await insertResource(row);
  console.log(
    `   ✓ INSERT id=${inserted.id}: «${info.title}» / ${resourceType} / order=${orderNum} / ${transcript.length} симв`
  );
  return { action: 'insert', length: transcript.length };
}

async function main() {
  if (!args.dryRun && !SERVICE_KEY) die('SUPABASE_SERVICE_ROLE_KEY не задан.');

  console.log(
    `[upload-transcripts-blocks-2-10] start | dryRun=${args.dryRun} force=${args.force}`
  );
  console.log(`[upload-transcripts-blocks-2-10] materials root: ${MATERIALS_ROOT}\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let totalChars = 0;
  const errors = [];

  for (const block of BLOCKS) {
    console.log(`▶ Блок ${block.id} «${block.folder}»`);

    // Узнаём текущий max(order_num) — чтобы не наступить на чужие записи (Блок 1 у нас не трогается, но логика общая).
    const baseOrder = args.dryRun ? 0 : await findMaxOrderNum(block.id);

    // main_video
    try {
      const r = await processVideo({
        blockId: block.id,
        blockFolder: block.folder,
        resourceType: 'main_video',
        info: block.main,
        orderNum: Math.max(1, baseOrder + 1),
      });
      if (r.action === 'insert') inserted++;
      else if (r.action === 'update') updated++;
      else if (r.action === 'skip') skipped++;
      totalChars += r.length;
    } catch (e) {
      console.error(`   ✗ main_video: ${e?.message || e}`);
      errors.push({ block: block.id, type: 'main_video', err: e?.message || String(e) });
    }

    // additional_video — только для Блока 2
    if (block.additional) {
      try {
        const r = await processVideo({
          blockId: block.id,
          blockFolder: block.folder,
          resourceType: 'additional_video',
          info: block.additional,
          orderNum: Math.max(2, baseOrder + 2),
        });
        if (r.action === 'insert') inserted++;
        else if (r.action === 'update') updated++;
        else if (r.action === 'skip') skipped++;
        totalChars += r.length;
      } catch (e) {
        console.error(`   ✗ additional_video: ${e?.message || e}`);
        errors.push({ block: block.id, type: 'additional_video', err: e?.message || String(e) });
      }
    }

    console.log('');
  }

  console.log(
    `[upload-transcripts-blocks-2-10] итог: INSERT ${inserted}, UPDATE ${updated}, SKIP ${skipped}, ошибок ${errors.length}`
  );
  console.log(`   суммарно прочитано транскриптов: ${totalChars} симв`);

  if (errors.length > 0) {
    console.error('\nОшибки:');
    for (const e of errors) console.error(`   • Блок ${e.block} / ${e.type}: ${e.err}`);
    process.exit(2);
  }

  if (!args.dryRun && (inserted > 0 || updated > 0)) {
    console.log(
      `\n→ Следующий шаг: node scripts/transcripts-to-summaries.mjs   (прогонит Sonnet по всем новым transcript_md)`
    );
  }
}

main().catch((err) => {
  console.error('[FATAL]', err?.stack || err);
  process.exit(1);
});
