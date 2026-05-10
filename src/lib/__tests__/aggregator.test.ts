import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PluginInput, PluginResult } from '@/types'

vi.mock('../hangar')
vi.mock('../spiget')
vi.mock('../modrinth')
vi.mock('../github')

import * as hangar from '../hangar'
import * as spiget from '../spiget'
import * as modrinth from '../modrinth'
import * as github from '../github'
import { resolvePlugin } from '../aggregator'

const INPUT: PluginInput = {
  name: 'EssentialsX',
  version: '2.20.1',
  type: 'plugin',
  dependencies: ['Vault'],
  source: 'jar',
}

const MOCK_RESULT: PluginResult = {
  name: 'EssentialsX',
  status: 'compatible',
  latestVersion: '2.20.1',
  supportedVersions: ['1.21.4'],
  lastUpdate: '2024-01-01',
  isAbandoned: false,
  source: 'hangar',
  url: 'https://hangar.papermc.io/test/EssentialsX',
  alternative: null,
  dependencies: ['Vault'],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(github.checkGitHubAbandonment).mockResolvedValue(false)
})

describe('resolvePlugin', () => {
  it('tries Hangar first for Paper platform and returns its result', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(MOCK_RESULT)
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(hangar.searchHangar).toHaveBeenCalledOnce()
    expect(spiget.searchSpiget).not.toHaveBeenCalled()
    expect(result.source).toBe('hangar')
  })

  it('falls back to Spiget when Hangar returns null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue({ ...MOCK_RESULT, source: 'spigot' })
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(spiget.searchSpiget).toHaveBeenCalledOnce()
    expect(result.source).toBe('spigot')
  })

  it('falls back to Modrinth when Hangar and Spiget both return null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue(null)
    vi.mocked(modrinth.searchModrinth).mockResolvedValue({ ...MOCK_RESULT, source: 'modrinth' })
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(result.source).toBe('modrinth')
  })

  it('tries Modrinth first for Fabric platform', async () => {
    vi.mocked(modrinth.searchModrinth).mockResolvedValue({ ...MOCK_RESULT, source: 'modrinth' })
    const result = await resolvePlugin({ ...INPUT, type: 'mod' }, '1.21.4', 'fabric')
    expect(modrinth.searchModrinth).toHaveBeenCalledOnce()
    expect(hangar.searchHangar).not.toHaveBeenCalled()
    expect(result.source).toBe('modrinth')
  })

  it('returns status unknown when all sources return null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue(null)
    vi.mocked(modrinth.searchModrinth).mockResolvedValue(null)
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(result.status).toBe('unknown')
    expect(result.name).toBe('EssentialsX')
  })

  it('skips GitHub abandonment check when result has no GitHub URL', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(MOCK_RESULT) // Hangar URL, not GitHub
    await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(github.checkGitHubAbandonment).not.toHaveBeenCalled()
  })
})
