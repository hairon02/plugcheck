import type { PluginStatus } from '@/types'

type BadgeVariant = PluginStatus | 'alternative'

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; label: string }> = {
  compatible:   { bg: '#DCFCE7', color: '#15803D', label: 'Compatible' },
  incompatible: { bg: '#FEE2E2', color: '#B91C1C', label: 'Incompatible' },
  abandoned:    { bg: '#FEF3C7', color: '#B45309', label: 'Abandoned' },
  alternative:  { bg: '#EDE9FE', color: '#5B21B6', label: 'Has Alternative' },
  unknown:      { bg: '#F1F5F9', color: '#475569', label: 'Unknown' },
}

interface StatusBadgeProps {
  status: PluginStatus
  hasAlternative?: boolean
}

export function StatusBadge({ status, hasAlternative }: StatusBadgeProps) {
  const variant: BadgeVariant = hasAlternative ? 'alternative' : status
  const { bg, color, label } = BADGE_STYLES[variant]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
