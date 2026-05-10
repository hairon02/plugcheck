import type { CheckResponse } from '@/types'
import { SummaryBar } from './SummaryBar'
import { ConflictCard } from './ConflictCard'
import { ResultsTable } from './ResultsTable'
import { ExportButton } from './ExportButton'

interface ResultsPanelProps {
  data: CheckResponse
}

export function ResultsPanel({ data }: ResultsPanelProps) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-4 mt-6 space-y-4 duration-300">
      <SummaryBar summary={data.summary} />
      <ConflictCard conflicts={data.conflicts} />
      <ResultsTable results={data.results} />
      <div className="flex justify-end">
        <ExportButton data={data} />
      </div>
    </div>
  )
}
