import { Redis } from '@upstash/redis'

export const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// v2 invalidates results from the old fuzzy provider matching behavior.
const KEY_PREFIX = 'plugcheck:v2'

export function buildCacheKey(pluginName: string, mcVersion: string, platform: string): string {
  return `${KEY_PREFIX}:${pluginName.toLowerCase()}:${mcVersion}:${platform}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured) return null
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!isRedisConfigured) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // Silently ignore cache write failures
  }
}
