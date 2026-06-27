'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconMic } from '@/app/m/_components/icons'
import { useRecorder, extFor } from './useRecorder'

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

const AUDIO_MAX = 90

/**
 * Чат-тренажёр «Учиться вместе с ИИ»: накопительный диалог-квиз по ВСЕМ открытым
 * блокам (смысл + стихи), приоритет текущему блоку. Отвечать можно текстом или
 * голосом (🎤) — запись распознаётся (Deepgram). Ответы ИИ рендерятся как Markdown.
 */
export function AiTrainerChat({ blockId, onBack }: { blockId: number; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const audioRec = useRecorder(false, AUDIO_MAX)

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

  // Первый вход — приветствие ИИ.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void send([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автоскролл вниз.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, transcribing, recording])

  async function finishRecording() {
    const blob = audioRec.blob
    if (!blob) return
    setTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('medium', 'audio')
      fd.append('file', blob, `answer.${extFor(audioRec.mime)}`)
      const res = await fetch('/api/m/trainer/transcribe', { method: 'POST', body: fd })
      const data = res.ok ? ((await res.json()) as { ok?: boolean; transcript?: string }) : null
      const transcript = data?.ok ? (data.transcript ?? '').trim() : ''
      audioRec.reset()
      setRecording(false)
      if (transcript) {
        const next: ChatMessage[] = [...messagesRef.current, { role: 'user', content: transcript }]
        setMessages(next)
        void send(next)
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Не расслышал 🙉 Попробуй ещё раз или напиши текстом.' },
        ])
      }
    } catch {
      audioRec.reset()
      setRecording(false)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Не удалось распознать запись. Попробуй ещё раз.' },
      ])
    } finally {
      setTranscribing(false)
    }
  }

  // Запись завершена → распознаём и отправляем.
  useEffect(() => {
    if (recording && audioRec.state === 'recorded' && audioRec.blob) {
      void finishRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRec.state])

  // Нет доступа к микрофону.
  useEffect(() => {
    if (recording && audioRec.error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Нет доступа к микрофону. Разреши доступ или ответь текстом.' },
      ])
      audioRec.reset()
      setRecording(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRec.error])

  const busy = loading || transcribing

  function startRec() {
    if (busy || recording) return
    setRecording(true)
    void audioRec.start()
  }

  function cancelRec() {
    if (audioRec.state === 'recording') audioRec.stop()
    audioRec.reset()
    setRecording(false)
  }

  function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    void send(next)
  }

  const isRecording = recording && audioRec.state === 'recording'

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
            {m.role === 'assistant' ? (
              <div className="ai-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
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
        {isRecording ? (
          <div className="ai-rec-bar">
            <span className="ai-rec-dot" aria-hidden />
            <span className="ai-rec-time">
              <IconMic className="ai-rec-time__icon" />
              {audioRec.secs}s
            </span>
            <button type="button" className="ai-rec-stop" onClick={() => audioRec.stop()}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="3" />
              </svg>
              Готово
            </button>
            <button type="button" className="ai-rec-cancel" onClick={cancelRec} aria-label="Отмена">
              ✕
            </button>
          </div>
        ) : transcribing ? (
          <div className="ai-rec-bar">
            <span className="ai-rec-transcribing">Распознаю запись…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="ai-chat__rec"
              onClick={startRec}
              disabled={busy}
              aria-label="Ответить голосом"
            >
              <IconMic className="ai-chat__rec-icon" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
              placeholder="Напиши ответ…"
              disabled={busy}
              enterKeyHint="send"
              aria-label="Ответ ИИ-тренажёру"
            />
            <button
              type="button"
              className="ai-chat__send"
              onClick={handleSend}
              disabled={busy || !input.trim()}
              aria-label="Отправить"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
