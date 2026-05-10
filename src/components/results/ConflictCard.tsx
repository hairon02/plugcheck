import type { ConflictResult } from '@/types'

interface ConflictCardProps {
  conflicts: ConflictResult[]
}

export function ConflictCard({ conflicts }: ConflictCardProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: '#92400E' }}>
        ⚡ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
      </h3>
      <ul className="space-y-2">
        {conflicts.map((conflict, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#78350F' }}>
            <span className="mt-0.5 shrink-0">
              {conflict.severity === 'error' ? '🔴' : '🟡'}
            </span>
            <div>
              <span className="font-mono font-medium">{conflict.plugins.join(' + ')}</span>
              <span style={{ color: '#92400E' }}> — {conflict.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
