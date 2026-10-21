import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { searchSpiget } from '../spiget'
import { getCached, setCached } from '@/lib/cache'

const NOW_SECONDS = Math.floor(Date.now() / 1000)
const ABANDONMENT_SECONDS = 18 * 30 * 24 * 60 * 60

const mockResource = {
  id: 12345,
  name: 'EssentialsX',
  updateDate: NOW_SECONDS - 60 * 60 * 24 * 30, // 30 days ago — active
}

const mockAbandonedResource = {
  id: 99999,
  name: 'OldPlugin',
  updateDate: NOW_SECONDS - ABANDONMENT_SECONDS - 1, // over 18 months ago
}

const mockVersion = { name: '2.20.0' }

describe('searchSpiget', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockResource],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersion,
      })
    )
  })

  it('returns null for fabric platform', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'fabric')
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null for forge platform', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'forge')
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns compatible result for active plugin on paper', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
    expect(result!.source).toBe('spigot')
    expect(result!.name).toBe('EssentialsX')
    expect(result!.latestVersion).toBe('2.20.0')
    expect(result!.isAbandoned).toBe(false)
  })

  it('returns url pointing to spigotmc.org', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result!.url).toBe('https://www.spigotmc.org/resources/12345/')
  })

  it('always returns empty supportedVersions (Spiget limitation)', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result!.supportedVersions).toEqual([])
  })

  it('finds exact name match case-insensitively', async () => {
    const otherResource = { id: 11111, name: 'EssentialsXtra', updateDate: NOW_SECONDS }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [otherResource, mockResource],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersion,
      })
    )
    const result = await searchSpiget('essentialsx', '1.21.4', 'paper')
    expect(result!.name).toBe('EssentialsX')
    expect(result!.url).toBe('https://www.spigotmc.org/resources/12345/')
  })

  it('falls back to first result if no exact match', async () => {
    const firstResource = { id: 11111, name: 'EssentialsXtra', updateDate: NOW_SECONDS }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [firstResource],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersion,
      })
    )
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result!.name).toBe('EssentialsXtra')
  })

  it('returns abandoned status when plugin not updated in 18+ months', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockAbandonedResource],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: '1.0.0' }),
      })
    )
    const result = await searchSpiget('OldPlugin', '1.21.4', 'paper')
    expect(result!.status).toBe('abandoned')
    expect(result!.isAbandoned).toBe(true)
  })

  it('sets latestVersion to null when version endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockResource],
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    )
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result).not.toBeNull()
    expect(result!.latestVersion).toBeNull()
  })

  it('caches the result after fetching', async () => {
    await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('essentialsx'),
      expect.objectContaining({ source: 'spigot' }),
      expect.any(Number)
    )
  })

  it('returns cached result without hitting the API', async () => {
    const cached = { name: 'EssentialsX', status: 'compatible', source: 'spigot' } as any
    vi.mocked(getCached).mockResolvedValue(cached)
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result).toBe(cached)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null on search fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await searchSpiget('EssentialsX', '1.21.4', 'paper')
    expect(result).toBeNull()
  })

  it('returns null when search returns empty array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    }))
    const result = await searchSpiget('UnknownPlugin', '1.21.4', 'paper')
    expect(result).toBeNull()
  })

  it('works with spigot platform', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'spigot')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
  })

  it('works with purpur platform', async () => {
    const result = await searchSpiget('EssentialsX', '1.21.4', 'purpur')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
  })
})
