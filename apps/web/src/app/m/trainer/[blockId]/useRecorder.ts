'use client'

import { useEffect, useRef, useState } from 'react'

export type RecState = 'idle' | 'recording' | 'recorded'

function pickMimeType(video: boolean): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = video
    ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    : ['audio/mp4', 'audio/webm']
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t
    } catch {
      /* noop */
    }
  }
  return ''
}

export function extFor(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4'
  if (mime.startsWith('audio/mp4')) return 'm4a'
  return 'webm'
}

// Запись аудио или видео через MediaRecorder. Логика та же, что на экране
// сдачи местописаний, вынесена в хук для тренажёра.
export function useRecorder(video: boolean, maxSecs: number) {
  const [state, setState] = useState<RecState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [mime, setMime] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [secs, setSecs] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  useEffect(() => {
    if (state !== 'recording') {
      setSecs(0)
      return
    }
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  useEffect(
    () => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    },
    [blobUrl],
  )

  const stop = () => recorderRef.current?.stop()

  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setBlob(null)
    setBlobUrl(null)
    setState('idle')
    setError(null)
  }

  const start = async () => {
    setError(null)
    setBlob(null)
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
    }
    try {
      const constraints: MediaStreamConstraints = video
        ? {
            audio: true,
            // frameRate ограничиваем — на слабых/iOS-устройствах высокий fps стопорит
            // видео-энкодер на ~10-15с (видео «виснет», аудио продолжается). 24 fps стабильно.
            video: {
              width: { ideal: 480 },
              height: { ideal: 480 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: 'user',
            },
          }
        : { audio: true }
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      const mt = pickMimeType(video)
      setMime(mt)
      // Битрейт видео занижен (360к видео + 48к аудио ≈ 3 МБ за 60с), чтобы кружок
      // гарантированно влезал в лимит тела Vercel (4.5 МБ). Раньше 500к давали ~4+ МБ
      // на полные 60с → «Не удалось отправить».
      const opts: MediaRecorderOptions = video
        ? { videoBitsPerSecond: 360_000, audioBitsPerSecond: 48_000, ...(mt ? { mimeType: mt } : {}) }
        : { audioBitsPerSecond: 64_000, ...(mt ? { mimeType: mt } : {}) }
      const recorder = new MediaRecorder(s, opts)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        s.getTracks().forEach((t) => t.stop())
        setStream(null)
        const finalMime = mt || (video ? 'video/webm' : 'audio/webm')
        const b = new Blob(chunksRef.current, { type: finalMime })
        setBlob(b)
        setBlobUrl(URL.createObjectURL(b))
        setState('recorded')
      }
      // timeslice 1000мс — рекордер сбрасывает данные каждую секунду, а не копит до
      // stop(). Это предотвращает «зависание» видео-дорожки на длинной записи (частый
      // баг iOS Safari: видео встаёт, аудио идёт) и не теряет уже снятые секунды.
      recorder.start(1000)
      recorderRef.current = recorder
      if (video) setStream(s)
      setState('recording')
      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      }, maxSecs * 1000)
    } catch {
      setError('Нет доступа к микрофону/камере.')
    }
  }

  return { state, error, blob, blobUrl, mime, stream, secs, start, stop, reset, setError }
}
