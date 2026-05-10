import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../conflict-detector'
import type { PluginResult } from '@/types'

function makeResult(
  name: string,
  status: PluginResult['status'] = 'compatible',
  dependencies: string[] = []
): PluginResult {
  return {
    name,
    status,
    latestVersion: '1.0.0',
    supportedVersions: ['1.21.4'],
    lastUpdate: '2024-01-01',
    isAbandoned: false,
    source: 'modrinth',
    url: null,
    alternative: null,
    dependencies,
  }
}

describe('detectConflicts — Level 1: Known pairs', () => {
  it('detects EssentialsX + CMI as an error conflict', () => {
    const results = [makeResult('EssentialsX'), makeResult('CMI')]
    const conflicts = detectConflicts(results)
    const known = conflicts.find((c) => c.type === 'known')
    expect(known).toBeDefined()
    expect(known?.severity).toBe('error')
    expect(known?.plugins).toContain('EssentialsX')
    expect(known?.plugins).toContain('CMI')
  })

  it('is case-insensitive for plugin name matching', () => {
    const results = [makeResult('essentialsx'), makeResult('cmi')]
    const conflicts = detectConflicts(results)
    expect(conflicts.some((c) => c.type === 'known')).toBe(true)
  })

  it('does not flag plugins that are not in any conflict pair', () => {
    const results = [makeResult('SomeRandomPlugin'), makeResult('AnotherPlugin')]
    const known = detectConflicts(results).filter((c) => c.type === 'known')
    expect(known).toHaveLength(0)
  })
})

describe('detectConflicts — Level 2: Dependency on incompatible plugin', () => {
  it('flags an error when plugin requires an incompatible dependency', () => {
    const results = [
      makeResult('EssentialsX', 'compatible', ['Vault']),
      makeResult('Vault', 'incompatible'),
    ]
    const conflicts = detectConflicts(results)
    const depError = conflicts.find((c) => c.type === 'dependency' && c.severity === 'error')
    expect(depError).toBeDefined()
    expect(depError?.plugins).toContain('EssentialsX')
    expect(depError?.plugins).toContain('Vault')
  })
})

describe('detectConflicts — Level 3: Missing dependencies', () => {
  it('warns when a hard dependency is not in the checked list', () => {
    const results = [makeResult('EssentialsX', 'compatible', ['Vault'])]
    const conflicts = detectConflicts(results)
    const warning = conflicts.find((c) => c.type === 'dependency' && c.severity === 'warning')
    expect(warning).toBeDefined()
    expect(warning?.plugins).toContain('Vault')
  })

  it('does not warn about deps that ARE in the checked list', () => {
    const results = [
      makeResult('EssentialsX', 'compatible', ['Vault']),
      makeResult('Vault', 'compatible'),
    ]
    const warnings = detectConflicts(results).filter(
      (c) => c.type === 'dependency' && c.severity === 'warning'
    )
    expect(warnings).toHaveLength(0)
  })
})
