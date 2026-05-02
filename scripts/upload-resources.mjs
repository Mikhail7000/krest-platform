#!/usr/bin/env node
/**
 * upload-resources.mjs
 *
 * Заливка ресурсов Блока 1 «Малый Крест» в Supabase:
 *   - 2 m4a-молитвы → Storage bucket block-resources/01-maly-krest/audio/
 *   - 2 PDF-молитвы → block-resources/01-maly-krest/pdf/
 *   - картинка гайда «Эпоха пятницы» → block-resources/01-maly-krest/guide/
 *   - транскрипт основного видео + расшифровка вводного → transcript_md
 *   - текст гайда (распарсен из TXT.rtf) → transcript_md
 *
 * Заполняет таблицу block_resources идемпотентно (DELETE+INSERT для block_id=1).
 *
 * Запуск:
 *   set -a; source apps/web/.env.local; set +a; node scripts/upload-resources.mjs
 *
 * Требует SUPABASE_SERVICE_ROLE_KEY в окружении.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

// ============================================================
// Конфиг
// ============================================================

const SUPABASE_URL = 'https://aejhlmoydnhgedgfndql.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MATERIALS_DIR = '/Users/rogue/Desktop/Капсула крест материалы /1 Малый Крест';

const BLOCK_ID = 1;
const BUCKET = 'block-resources';
const FOLDER = '01-maly-krest';

const KINESCOPE_MAIN = 'pSGDKsHr56JZVAeWVsWev3';        // «Малый крест»
const KINESCOPE_ADDITIONAL = 'ntfUqbL89b9mrGzrgKrLbW';  // «Вводный урок»

const MIME = {
  '.m4a': 'audio/x-m4a',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY не установлен');
  console.error('Запуск: set -a; source apps/web/.env.local; set +a; node scripts/upload-resources.mjs');
  process.exit(1);
}

// ============================================================
// REST helpers
// ============================================================

const baseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function uploadToStorage(localPath, storagePath, mimeType) {
  const buffer = await readFile(localPath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload ${storagePath} failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ uploaded ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return storagePath;
}

async function deleteBlockResources(blockId) {
  const url = `${SUPABASE_URL}/rest/v1/block_resources?block_id=eq.${blockId}`;
  const res = await fetch(url, { method: 'DELETE', headers: baseHeaders });
  if (!res.ok) {
    throw new Error(`DELETE block_resources failed (${res.status}): ${await res.text()}`);
  }
  console.log(`  ✓ cleared block_resources for block_id=${blockId}`);
}

async function insertBlockResources(rows) {
  // PostgREST требует, чтобы все объекты в batch INSERT имели одинаковый
  // набор ключей. Нормализуем — везде проставляем все опциональные поля
  // (null, если не задано).
  const FIELDS = [
    'block_id',
    'resource_type',
    'title_ru',
    'description_ru',
    'kinescope_id',
    'storage_path',
    'transcript_md',
    'order_num',
    'is_required',
  ];
  const normalized = rows.map((r) =>
    Object.fromEntries(FIELDS.map((f) => [f, r[f] ?? null])),
  );

  const url = `${SUPABASE_URL}/rest/v1/block_resources`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(normalized),
  });
  if (!res.ok) {
    throw new Error(`INSERT block_resources failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`  ✓ inserted ${data.length} rows into block_resources`);
  return data;
}

// ============================================================
// RTF parser (минимальный — для русского текста с macOS Preview/TextEdit)
// ============================================================

const CP1252_SPECIALS = {
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D,
  0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0xa0: 0x00A0,
  0xab: 0x00AB, 0xbb: 0x00BB,
};

function rtfToPlainText(rtf) {
  let s = rtf;

  // Убрать целиком группы метаданных {\fonttbl ...}, {\colortbl ...},
  // {\*\expandedcolortbl ...}, {\stylesheet ...} — они не содержат вложенных групп.
  s = s.replace(/\{\\\*?\\?(fonttbl|colortbl|expandedcolortbl|stylesheet|listtable|listoverridetable|info|generator|rsidtbl|filetbl)[^{}]*\}/g, '');

  // Гиперссылки: {\field{\*\fldinst{HYPERLINK "..."}}{\fldrslt текст}}
  // Сохраняем только видимый текст, теряя URL (для MVP достаточно).
  s = s.replace(/\{\\field\{[^{}]*\{[^{}]*HYPERLINK[^{}]*\}[^{}]*\}\{\\fldrslt([\s\S]*?)\}\s*\}/g, '$1');

  // \'XX — hex escape (cp1252)
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, h) => {
    const code = parseInt(h, 16);
    return String.fromCodePoint(CP1252_SPECIALS[code] || code);
  });

  // \uNNNN или \u-NNNN с опциональным fallback символом '?' и опциональным пробелом
  s = s.replace(/\\u(-?\d+)\s?\??/g, (_, n) => {
    let code = parseInt(n, 10);
    if (code < 0) code += 65536;
    return String.fromCodePoint(code);
  });

  // Параграфные переносы: одиночный \ в конце токена → \n
  s = s.replace(/\\par\b\s?/g, '\n\n');
  s = s.replace(/\\\s/g, '\n');

  // Управляющие слова: \word, \word123, \word-123, опц. пробел
  s = s.replace(/\\[a-z]+-?\d*\s?/gi, '');

  // Эскейпленные \\, \{, \}
  s = s.replace(/\\\\/g, '\\').replace(/\\([{}])/g, '$1');

  // Удалить оставшиеся скобки групп
  s = s.replace(/[{}]/g, '');

  // Финальная чистка
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ ?\n ?/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ============================================================
// Чтение материалов
// ============================================================

async function findFile(dir, predicate) {
  const items = await readdir(dir);
  const found = items.find(predicate);
  if (!found) throw new Error(`Не найден файл по предикату в ${dir}`);
  return join(dir, found);
}

async function readUtf8(path) {
  return readFile(path, 'utf8');
}

async function readRtfAsText(path) {
  // RTF — ASCII-совместимый формат, читаем как latin1, чтобы байты \'XX
  // парсились корректно.
  return readFile(path, 'latin1');
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🚀 Заливка ресурсов Блока 1 «Малый Крест»\n');

  // 1. Найти файлы
  console.log('📂 Поиск файлов в материалах...');
  const audioShort = await findFile(MATERIALS_DIR, (n) => /Молитва.+Короткая.*\.m4a$/.test(n));
  const audioFull = await findFile(MATERIALS_DIR, (n) => /Молитва.+Полная.*\.m4a$/.test(n));
  const pdfShort = await findFile(MATERIALS_DIR, (n) => /Молитва.+Короткая.*\.pdf$/.test(n));
  const pdfFull = await findFile(MATERIALS_DIR, (n) => /Молитва.+Полная.*\.pdf$/.test(n));
  const transcriptMain = await findFile(MATERIALS_DIR, (n) => /^Транскрибация.*малый крест.*\.txt$/i.test(n));
  const transcriptIntro = await findFile(MATERIALS_DIR, (n) => /^Вводный урок.*транскрибация.*\.txt$/i.test(n));
  const guideDir = await findFile(MATERIALS_DIR, (n) => /Эпоха пятницы.*\.rtfd$/.test(n));
  const guideRtf = join(guideDir, 'TXT.rtf');
  const guideImg = join(guideDir, 'Attachment.png');
  console.log('  ✓ все файлы найдены\n');

  // 2. Загрузка в Storage
  console.log('☁️  Загрузка в Supabase Storage...');
  const audioShortPath = await uploadToStorage(audioShort, `${FOLDER}/audio/molitva-korotkaya.m4a`, MIME['.m4a']);
  const audioFullPath = await uploadToStorage(audioFull, `${FOLDER}/audio/molitva-polnaya.m4a`, MIME['.m4a']);
  const pdfShortPath = await uploadToStorage(pdfShort, `${FOLDER}/pdf/molitva-korotkaya.pdf`, MIME['.pdf']);
  const pdfFullPath = await uploadToStorage(pdfFull, `${FOLDER}/pdf/molitva-polnaya.pdf`, MIME['.pdf']);
  const guideImgPath = await uploadToStorage(guideImg, `${FOLDER}/guide/attachment.png`, MIME['.png']);
  console.log('');

  // 3. Чтение и парсинг текстов
  console.log('📖 Чтение транскриптов и гайда...');
  const mainTranscript = (await readUtf8(transcriptMain)).trim();
  const introTranscript = (await readUtf8(transcriptIntro)).trim();
  const guideRtfRaw = await readRtfAsText(guideRtf);
  const guideMd = rtfToPlainText(guideRtfRaw);
  console.log(`  ✓ транскрипт основного видео: ${mainTranscript.length} симв.`);
  console.log(`  ✓ транскрипт вводного видео: ${introTranscript.length} симв.`);
  console.log(`  ✓ гайд «Эпоха пятницы»: ${guideMd.length} симв.\n`);

  // 4. Очистка старых записей
  console.log('🗑️  Очистка block_resources для block_id=1...');
  await deleteBlockResources(BLOCK_ID);
  console.log('');

  // 5. Сборка ресурсов
  console.log('💾 Вставка ресурсов в БД...');
  const rows = [
    {
      block_id: BLOCK_ID,
      resource_type: 'main_video',
      title_ru: 'Малый Крест',
      description_ru: 'Основное видео блока: пятиминутный обзор Малого Креста.',
      kinescope_id: KINESCOPE_MAIN,
      transcript_md: mainTranscript,
      order_num: 1,
      is_required: true,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'additional_video',
      title_ru: 'Вводный урок',
      description_ru: 'Вводное видео курса: контекст и постановка задачи.',
      kinescope_id: KINESCOPE_ADDITIONAL,
      transcript_md: introTranscript,
      order_num: 2,
      is_required: true,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'audio_prayer',
      title_ru: 'Молитва Креста — Короткая',
      storage_path: audioShortPath,
      order_num: 3,
      is_required: false,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'audio_prayer',
      title_ru: 'Молитва Креста — Полная',
      storage_path: audioFullPath,
      order_num: 4,
      is_required: false,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'pdf_prayer',
      title_ru: 'Молитва Креста — Короткая (PDF)',
      storage_path: pdfShortPath,
      order_num: 5,
      is_required: false,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'pdf_prayer',
      title_ru: 'Молитва Креста — Полная (PDF)',
      storage_path: pdfFullPath,
      order_num: 6,
      is_required: false,
    },
    {
      block_id: BLOCK_ID,
      resource_type: 'guide_pdf',
      title_ru: 'Эпоха пятницы — Гайд',
      description_ru: 'Практика «эпохи пятницы»: как и зачем выходить на места действия в нашем городе.',
      storage_path: guideImgPath,
      transcript_md: guideMd,
      order_num: 7,
      is_required: true,
    },
  ];
  await insertBlockResources(rows);
  console.log('');

  // 6. Финальный отчёт
  console.log('✅ Готово!');
  console.log(`  Блок: ${BLOCK_ID} (Малый Крест)`);
  console.log(`  Ресурсов в БД: ${rows.length}`);
  console.log(`  Файлов в Storage: 5`);
}

main().catch((err) => {
  console.error('\n❌ Ошибка:', err.message);
  process.exit(1);
});
