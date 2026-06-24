'use client'

import { useEffect, useRef, useState } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

/**
 * Чат-тренажёр «Учиться вместе с ИИ»: живой диалог-квиз по местописаниям блока.
 * ИИ даёт задания (ссылка↔текст, пропуски, «из какого блока»), проверяет мягко.
 */
export function AiTrainerChat({ blockId, onBack }: { blockId: number; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  async function send(history: ChatMessage[]) {
    setLoading(true)
    try {
      const res = await fetch('/api/m/trainer/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), blockId, messages: history }),
      })
      const data = res.ok ? ((await res.json()) as { ok?: boolean; reply?: string }) : null
      const reply = data?.ok && data.reply ? data.reply : 'Не получилось ответить. Попробуй ещё раз 🙏'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Сеть недоступна. Попробуй ещё раз чуть позже.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Первый вход — приветствие ИИ и первое задание.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void send([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автоскролл вниз при новых сообщениях.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    void send(next)
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat__head">
        <button type="button" className="ai-chat__back" onClick={onBack}>
          ‹ Назад
        </button>
        <span className="ai-chat__title">✨ Учиться вместе с ИИ</span>
      </div>

      <div className="ai-chat__scroll" ref={scrollRef}>
        {messages.length === 0 && loading && (
          <p className="ai-chat__hint">Готовлю первое задание…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg--${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && messages.length > 0 && (
          <div className="ai-msg ai-msg--assistant ai-msg--typing" aria-label="ИИ печатает">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <div className="ai-chat__input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Напиши ответ…"
          disabled={loading}
          aria-label="Ответ ИИ-тренажёру"
        />
        <button type="button" onClick={handleSend} disabled={loading || !input.trim()} aria-label="Отправить">
          ↑
        </button>
      </div>
    </div>
  )
}
