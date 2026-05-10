import type { PluginResult, ConflictResult } from '@/types'
import knownConflictsData from '@/data/known-conflicts.json'

interface KnownConflict {
  plugins: string[]
  severity: 'error' | 'warning'
  reason: string
}

const knownConflicts = knownConflictsData as KnownConflict[]

function normalize(name: string): string {
  return name.toLowerCase().trim()
}

export function detectConflicts(results: PluginResult[]): ConflictResult[] {
  const conflicts: ConflictResult[] = []
  const presentNames = new Set(results.map((r) => normalize(r.name)))

  // Level 1: Known incompatible pairs
  for (const conflict of knownConflicts) {
    if (conflict.plugins.every((p) => presentNames.has(normalize(p)))) {
      conflicts.push({
        type: 'known',
        plugins: conflict.plugins,
        severity: conflict.severity,
        reason: conflict.reason,
      })
    }
  }

  // Level 2 & 3: Dependency checks
  for (const plugin of results) {
    for (const dep of plugin.dependencies) {
      const depResult = results.find((r) => normalize(r.name) === normalize(dep))

      if (depResult) {
        if (depResult.status === 'incompatible') {
          conflicts.push({
            type: 'dependency',
            plugins: [plugin.name, dep],
            severity: 'error',
            reason: `${plugin.name} requires ${dep}, but ${dep} is incompatible with the selected Minecraft version`,
          })
        }
      } else {
        conflicts.push({
          type: 'dependency',
          plugins: [plugin.name, dep],
          severity: 'warning',
          reason: `${plugin.name} depends on ${dep}, which is not in your checked list`,
        })
      }
    }
  }

  return conflicts
}
