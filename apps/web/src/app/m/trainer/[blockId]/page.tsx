import { TrainerClient } from './TrainerClient'
import './trainer.css'

export const dynamic = 'force-dynamic'

export default async function TrainerPage({
  params,
}: {
  params: Promise<{ blockId: string }>
}) {
  const { blockId } = await params
  return <TrainerClient blockId={Number(blockId)} />
}
