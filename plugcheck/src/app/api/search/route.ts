import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { getCached, setCached, redis } from '@/lib/cache'

export const runtime = 'nodejs'

// Autocomplete is more lenient — 30 req/min
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: false,
})

interface Suggestion {
  name: string
  source: string
  downloads?: number
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-real-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
    'anonymous'
  const { success } = await ratelimit.limit(`search:${ip}`)
  if (!success) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429 })
  }

  const VALID_PLATFORMS = new Set(['paper', 'spigot', 'fabric', 'forge', 'purpur'])

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const rawPlatform = searchParams.get('platform') ?? 'paper'
  const platform = VALID_PLATFORMS.has(rawPlatform) ? rawPlatform : 'paper'

  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const cacheKey = `plugcheck:search:${q.toLowerCase()}:${platform}`
  const cached = await getCached<Suggestion[]>(cacheKey)
  if (cached) return NextResponse.json({ suggestions: cached })

  // Fetch from Modrinth and Spiget in parallel — if one fails, still return the other
  const [modrinthRes, spigetRes] = await Promise.allSettled([
    fetchModrinthSuggestions(q, platform),
    fetchSpigetSuggestions(q),
  ])

  const suggestions: Suggestion[] = []
  if (modrinthRes.status === 'fulfilled') suggestions.push(...modrinthRes.value)
  if (spigetRes.status === 'fulfilled') suggestions.push(...spigetRes.value)

  // Deduplicate by lowercase name, take top 5
  const seen = new Set<string>()
  const deduped = suggestions
    .filter((s) => {
      const key = s.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)

  await setCached(cacheKey, deduped, 60 * 60)
  return NextResponse.json({ suggestions: deduped })
}

async function fetchModrinthSuggestions(q: string, platform: string): Promise<Suggestion[]> {
  const type = platform === 'fabric' || platform === 'forge' ? 'mod' : 'plugin'
  const facets = encodeURIComponent(JSON.stringify([[`project_type:${type}`]]))
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=${facets}&limit=5`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PlugCheck/1.0' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const data = await res.json() as { hits: Array<{ title: string; downloads: number }> }
  return data.hits.map((h) => ({ name: h.title, source: 'modrinth', downloads: h.downloads }))
}

async function fetchSpigetSuggestions(q: string): Promise<Suggestion[]> {
  const url = `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q)}?field=name&size=5`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PlugCheck/1.0' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const data = await res.json() as Array<{ name: string; downloads: number }>
  return data.map((r) => ({ name: r.name, source: 'spiget', downloads: r.downloads }))
}
