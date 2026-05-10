'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { PluginInput, Platform } from '@/types'

interface PluginNameInputProps {
  onPluginsChange: (plugins: PluginInput[]) => void
  platform: Platform
}

// Each non-empty line becomes one PluginInput
function parseTextToPlugins(text: string): PluginInput[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      version: null,
      type: 'plugin' as const,
      dependencies: [],
      source: 'manual' as const,
    }))
}

export function PluginNameInput({ onPluginsChange, platform }: PluginNameInputProps) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; source: string }>>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable reference — prevents DropZone re-renders when text changes
  const stableOnChange = useCallback(onPluginsChange, [])

  useEffect(() => {
    stableOnChange(parseTextToPlugins(text))
  }, [text, stableOnChange])

  function handleChange(value: string) {
    setText(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const lastLine = value.split('\n').pop()?.trim() ?? ''
    if (lastLine.length < 2) {
      setSuggestions([])
      return
    }

    // 400ms debounce — balances responsiveness vs. API call volume
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(lastLine)}&platform=${platform}`)
        if (!res.ok) return
        const data = await res.json() as { suggestions: Array<{ name: string; source: string }> }
        setSuggestions(data.suggestions ?? [])
      } catch {
        // Autocomplete is non-critical — silently fail
      }
    }, 400)
  }

  function applySuggestion(name: string) {
    const lines = text.split('\n')
    lines[lines.length - 1] = name
    setText(lines.join('\n') + '\n')
    setSuggestions([])
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
        Plugin names <span style={{ color: 'var(--color-muted-foreground)', fontWeight: 400 }}>(one per line)</span>
      </label>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={'EssentialsX\nWorldGuard\nVault\n...'}
        rows={5}
        className="resize-none rounded-lg px-3 py-2 font-mono text-sm transition-all duration-150 ease-out focus:outline-none"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-card)',
          color: 'var(--color-foreground)',
        }}
        onFocus={(e) => (e.target.style.outline = `2px solid var(--color-ring)`)}
        onBlur={(e) => {
          e.target.style.outline = 'none'
          setTimeout(() => setSuggestions([]), 200)
        }}
      />
      {suggestions.length > 0 && (
        <ul
          className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg shadow-sm"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
        >
          {suggestions.map((s) => (
            <li
              key={s.name}
              onMouseDown={() => applySuggestion(s.name)}
              className="cursor-pointer px-3 py-2 text-sm transition-all duration-150 ease-out"
              style={{ color: 'var(--color-foreground)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s.name}
              <span className="ml-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {s.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
