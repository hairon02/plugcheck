import JSZip from 'jszip'
import type { PluginInput } from '@/types'

function fileBaseName(file: File): string {
  return file.name.replace(/\.jar$/i, '')
}

async function parseYaml(content: string): Promise<Record<string, unknown>> {
  const { load, FAILSAFE_SCHEMA } = await import('js-yaml')
  const parsed = load(content, { schema: FAILSAFE_SCHEMA })
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}

const FABRIC_INFRASTRUCTURE_DEPS = new Set(['fabricloader', 'minecraft', 'java'])
const MAX_JAR_BYTES = 50 * 1024 * 1024

export async function parseJarFiles(files: File[]): Promise<PluginInput[]> {
  return Promise.all(files.map(parseJar))
}

async function parseJar(file: File): Promise<PluginInput> {
  if (file.size > MAX_JAR_BYTES) {
    return { name: fileBaseName(file), version: null, type: 'plugin', dependencies: [], source: 'jar' }
  }
  const zip = await JSZip.loadAsync(file)

  // --- Paper / Spigot ---
  const pluginYml = zip.file('plugin.yml')
  if (pluginYml) {
    const content = await pluginYml.async('string')
    const data = await parseYaml(content)
    const depend = Array.isArray(data['depend']) ? (data['depend'] as string[]) : []
    const softdepend = Array.isArray(data['softdepend']) ? (data['softdepend'] as string[]) : []
    return {
      name: typeof data['name'] === 'string' ? data['name'] : fileBaseName(file),
      version: typeof data['version'] === 'string' ? data['version'] : null,
      type: 'plugin',
      dependencies: [...depend, ...softdepend],
      source: 'jar',
    }
  }

  // --- Fabric ---
  const fabricMod = zip.file('fabric.mod.json')
  if (fabricMod) {
    const content = await fabricMod.async('string')
    const data = JSON.parse(content) as Record<string, unknown>
    const depends =
      data['depends'] && typeof data['depends'] === 'object'
        ? Object.keys(data['depends'] as Record<string, unknown>).filter(
            (k) => !FABRIC_INFRASTRUCTURE_DEPS.has(k)
          )
        : []
    return {
      name: typeof data['id'] === 'string' ? data['id'] : fileBaseName(file),
      version: typeof data['version'] === 'string' ? data['version'] : null,
      type: 'mod',
      dependencies: depends,
      source: 'jar',
    }
  }

  // --- Forge ---
  const modsToml = zip.file('META-INF/mods.toml')
  if (modsToml) {
    const content = await modsToml.async('string')
    const modIdMatch = content.match(/modId\s*=\s*"([^"]+)"/)
    const versionMatch = content.match(/\bversion\s*=\s*"([^"]+)"/)
    return {
      name: modIdMatch?.[1] ?? fileBaseName(file),
      version: versionMatch?.[1] ?? null,
      type: 'mod',
      dependencies: [],
      source: 'jar',
    }
  }

  // --- Unknown format ---
  return {
    name: fileBaseName(file),
    version: null,
    type: 'plugin',
    dependencies: [],
    source: 'jar',
  }
}
