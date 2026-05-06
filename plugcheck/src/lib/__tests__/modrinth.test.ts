import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { getMCVersions, searchProject, getProject } from '../modrinth'
import { getCached, setCached } from '@/lib/cache'

const mockGameVersions = [
  { version: '1.21.4', version_type: 'release', date: '2024-12-03T08:00:00.000Z', major: false },
  { version: '1.21-rc1', version_type: 'rc', date: '2024-11-20T08:00:00.000Z', major: false },
  { version: '1.20.1', version_type: 'release', date: '2023-06-12T08:00:00.000Z', major: false },
  { version: '24w01a', version_type: 'snapshot', date: '2024-01-03T08:00:00.000Z', major: false },
]

const mockSearchHit = {
  project_id: 'aaaabbbb',
  slug: 'essentialsx',
  title: 'EssentialsX',
  loaders: ['paper', 'spigot'],
  versions: ['1.21.4', '1.20.1'],
  date_modified: '2024-12-01T00:00:00.000Z',
  follows: 5000,
  downloads: 500000,
}

const mockProject = {
  id: 'aaaabbbb',
  slug: 'essentialsx',
  title: 'EssentialsX',
  loaders: ['paper', 'spigot'],
  versions: ['ver1', 'ver2'],
  date_modified: '2024-12-01T00:00:00.000Z',
  status: 'approved',
}

describe('getMCVersions', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGameVersions,
    }))
  })

  it('returns only release versions', async () => {
    const versions = await getMCVersions()
    expect(versions).toContain('1.21.4')
    expect(versions).toContain('1.20.1')
    expect(versions).not.toContain('1.21-rc1')
    expect(versions).not.toContain('24w01a')
  })

  it('caches the result after fetching', async () => {
    await getMCVersions()
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('mc-versions'),
      expect.arrayContaining(['1.21.4', '1.20.1']),
      expect.any(Number)
    )
  })

  it('returns cached versions without hitting the API', async () => {
    vi.mocked(getCached).mockResolvedValue(['1.21.4', '1.20.1'])
    const versions = await getMCVersions()
    expect(versions).toEqual(['1.21.4', '1.20.1'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back to static list when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const versions = await getMCVersions()
    expect(versions.length).toBeGreaterThan(0)
    expect(versions).toContain('1.21.4')
  })

  it('falls back to static list when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }))
    const versions = await getMCVersions()
    expect(versions.length).toBeGreaterThan(0)
  })
})

describe('searchProject', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [mockSearchHit], total_hits: 1 }),
    }))
  })

  it('returns search hits for a valid query', async () => {
    const results = await searchProject('EssentialsX', '1.21.4', ['paper'])
    expect(results).toHaveLength(1)
    expect(results[0].slug).toBe('essentialsx')
    expect(results[0].versions).toContain('1.21.4')
  })

  it('caches search results after fetching', async () => {
    await searchProject('EssentialsX', '1.21.4', ['paper'])
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('essentialsx'),
      expect.arrayContaining([expect.objectContaining({ slug: 'essentialsx' })]),
      expect.any(Number)
    )
  })

  it('returns cached results without hitting the API', async () => {
    vi.mocked(getCached).mockResolvedValue([mockSearchHit])
    const results = await searchProject('EssentialsX', '1.21.4', ['paper'])
    expect(results).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const results = await searchProject('EssentialsX', '1.21.4', ['paper'])
    expect(results).toEqual([])
  })

  it('returns empty array when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const results = await searchProject('EssentialsX', '1.21.4', ['paper'])
    expect(results).toEqual([])
  })
})

describe('getProject', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProject,
    }))
  })

  it('fetches a project by id', async () => {
    const project = await getProject('aaaabbbb')
    expect(project).not.toBeNull()
    expect(project!.slug).toBe('essentialsx')
    expect(project!.loaders).toContain('paper')
  })

  it('caches the project after fetching', async () => {
    await getProject('aaaabbbb')
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('aaaabbbb'),
      expect.objectContaining({ slug: 'essentialsx' }),
      expect.any(Number)
    )
  })

  it('returns cached project without hitting the API', async () => {
    vi.mocked(getCached).mockResolvedValue(mockProject)
    const project = await getProject('aaaabbbb')
    expect(project!.slug).toBe('essentialsx')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const project = await getProject('nonexistent')
    expect(project).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const project = await getProject('aaaabbbb')
    expect(project).toBeNull()
  })
})
