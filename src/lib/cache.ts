import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY_PREFIX = 'plugcheck:v1'

export function buildCacheKey(pluginName: string, mcVersion: string, platform: string): string {
  return `${KEY_PREFIX}:${pluginName.toLowerCase()}:${mcVersion}:${platform}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // Silently ignore cache write failures
  }
}
