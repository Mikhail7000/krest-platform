import { AiTrainerScreen } from './AiTrainerScreen'

export const dynamic = 'force-dynamic'

export default async function AiTrainerRoute({
  params,
}: {
  params: Promise<{ blockId: string }>
}) {
  const { blockId } = await params
  return <AiTrainerScreen blockId={Number(blockId)} />
}
