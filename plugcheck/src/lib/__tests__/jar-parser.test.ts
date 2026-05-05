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
  const bytes = await zip.generateAsync({ type: 'uint8array' })
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
