'use client'

import { useState } from 'react'

/**
 * Превью эталона «креста блока»: миниатюра в шапке задания.
 * Тап → крупный просмотр (оверлей). Кнопка «Скачать» — по подписанному URL.
 */
export function CrossReferencePreview({
  url,
  downloadUrl,
  title,
}: {
  url: string
  downloadUrl: string
  title: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="cp-ref">
      <p className="cp-ref__label">Пример — эталон «{title}»</p>
      <button type="button" className="cp-ref__thumb" onClick={() => setOpen(true)} aria-label="Открыть эталон крупно">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Эталон «${title}»`} loading="lazy" />
        <span className="cp-ref__hint">Нажми, чтобы увеличить</span>
      </button>
      <a className="cp-ref__download" href={downloadUrl} target="_blank" rel="noopener noreferrer">
        ↓ Скачать эталон
      </a>

      {open && (
        <div className="cp-ref__overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <button type="button" className="cp-ref__close" onClick={() => setOpen(false)} aria-label="Закрыть">
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Эталон «${title}»`}
            className="cp-ref__full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
