import { SupportRequestScreen } from '../_components/SupportRequestScreen'

export const dynamic = 'force-dynamic'

export default function SupportPage() {
  return (
    <SupportRequestScreen
      title="Помощь и поддержка"
      subtitle="Опиши вопрос или ошибку — мы получим сообщение и ответим."
    />
  )
}
