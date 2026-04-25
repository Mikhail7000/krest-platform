#!/usr/bin/env node
/**
 * populate-content.mjs
 *
 * Скрипт для наполнения Supabase контентом из seed-data/
 * Использует REST API, без npm-зависимостей (только Node.js 18+ built-ins)
 *
 * Использование:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/populate-content.mjs
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ============================================================
// Конфигурация
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aejhlmoydnhgedgfndql.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY не установлен')
  console.error('')
  console.error('Использование:')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/populate-content.mjs')
  console.error('')
  console.error('Ключ можно найти в Supabase Dashboard -> Settings -> API -> service_role key')
  process.exit(1)
}

// ============================================================
// Supabase REST API запросы
// ============================================================

/**
 * Выполнить запрос к Supabase REST API
 */
async function supabaseRequest(table, method, body = null, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }

  // Для POST/upsert добавляем Prefer header
  if (method === 'POST') {
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal'
  } else if (method === 'PATCH') {
    headers['Prefer'] = 'return=minimal'
  }

  const options = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(url, options)

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${method} ${table}${filter}: ${res.status} ${err}`)
  }

  // Для GET запросов возвращаем JSON
  if (method === 'GET') {
    return res.json()
  }

  return null
}

// ============================================================
// Парсинг файлов
// ============================================================

/**
 * Парсит frontmatter из markdown файла
 * Возвращает { meta: {...}, content: { ru: "...", en: "..." } }
 */
function parseBlockFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8')

  // Извлекаем frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    throw new Error(`Нет frontmatter в ${filePath}`)
  }

  const meta = {}
  for (const line of fmMatch[1].split('\n')) {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length) {
      let value = valueParts.join(':').trim()
      // Убираем кавычки
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      meta[key.trim()] = value
    }
  }

  // Извлекаем контент после frontmatter
  const contentStart = raw.indexOf('---', 3) + 3
  const content = raw.slice(contentStart).trim()

  // Разделяем на RU и EN секции
  const ruMatch = content.match(/## RU\n([\s\S]*?)(?=## EN|$)/)
  const enMatch = content.match(/## EN\n([\s\S]*)$/)

  return {
    meta: {
      order_num: parseInt(meta.order_num, 10),
      title_ru: meta.title_ru || '',
      title_en: meta.title_en || '',
    },
    content: {
      ru: ruMatch ? ruMatch[1].trim() : '',
      en: enMatch ? enMatch[1].trim() : '',
    }
  }
}

/**
 * Парсит файл стихов (markdown таблица)
 * Возвращает { block_order: N, verses: [{reference, text_ru, text_en}, ...] }
 */
function parseVersesFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8')

  // Извлекаем frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    throw new Error(`Нет frontmatter в ${filePath}`)
  }

  let blockOrder = 1
  for (const line of fmMatch[1].split('\n')) {
    if (line.startsWith('block_order:')) {
      blockOrder = parseInt(line.split(':')[1].trim(), 10)
    }
  }

  // Извлекаем таблицу
  const contentStart = raw.indexOf('---', 3) + 3
  const content = raw.slice(contentStart).trim()

  const verses = []
  const lines = content.split('\n')

  for (const line of lines) {
    // Пропускаем заголовок и разделитель таблицы
    if (line.startsWith('| reference') || line.startsWith('|---')) {
      continue
    }

    // Парсим строку таблицы
    if (line.startsWith('|') && line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c)
      if (cells.length >= 3) {
        verses.push({
          reference: cells[0],
          text_ru: cells[1],
          text_en: cells[2],
        })
      }
    }
  }

  return { block_order: blockOrder, verses }
}

// ============================================================
// Основная логика
// ============================================================

async function populateBlocks() {
  console.log('\n=== Обновление блоков ===\n')

  const blocksDir = join(ROOT, 'seed-data', 'blocks')
  const files = readdirSync(blocksDir).filter(f => f.endsWith('.md')).sort()

  for (const file of files) {
    const filePath = join(blocksDir, file)
    const { meta, content } = parseBlockFile(filePath)

    console.log(`[${meta.order_num}] ${meta.title_ru}`)

    // UPDATE blocks SET content_ru=..., content_en=..., title_ru=..., title_en=... WHERE order_num=N
    await supabaseRequest(
      'blocks',
      'PATCH',
      {
        title_ru: meta.title_ru,
        title_en: meta.title_en,
        content_ru: content.ru,
        content_en: content.en,
      },
      `?order_num=eq.${meta.order_num}`
    )

    console.log(`    -> Обновлено`)
  }
}

async function populateVerses() {
  console.log('\n=== Обновление стихов ===\n')

  const versesDir = join(ROOT, 'seed-data', 'verses')
  const files = readdirSync(versesDir).filter(f => f.endsWith('.md')).sort()

  // Сначала получим все блоки, чтобы знать их ID
  const blocks = await supabaseRequest('blocks', 'GET', null, '?select=id,order_num')
  const blockMap = {}
  for (const b of blocks) {
    blockMap[b.order_num] = b.id
  }

  for (const file of files) {
    const filePath = join(versesDir, file)
    const { block_order, verses } = parseVersesFile(filePath)

    const blockId = blockMap[block_order]
    if (!blockId) {
      console.log(`[!] Блок ${block_order} не найден, пропускаем ${file}`)
      continue
    }

    console.log(`[Блок ${block_order}] ${verses.length} стихов`)

    for (const verse of verses) {
      // Upsert в bible_verses
      await supabaseRequest(
        'bible_verses',
        'POST',
        {
          block_id: blockId,
          reference: verse.reference,
          text_ru: verse.text_ru,
          text_en: verse.text_en,
        }
      )
      console.log(`    + ${verse.reference}`)
    }
  }
}

async function main() {
  console.log('================================================')
  console.log('  КРЕСТ: Наполнение Supabase контентом')
  console.log('================================================')
  console.log(`Supabase URL: ${SUPABASE_URL}`)

  try {
    await populateBlocks()
    await populateVerses()

    console.log('\n=== Готово ===\n')
    console.log('Контент успешно загружен в Supabase.')
  } catch (err) {
    console.error('\nОШИБКА:', err.message)
    process.exit(1)
  }
}

main()
