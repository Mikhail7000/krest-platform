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
 * Валидирует initData от Telegram WebApp по официальной схеме.
 * https://core.telegram.org/bots/webapps#validating-data-received-from-the-web-app
 */
export function validateInitData(initData: string): TgUser | null {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set')
    return null
  }

  console.log('🔍 Validating initData...')

  // Parse initData as query string: "user=%7B...%7D&auth_date=123&hash=abc"
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  const authDate = params.get('auth_date')
  const user = params.get('user')

  if (!hash || !authDate || !user) {
    console.warn('⚠️ Missing required params:', { hash: !!hash, authDate: !!authDate, user: !!user })
    return null
  }

  // Build data_check_string: all params except hash, sorted alphabetically, joined by \n
  const dataCheckArray: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataCheckArray.push(`${key}=${value}`)
    }
  })
  dataCheckArray.sort()
  const dataCheckString = dataCheckArray.join('\n')

  // Step 1: secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest()

  // Step 2: data_check_hash = HMAC_SHA256(secret_key, data_check_string)
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  console.log('🔐 HMAC validation:', {
    hash,
    expectedHash,
    match: hash === expectedHash,
  })

  if (hash !== expectedHash) {
    console.warn('❌ Invalid hash signature')
    return null
  }
  console.log('✅ Hash valid')

  // Check freshness: auth_date should not be older than 1 hour
  const authDateNum = parseInt(authDate, 10)
  const now = Math.floor(Date.now() / 1000)
  const age = now - authDateNum
  if (age > 3600) {
    console.warn(`⚠️ InitData too old (${age}s)`)
    return null
  }

  try {
    const userObj = JSON.parse(user) as TgUser
    console.log('✅ User parsed:', { id: userObj.id, username: userObj.username, first_name: userObj.first_name })
    return userObj
  } catch (err) {
    console.warn('⚠️ Failed to parse user:', err)
    return null
  }
}
