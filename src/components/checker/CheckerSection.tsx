'use client'
import { useState, useCallback } from 'react'
import type { Platform, PluginInput, CheckResponse } from '@/types'
import { PlatformTabs } from './PlatformTabs'
import { VersionSelector } from './VersionSelector'
import { DropZone } from './DropZone'
import { PluginNameInput } from './PluginNameInput'
import { CheckButton } from './CheckButton'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import versions from '@/data/mc-versions.json'

// CheckerSection is the single "use client" boundary for the entire tool.
// All interactive state lives here — child components receive only what they need.
export function CheckerSection() {
  const [platform, setPlatform] = useState<Platform>('paper')
  const [mcVersion, setMcVersion] = useState(versions[0])
  const [jarPlugins, setJarPlugins] = useState<PluginInput[]>([])
  const [manualPlugins, setManualPlugins] = useState<PluginInput[]>([])
  const [results, setResults] = useState<CheckResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  // useCallback prevents DropZone and PluginNameInput from re-rendering on every parent state change
  const handleJarPlugins = useCallback((plugins: PluginInput[]) => setJarPlugins(plugins), [])
  const handleManualPlugins = useCallback((plugins: PluginInput[]) => setManualPlugins(plugins), [])

  function handleClear() {
    setJarPlugins([])
    setManualPlugins([])
    setResults(null)
    setError(null)
    setResetKey((k) => k + 1)
  }

  // Merge both sources — JAR-parsed plugins take precedence (they have version info)
  const allPlugins = [
    ...jarPlugins,
    ...manualPlugins.filter(
      (m) => !jarPlugins.some((j) => j.name.toLowerCase() === m.name.toLowerCase())
    ),
  ]

  async function handleCheck() {
    if (allPlugins.length === 0) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugins: allPlugins, mcVersion, platform }),
      })

      if (!res.ok) {
        const body = await res.json() as { message?: string }
        setError(body.message ?? 'Something went wrong. Please try again.')
        return
      }

      setResults(await res.json() as CheckResponse)
    } catch {
      setError('Could not connect to the server. Check your internet connection.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div className="space-y-4">
          <PlatformTabs value={platform} onChange={setPlatform} />
          <VersionSelector value={mcVersion} onChange={setMcVersion} />
          <DropZone key={`dz-${resetKey}`} onPluginsAdded={handleJarPlugins} />

          <div className="flex items-center gap-3">
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>or type names</span>
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
          </div>

          <PluginNameInput key={`pni-${resetKey}`} onPluginsChange={handleManualPlugins} platform={platform} />

          {error && (
            <p
              className="rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: '#FEF2F2', color: 'var(--color-destructive)' }}
            >
              {error}
            </p>
          )}

          {(allPlugins.length > 0 || results !== null) && (
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {allPlugins.length > 0
                  ? `${allPlugins.length} plugin${allPlugins.length !== 1 ? 's' : ''} ready to check`
                  : ''}
              </p>
              <button
                onClick={handleClear}
                className="text-xs transition-colors duration-150"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-foreground)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-foreground)')}
              >
                Clear all
              </button>
            </div>
          )}

          <CheckButton
            onClick={handleCheck}
            isLoading={isLoading}
            disabled={allPlugins.length === 0}
          />
        </div>
      </div>

      {results && <ResultsPanel data={results} />}
    </div>
  )
}
