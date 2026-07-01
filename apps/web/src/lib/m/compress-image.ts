/**
 * Клиентское сжатие фото перед загрузкой: длинная сторона ≤1600px, JPEG q≈0.85.
 * Зачем: фото с телефона (3–10 МБ) упирались в лимит тела Vercel ~4.5 МБ и
 * падали с невнятной сетевой ошибкой; плюс ИИ-сверка получает файл меньше.
 *
 * Бонус — HEIC на iPhone: Safari декодирует HEIC нативно, поэтому здесь он
 * перекодируется в JPEG и серверная проверка формата (415) больше не мешает.
 * Если декодировать не удалось (HEIC на Android/десктопе, битый файл) —
 * возвращаем исходник: сервер ответит своей понятной ошибкой.
 */

const VISION_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image: применить EXIF-ориентацию к пикселям (canvas.toBlob стирает EXIF,
      // без этого портретное фото на старых движках уехало бы боком).
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* опция не поддержана / HEIC — пробуем без опции, затем через <img> */
    }
    try {
      return await createImageBitmap(file)
    } catch {
      /* HEIC и пр. — пробуем через <img> ниже */
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  // Уже маленький vision-совместимый файл — не трогаем.
  if (file.size < 400_000 && VISION_TYPES.includes(file.type)) return file
  try {
    const src = await decode(file)
    const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width
    const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height
    if (!w0 || !h0) return file
    const scale = Math.min(1, maxSide / Math.max(w0, h0))
    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(src, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob || blob.size === 0) return file
    // Перекодировка раздула уже-оптимальный JPEG — оставляем оригинал
    // (но HEIC всё равно отдаём перекодированным, иначе сервер его отклонит).
    if (blob.size >= file.size && VISION_TYPES.includes(file.type)) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
