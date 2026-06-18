export interface TrainerVerse {
  id: string
  block_id: number
  reference: string
  exact_text: string
  topic_label: string | null
  order_index: number
}

export interface TrainerBlock {
  id: number
  order_num: number
  title_ru: string
}

export interface TrainerData {
  ok: true
  currentBlockId: number
  currentOrder: number
  /** ISO-строка если тренажёр уже отмечен пройденным, иначе null */
  trainer_passed_at: string | null
  blocks: TrainerBlock[]
  verses: TrainerVerse[]
}

/** Перемешать массив (Fisher–Yates), не мутируя исходный. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
