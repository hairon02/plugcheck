import { describe, it, expect } from 'vitest'
import { parseJarFiles } from '../jar-parser'

async function createMockJar(
  files: Record<string, string>,
  jarName = 'test-plugin.jar'
): Promise<File> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content)
  }
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([bytes], jarName, { type: 'application/java-archive' })
}

describe('parseJarFiles — plugin.yml (Paper/Spigot)', () => {
  it('extracts name, version, and hard dependencies', async () => {
    const jar = await createMockJar({
      'plugin.yml': `name: EssentialsX\nversion: 2.20.1\ndepend:\n  - Vault\nsoftdepend:\n  - Essentials`,
    }, 'EssentialsX.jar')

    const result = await parseJarFiles([jar])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'EssentialsX',
      version: '2.20.1',
      type: 'plugin',
      dependencies: ['Vault', 'Essentials'],
      source: 'jar',
    })
  })

  it('uses filename as fallback when plugin.yml has no name field', async () => {
    const jar = await createMockJar({
      'plugin.yml': `version: 1.0.0`,
    }, 'MyPlugin.jar')

    const result = await parseJarFiles([jar])
    expect(result[0].name).toBe('MyPlugin')
  })

  it('handles missing depend/softdepend fields gracefully', async () => {
    const jar = await createMockJar({
      'plugin.yml': `name: SimplePlugin\nversion: 1.0.0`,
    })

    const result = await parseJarFiles([jar])
    expect(result[0].dependencies).toEqual([])
  })
})

describe('parseJarFiles — fabric.mod.json (Fabric)', () => {
  it('extracts id, version, and mod dependencies', async () => {
    const jar = await createMockJar({
      'fabric.mod.json': JSON.stringify({
        id: 'fabric-api',
        version: '0.92.0',
        depends: {
          'fabricloader': '>=0.14.0',
          'minecraft': '~1.21',
          'sodium': '*',
        },
      }),
    }, 'fabric-api.jar')

    const result = await parseJarFiles([jar])
    expect(result[0]).toMatchObject({
      name: 'fabric-api',
      version: '0.92.0',
      type: 'mod',
      source: 'jar',
    })
    expect(result[0].dependencies).toContain('sodium')
    expect(result[0].dependencies).not.toContain('fabricloader')
    expect(result[0].dependencies).not.toContain('minecraft')
  })
})

describe('parseJarFiles — META-INF/mods.toml (Forge)', () => {
  it('extracts modId and version via regex', async () => {
    const toml = `
[[mods]]
modId = "jei"
version = "19.20.0.243"
displayName = "Just Enough Items"
`
    const jar = await createMockJar({ 'META-INF/mods.toml': toml }, 'jei.jar')
    const result = await parseJarFiles([jar])
    expect(result[0]).toMatchObject({
      name: 'jei',
      version: '19.20.0.243',
      type: 'mod',
      source: 'jar',
    })
  })
})

describe('parseJarFiles — unknown format', () => {
  it('uses filename as name and returns null version for unrecognized JARs', async () => {
    const jar = await createMockJar({ 'readme.txt': 'nothing useful' }, 'unknown-plugin.jar')
    const result = await parseJarFiles([jar])
    expect(result[0].name).toBe('unknown-plugin')
    expect(result[0].version).toBeNull()
  })
})
