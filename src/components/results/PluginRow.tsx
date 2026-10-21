import type { PluginResult } from '@/types'
import { StatusBadge } from './StatusBadge'

interface PluginRowProps {
  result: PluginResult
  isAlternate: boolean
}

export function PluginRow({ result, isAlternate }: PluginRowProps) {
  return (
    <tr style={{ backgroundColor: isAlternate ? 'var(--color-muted)' : 'var(--color-card)' }}>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            {result.name}
          </span>
          {result.alternative && (
            <a
              href={result.alternative.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: 'var(--color-secondary)' }}
            >
              → Try {result.alternative.name}
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {result.latestVersion ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={result.status} hasAlternative={!!result.alternative} />
      </td>
      <td className="px-4 py-3">
        {result.url ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline transition-all duration-150 ease-out"
            style={{ color: 'var(--color-secondary)' }}
          >
            View →
          </a>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>—</span>
        )}
      </td>
    </tr>
  )
}
