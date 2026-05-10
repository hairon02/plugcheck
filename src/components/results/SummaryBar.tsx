import type { CheckResponse } from '@/types'

interface SummaryBarProps {
  summary: CheckResponse['summary']
}

const SUMMARY_ITEMS = [
  { key: 'compatible'   as const, label: 'Compatible',   icon: '✅', color: '#15803D' },
  { key: 'incompatible' as const, label: 'Incompatible', icon: '❌', color: '#B91C1C' },
  { key: 'abandoned'    as const, label: 'Abandoned',    icon: '⚠️', color: '#B45309' },
  { key: 'conflicts'    as const, label: 'Conflicts',    icon: '⚡', color: '#C2410C' },
]

export function SummaryBar({ summary }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SUMMARY_ITEMS.map(({ key, label, icon, color }) => (
        <div
          key={key}
          className="rounded-lg p-3 text-center shadow-sm"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
        >
          <div className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
            {summary[key]}
          </div>
          <div className="mt-0.5 text-xs font-medium" style={{ color }}>
            {icon} {label}
          </div>
        </div>
      ))}
    </div>
  )
}
