'use client'
import mcVersions from '@/data/mc-versions.json'

interface VersionSelectorProps {
  value: string
  onChange: (version: string) => void
}

export function VersionSelector({ value, onChange }: VersionSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
        Minecraft Version
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out focus:outline-none"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-card)',
          color: 'var(--color-foreground)',
        }}
      >
        {(mcVersions as string[]).map((version) => (
          <option key={version} value={version}>
            {version}
          </option>
        ))}
      </select>
    </div>
  )
}
