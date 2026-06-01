import { createHmac } from 'crypto'

export type TgUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  is_bot?: boolean
  is_premium?: boolean
  language_code?: string
}

/**
 * Валидирует initData от Telegram WebApp.
 * Returns parsed user if valid, null otherwise.
 */
export function validateInitData(initData: string): TgUser | null {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN не установлен')
    return null
  }

  // initData — query string вида: "user=%7B...%7D&auth_date=123&hash=abc"
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  const authDate = params.get('auth_date')
  const user = params.get('user')

  if (!hash || !authDate || !user) {
    console.warn('Missing required params in initData')
    return null
  }

  // Собираем data_check_string (всё кроме hash, в алфавитном порядке)
  const dataCheckArray: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataCheckArray.push(`${key}=${value}`)
    }
  })
  dataCheckArray.sort()
  const dataCheckString = dataCheckArray.join('\n')

  // HMAC-SHA256(BOT_TOKEN, dataCheckString) должен совпадать с hash
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (expectedHash !== hash) {
    console.warn('Invalid hash:', { expected: expectedHash, got: hash })
    return null
  }

  // Проверяем freshness — auth_date не старше 1 часа
  const authDateNum = parseInt(authDate, 10)
  const now = Math.floor(Date.now() / 1000)
  if (now - authDateNum > 3600) {
    console.warn('initData too old')
    return null
  }

  try {
    const userObj = JSON.parse(user) as TgUser
    return userObj
  } catch {
    console.warn('Failed to parse user from initData')
    return null
  }
}
