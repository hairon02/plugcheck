import { getCached, setCached } from "@/lib/cache";
import type { Platform, PluginResult } from "@/types/index";

const SPIGET_BASE = "https://api.spiget.org/v2";
const HEADERS = { "User-Agent": "PlugCheck/1.0 (plugcheck.dev)" };
const SEARCH_TTL = 6 * 60 * 60;
const ABANDONMENT_SECONDS = 18 * 30 * 24 * 60 * 60;
const SUPPORTED_PLATFORMS = new Set<Platform>(["paper", "spigot", "purpur"]);

interface SpigetResource {
  id: number;
  name: string;
  updateDate: number;
}

interface SpigetVersion {
  name: string;
}

export async function searchSpiget(
  name: string,
  mcVersion: string,
  platform: Platform,
): Promise<PluginResult | null> {
  if (!SUPPORTED_PLATFORMS.has(platform)) return null;

  const cacheKey = `plugcheck:v1:spiget:${name.toLowerCase()}:${mcVersion}:${platform}`;
  const cached = await getCached<PluginResult>(cacheKey);
  if (cached) return cached;

  try {
    const searchRes = await fetch(
      `${SPIGET_BASE}/search/resources/${encodeURIComponent(name)}?field=name&size=5`,
      { headers: HEADERS },
    );
    if (!searchRes.ok) return null;

    const resources: SpigetResource[] = await searchRes.json();
    if (!resources || resources.length === 0) return null;

    const resource =
      resources.find((r) => r.name.toLowerCase() === name.toLowerCase()) ??
      resources[0];

    const versionRes = await fetch(
      `${SPIGET_BASE}/resources/${resource.id}/versions/latest`,
      { headers: HEADERS },
    );
    const versionData: SpigetVersion | null = versionRes.ok
      ? await versionRes.json()
      : null;

    const lastUpdateIso = resource.updateDate
      ? new Date(resource.updateDate * 1000).toISOString()
      : null;

    const isAbandoned = resource.updateDate
      ? Date.now() / 1000 - resource.updateDate > ABANDONMENT_SECONDS
      : false;

    const result: PluginResult = {
      name: resource.name,
      status: isAbandoned ? "abandoned" : "compatible",
      latestVersion: versionData?.name ?? null,
      supportedVersions: [],
      lastUpdate: lastUpdateIso,
      isAbandoned,
      source: "spigot",
      url: `https://www.spigotmc.org/resources/${resource.id}/`,
      alternative: null,
      dependencies: [],
    };

    await setCached(cacheKey, result, SEARCH_TTL);
    return result;
  } catch {
    return null;
  }
}
