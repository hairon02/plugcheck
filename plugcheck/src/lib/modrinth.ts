import { getCached, setCached } from '@/lib/cache'
import staticVersions from '@/data/mc-versions.json'

const MODRINTH_BASE = 'https://api.modrinth.com/v2'
const HEADERS = { 'User-Agent': 'PlugCheck/1.0 (haironl072@gmail.com)' }

const MC_VERSIONS_CACHE_KEY = 'plugcheck:v1:mc-versions'
const SEARCH_TTL = 6 * 60 * 60
const VERSIONS_TTL = 24 * 60 * 60

interface ModrinthGameVersion {
  version: string
  version_type: 'release' | 'snapshot' | 'alpha' | 'beta' | 'rc'
  date: string
  major: boolean
}

export interface ModrinthSearchHit {
  project_id: string
  slug: string
  title: string
  loaders: string[]
  versions: string[]
  date_modified: string
  follows: number
  downloads: number
}

export interface ModrinthProject {
  id: string
  slug: string
  title: string
  loaders: string[]
  versions: string[]
  date_modified: string
  status: string
}

export async function getMCVersions(): Promise<string[]> {
  const cached = await getCached<string[]>(MC_VERSIONS_CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch(`${MODRINTH_BASE}/tag/game_version`, { headers: HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const all: ModrinthGameVersion[] = await res.json()
    const releases = all.filter(v => v.version_type === 'release').map(v => v.version)
    await setCached(MC_VERSIONS_CACHE_KEY, releases, VERSIONS_TTL)
    return releases
  } catch {
    return staticVersions as string[]
  }
}

export async function searchProject(
  name: string,
  mcVersion: string,
  loaders: string[]
): Promise<ModrinthSearchHit[]> {
  const cacheKey = `plugcheck:v1:search:${name.toLowerCase()}:${mcVersion}:${[...loaders].sort().join(',')}`
  const cached = await getCached<ModrinthSearchHit[]>(cacheKey)
  if (cached) return cached

  try {
    const loaderFacets = loaders.map(l => `"categories:${l}"`).join(',')
    const facets = `[["versions:${mcVersion}"],[${loaderFacets}]]`
    const url = `${MODRINTH_BASE}/search?query=${encodeURIComponent(name)}&facets=${encodeURIComponent(facets)}&limit=5`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { hits } = await res.json()
    await setCached(cacheKey, hits, SEARCH_TTL)
    return hits
  } catch {
    return []
  }
}

export async function getProject(idOrSlug: string): Promise<ModrinthProject | null> {
  const cacheKey = `plugcheck:v1:project:${idOrSlug}`
  const cached = await getCached<ModrinthProject>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`${MODRINTH_BASE}/project/${idOrSlug}`, { headers: HEADERS })
    if (!res.ok) return null
    const project: ModrinthProject = await res.json()
    await setCached(cacheKey, project, SEARCH_TTL)
    return project
  } catch {
    return null
  }
}
