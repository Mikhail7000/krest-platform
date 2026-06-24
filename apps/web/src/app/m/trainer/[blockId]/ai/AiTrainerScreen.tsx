'use client'

import { useRouter } from 'next/navigation'
import { AiTrainerChat } from '../AiTrainerChat'
import '../trainer.css'

/** Отдельный экран ИИ-тренажёра (вход с главного экрана). «‹ Назад» → дашборд. */
export function AiTrainerScreen({ blockId }: { blockId: number }) {
  const router = useRouter()
  return (
    <div className="miniapp-container">
      <AiTrainerChat blockId={blockId} onBack={() => router.push('/m/dashboard')} />
    </div>
  )
}
