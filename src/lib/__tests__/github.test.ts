import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}))

import { checkGitHubAbandonment } from '../github'
import { getCached, setCached } from '@/lib/cache'

const NOW = Date.now()
const ABANDONMENT_MS = 18 * 30 * 24 * 60 * 60 * 1000

const recentDate = new Date(NOW - 1000 * 60 * 60 * 24 * 30).toISOString() // 30 days ago
const oldDate = new Date(NOW - ABANDONMENT_MS - 1000).toISOString()       // 18+ months ago

describe('checkGitHubAbandonment', () => {
  beforeEach(() => {
    vi.mocked(getCached).mockResolvedValue(null)
    vi.unstubAllEnvs()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: recentDate }),
    }))
  })

  it('returns false for non-GitHub URL', async () => {
    const result = await checkGitHubAbandonment('https://example.com/repo')
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns false for empty string', async () => {
    const result = await checkGitHubAbandonment('')
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns false for active repo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: recentDate }),
    }))
    const result = await checkGitHubAbandonment('https://github.com/EssentialsX/Essentials')
    expect(result).toBe(false)
  })

  it('returns true for archived repo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: true, pushed_at: recentDate }),
    }))
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(true)
  })

  it('returns true when last push was 18+ months ago', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: oldDate }),
    }))
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(true)
  })

  it('returns false when pushed_at is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: null }),
    }))
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(false)
  })

  it('returns false when API response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(false)
  })

  it('returns false on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(false)
  })

  it('parses .git suffix out of repo URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: recentDate }),
    }))
    await checkGitHubAbandonment('https://github.com/owner/repo.git')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo',
      expect.any(Object)
    )
  })

  it('includes Authorization header when GITHUB_TOKEN is set', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token-123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: recentDate }),
    }))
    await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token-123' }),
      })
    )
  })

  it('caches the result after fetching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: false, pushed_at: recentDate }),
    }))
    await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(vi.mocked(setCached)).toHaveBeenCalledWith(
      expect.stringContaining('github'),
      false,
      expect.any(Number)
    )
  })

  it('returns cached result without hitting the API', async () => {
    vi.mocked(getCached).mockResolvedValue(true)
    const result = await checkGitHubAbandonment('https://github.com/owner/repo')
    expect(result).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
})
