import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceSupabase } from '@/lib/supabase-service'

/**
 * POST /api/support/request
 *
 * Submit a support request from a non-authenticated (forbidden/whitelist) user.
 *
 * Body: { message: string, initData: string }
 *
 * Process:
 *  1. Validate initData HMAC (same as telegram-auth)
 *  2. Extract telegram_user_id, telegram_username from initData
 *  3. Check rate limit (max 3 requests per user per 24h)
 *  4. INSERT into support_requests via service_role
 *  5. Return success or error
 */
export async function POST(request: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: { code: 'NO_BOT_TOKEN', message: 'Bot not configured' } },
      { status: 500 }
    )
  }

  try {
    const { message, initData } = (await request.json()) as {
      message: string
      initData: string
    }

    // Validate input
    if (!message || message.length < 10 || message.length > 2000) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Message must be 10-2000 characters',
          },
        },
        { status: 400 }
      )
    }

    if (!initData) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'initData required' } },
        { status: 400 }
      )
    }

    // 1. Validate HMAC
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) {
      return NextResponse.json(
        { error: { code: 'INVALID_INIT_DATA', message: 'no hash' } },
        { status: 401 }
      )
    }
    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) {
      return NextResponse.json(
        { error: { code: 'INVALID_HMAC', message: 'Telegram signature invalid' } },
        { status: 401 }
      )
    }

    // 2. Extract user
    const userJson = params.get('user')
    if (!userJson) {
      return NextResponse.json(
        { error: { code: 'NO_USER', message: 'No user in initData' } },
        { status: 400 }
      )
    }
    const tgUser = JSON.parse(userJson) as {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }

    const tgId = tgUser.id
    const tgUsername = tgUser.username ? `@${tgUser.username}` : null

    // 3. Check rate limit (service role client)
    const supa = createServiceSupabase()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentRequests, error: rateLimitError } = await (supa as any)
      .from('support_requests')
      .select('id', { count: 'exact' })
      .eq('telegram_user_id', tgId)
      .gte('created_at', oneDayAgo)

    if (rateLimitError) {
      console.error('[support/request] rate limit check error:', rateLimitError)
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        { status: 500 }
      )
    }

    if ((recentRequests?.length ?? 0) >= 3) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT',
            message: 'Too many requests. Max 3 per 24 hours.',
          },
        },
        { status: 429 }
      )
    }

    // 4. INSERT into support_requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supa as any).from('support_requests').insert({
      telegram_user_id: tgId,
      telegram_username: tgUsername,
      message,
    })

    if (insertError) {
      console.error('[support/request] insert error:', insertError)
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to save request' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[support/request]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
