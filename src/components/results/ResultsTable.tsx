import type { PluginResult } from '@/types'
import { PluginRow } from './PluginRow'

interface ResultsTableProps {
  results: PluginResult[]
}

export function ResultsTable({ results }: ResultsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-muted)' }}>
          <tr>
            {['Plugin', 'Latest Version', 'Status', 'Link'].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
          {results.map((result, i) => (
            <PluginRow key={result.name} result={result} isAlternate={i % 2 !== 0} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
