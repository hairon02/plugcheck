'use client'
import type { Platform } from '@/types'

const TABS: Array<{ value: Platform; label: string }> = [
  { value: 'paper',  label: 'Paper / Spigot' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge',  label: 'Forge' },
]

interface PlatformTabsProps {
  value: Platform
  onChange: (platform: Platform) => void
}

export function PlatformTabs({ value, onChange }: PlatformTabsProps) {
  return (
    <div
      className="flex gap-1 rounded-lg p-1"
      style={{ backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
    >
      {TABS.map((tab) => {
        const isActive = value === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ease-out"
            style={{
              backgroundColor: isActive ? 'var(--color-card)' : 'transparent',
              color: isActive ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
              boxShadow: isActive ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
