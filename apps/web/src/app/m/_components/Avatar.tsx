'use client'

/* Переиспользуемый компонент аватарки.
   - Если передан src — показываем <img> в кружке.
   - Иначе — цветной кружок с инициалом из name.
   Размер задаётся через className или style. */

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

/** Детерминированный цвет фона по имени */
function colorFromName(name: string): string {
  const palette = [
    '#6d5dfc', '#f59e0b', '#10b981', '#ef4444',
    '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return palette[Math.abs(hash) % palette.length]
}

export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const bg = colorFromName(name)

  const style: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.38),
    fontWeight: 700,
    color: '#fff',
    background: src ? 'transparent' : bg,
    flexShrink: 0,
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={className}
        style={{ ...style, objectFit: 'cover' }}
      />
    )
  }

  return (
    <span aria-label={name} className={className} style={style}>
      {initial}
    </span>
  )
}
