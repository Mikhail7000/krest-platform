/**
 * Общие карточки медиа-ресурсов блока.
 * Используются на странице урока (/m/lesson) и в разделе молитвы (/m/prayer).
 * Server-safe: нет 'use client', нет хуков.
 */

interface AudioCardProps {
  titleRu: string
  url: string | undefined
}

interface PdfCardProps {
  titleRu: string
  url: string | undefined
}

export function AudioCard({ titleRu, url }: AudioCardProps) {
  return (
    <section className="rc-card">
      <p className="rc-card__title">{titleRu}</p>
      {url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls preload="none" src={url} className="rc-audio" />
      ) : (
        <p className="rc-card__unavailable">Файл недоступен</p>
      )}
    </section>
  )
}

export function PdfCard({ titleRu, url }: PdfCardProps) {
  return (
    <section className="rc-card rc-card--row">
      <span className="rc-card__title rc-card__title--inline">{titleRu}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="rc-btn"
        >
          Скачать PDF
        </a>
      ) : (
        <span className="rc-card__unavailable">недоступно</span>
      )}
    </section>
  )
}
