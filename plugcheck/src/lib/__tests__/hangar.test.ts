import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { searchHangar } from '../hangar'
import { getCached, setCached } from '@/lib/cache'

const mockProject = {
  name: 'EssentialsX',
  namespace: { owner: 'EssentialsX', slug: 'EssentialsX' },
  stats: { lastUpdated: '2024-12-01T00:00:00Z' },
}

const mockVersion = {
  name: '2.20.0',
  createdAt: '2024-12-01T00:00:00Z',
  platformDependencies: { PAPER: ['1.21.4', '1.21.3'] },
}

describe('searchHangar', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockProject] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockVersion] }),
      })
    )
  })

  it('returns null for fabric platform', async () => {
    const result = await searchHangar('EssentialsX', '1.21.4', 'fabric')
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null for forge platform', async () => {
    const result = await searchHangar('EssentialsX', '1.21.4', 'forge')
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns compatible result when versions found', async () => {
    const result = await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
    expect(result!.source).toBe('hangar')
    expect(result!.latestVersion).toBe('2.20.0')
    expect(result!.supportedVersions).toContain('1.21.4')
  })

  it('finds exact name match case-insensitively', async () => {
    const otherProject = {
      name: 'EssentialsXtra',
      namespace: { owner: 'Other', slug: 'other' },
      stats: { lastUpdated: '2024-01-01T00:00:00Z' },
    }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [otherProject, mockProject] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockVersion] }),
      })
    )
    const result = await searchHangar('essentialsx', '1.21.4', 'paper')
    expect(result!.name).toBe('EssentialsX')
  })

  it('falls back to first result if no exact match', async () => {
    const firstProject = {
      name: 'EssentialsXtra',
      namespace: { owner: 'Other', slug: 'other' },
      stats: { lastUpdated: '2024-01-01T00:00:00Z' },
    }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [firstProject] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockVersion] }),
      })
    )
    const result = await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(result!.name).toBe('EssentialsXtra')
  })

  it('returns incompatible when versions endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockProject] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    )
    const result = await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('incompatible')
    expect(result!.name).toBe('EssentialsX')
    expect(result!.source).toBe('hangar')
  })

  it('returns incompatible when no versions match mcVersion', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [mockProject] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [] }),
      })
    )
    const result = await searchHangar('EssentialsX', '1.18.0', 'paper')
    expect(result!.status).toBe('incompatible')
  })

  it('caches the result after fetching', async () => {
    await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('essentialsx'),
      expect.objectContaining({ source: 'hangar' }),
      expect.any(Number)
    )
  })

  it('returns cached result without hitting the API', async () => {
    const cached = { name: 'EssentialsX', status: 'compatible', source: 'hangar' } as any
    vi.mocked(getCached).mockResolvedValue(cached)
    const result = await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(result).toBe(cached)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null on search fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await searchHangar('EssentialsX', '1.21.4', 'paper')
    expect(result).toBeNull()
  })

  it('returns null when search returns no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [] }),
    }))
    const result = await searchHangar('UnknownPlugin', '1.21.4', 'paper')
    expect(result).toBeNull()
  })

  it('works with spigot platform mapped to PAPER', async () => {
    const result = await searchHangar('EssentialsX', '1.21.4', 'spigot')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
  })

  it('works with purpur platform mapped to PAPER', async () => {
    const result = await searchHangar('EssentialsX', '1.21.4', 'purpur')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('compatible')
  })
})
