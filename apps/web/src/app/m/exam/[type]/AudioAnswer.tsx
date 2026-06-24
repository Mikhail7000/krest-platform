'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_SECS = 180

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData ?? ''
}

interface Props {
  currentText: string
  onTranscript: (text: string) => void
}

export function AudioAnswer({ currentText, onTranscript }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [secs, setSecs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => () => { clearTimer(); cleanupStream() }, [])

  const stopRecording = () => {
    clearTimer()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const handleStop = async () => {
    cleanupStream()
    const type = recorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type })
    if (blob.size === 0) { setState('idle'); setError('Пустая запись'); return }

    setState('transcribing')
    setError(null)
    try {
      const fd = new FormData()
      fd.append('initData', getInitData())
      fd.append('file', blob, 'answer')
      const res = await fetch('/api/m/exam/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Ошибка распознавания')
      onTranscript(data.transcript as string)
      setState('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка распознавания')
      setState('idle')
    }
  }

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleStop
      recorderRef.current = mr
      mr.start()
      setState('recording')
      setSecs(0)
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          const next = s + 1
          if (next >= MAX_SECS) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      setError('Нет доступа к микрофону. Разрешите запись в настройках.')
    }
  }

  return (
    <div className="exam-audio">
      {state === 'recording' && (
        <button type="button" className="exam-audio__stop" onClick={stopRecording}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="3" />
          </svg>
          Остановить ({secs} / {MAX_SECS} с)
        </button>
      )}
      {state === 'transcribing' && <p className="exam-audio__hint">Распознаём речь…</p>}
      {state === 'idle' && (
        <button type="button" className="exam-audio__rec" onClick={startRecording}>
          🎙️ {currentText ? 'Перезаписать' : 'Записать ответ голосом'} (до 180 с)
        </button>
      )}

      {error && <p className="exam-audio__error">{error}</p>}

      {currentText && state === 'idle' && (
        <div className="exam-audio__transcript">
          <span className="exam-audio__transcript-label">Распознанный ответ:</span>
          <p>{currentText}</p>
        </div>
      )}
    </div>
  )
}
