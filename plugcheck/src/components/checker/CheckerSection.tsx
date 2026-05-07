'use client'
import { useState, useCallback } from 'react'
import type { Platform, PluginInput, CheckResponse } from '@/types'
import { PlatformTabs } from './PlatformTabs'
import { VersionSelector } from './VersionSelector'
import { DropZone } from './DropZone'
import { PluginNameInput } from './PluginNameInput'
import { CheckButton } from './CheckButton'
import { ResultsPanel } from '@/components/results/ResultsPanel'

// CheckerSection is the single "use client" boundary for the entire tool.
// All interactive state lives here — child components receive only what they need.
export function CheckerSection() {
  const [platform, setPlatform] = useState<Platform>('paper')
  const [mcVersion, setMcVersion] = useState('1.21.4')
  const [jarPlugins, setJarPlugins] = useState<PluginInput[]>([])
  const [manualPlugins, setManualPlugins] = useState<PluginInput[]>([])
  const [results, setResults] = useState<CheckResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // useCallback prevents DropZone and PluginNameInput from re-rendering on every parent state change
  const handleJarPlugins = useCallback((plugins: PluginInput[]) => setJarPlugins(plugins), [])
  const handleManualPlugins = useCallback((plugins: PluginInput[]) => setManualPlugins(plugins), [])

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
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="space-y-4">
          <PlatformTabs value={platform} onChange={setPlatform} />
          <VersionSelector value={mcVersion} onChange={setMcVersion} />
          <DropZone onPluginsAdded={handleJarPlugins} />

          <div className="flex items-center gap-3">
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
            <span className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>or type names</span>
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
          </div>

          <PluginNameInput onPluginsChange={handleManualPlugins} platform={platform} />

          {error && (
            <p
              className="rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: '#FEF2F2', color: 'var(--color-destructive)' }}
            >
              {error}
            </p>
          )}

          {allPlugins.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>
              {allPlugins.length} plugin{allPlugins.length !== 1 ? 's' : ''} ready to check
            </p>
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
