import JSZip from 'jszip'
import type { PluginInput } from '@/types'

function fileBaseName(file: File): string {
  return file.name.replace(/\.jar$/i, '')
}

async function parseYaml(content: string): Promise<Record<string, unknown>> {
  const { load } = await import('js-yaml')
  const parsed = load(content)
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}

export async function parseJarFiles(files: File[]): Promise<PluginInput[]> {
  return Promise.all(files.map(parseJar))
}

async function parseJar(file: File): Promise<PluginInput> {
  const zip = await JSZip.loadAsync(file)

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

  // Fabric and Forge handled in Task 7
  return {
    name: fileBaseName(file),
    version: null,
    type: 'plugin',
    dependencies: [],
    source: 'jar',
  }
}
