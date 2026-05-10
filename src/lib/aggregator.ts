import type { PluginInput, PluginResult, Platform } from '@/types'
import { searchModrinth } from './modrinth'
import { searchHangar } from './hangar'
import { searchSpiget } from './spiget'
import { checkGitHubAbandonment } from './github'

type ApiSource = 'hangar' | 'spiget' | 'modrinth'

// Paper: Hangar (official PaperMC repo) → Spiget (largest catalog) → Modrinth
// Fabric/Forge: Modrinth (best mod coverage) only
const PLATFORM_PRIORITY: Record<Platform, ApiSource[]> = {
  paper:  ['hangar', 'spiget', 'modrinth'],
  spigot: ['spiget', 'hangar', 'modrinth'],
  purpur: ['hangar', 'spiget', 'modrinth'],
  fabric: ['modrinth'],
  forge:  ['modrinth'],
}

const API_HANDLERS: Record<
  ApiSource,
  (name: string, mcVersion: string, platform: Platform) => Promise<PluginResult | null>
> = {
  hangar:   searchHangar,
  spiget:   searchSpiget,
  modrinth: searchModrinth,
}

export async function resolvePlugin(
  plugin: PluginInput,
  mcVersion: string,
  platform: Platform
): Promise<PluginResult> {
  const priority = PLATFORM_PRIORITY[platform]

  for (const source of priority) {
    try {
      const result = await API_HANDLERS[source](plugin.name, mcVersion, platform)
      if (!result) continue

      if (result.url?.includes('github.com') && !result.isAbandoned) {
        const isAbandoned = await checkGitHubAbandonment(result.url).catch(() => false)
        return { ...result, isAbandoned, status: isAbandoned ? 'abandoned' : result.status }
      }
      return result
    } catch {
      // Continue to next source — one failing API shouldn't block the others
    }
  }

  return {
    name: plugin.name,
    status: 'unknown',
    latestVersion: null,
    supportedVersions: [],
    lastUpdate: null,
    isAbandoned: false,
    source: 'modrinth',
    url: null,
    alternative: null,
    dependencies: plugin.dependencies,
  }
}
