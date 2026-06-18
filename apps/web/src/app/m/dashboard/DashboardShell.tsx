'use client'

import { useState } from 'react'
import { DashboardClient } from './DashboardClient'
import { BlockList } from './BlockList'

/**
 * Оболочка дашборда: управляет состоянием прогресса курса,
 * прокидывает его от BlockList (который загружает данные)
 * в DashboardClient (который показывает шапку).
 */
export function DashboardShell() {
  const [coursePct, setCoursePct] = useState(0)
  const [currentBlockId, setCurrentBlockId] = useState<number | null>(null)

  return (
    <>
      <DashboardClient coursePct={coursePct} currentBlockId={currentBlockId} />
      <BlockList
        onProgress={(pct, blockId) => {
          setCoursePct(pct)
          setCurrentBlockId(blockId)
        }}
      />
    </>
  )
}
