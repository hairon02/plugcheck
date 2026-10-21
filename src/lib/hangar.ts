import { getCached, setCached } from "@/lib/cache";
import type { Platform, PluginResult } from "@/types/index";

const HANGAR_BASE = "https://hangar.papermc.io/api/v1";
const HEADERS = { "User-Agent": "PlugCheck/1.0 (plugcheck.dev)" };
const SEARCH_TTL = 6 * 60 * 60;

const PLATFORM_MAP: Partial<Record<Platform, string>> = {
  paper: "PAPER",
  spigot: "PAPER",
  purpur: "PAPER",
};

interface HangarProject {
  name: string;
  namespace: { owner: string; slug: string };
  stats: { lastUpdated: string };
}

interface HangarVersion {
  name: string;
  createdAt: string;
  platformDependencies: Record<string, string[]>;
}

export async function searchHangar(
  pluginName: string,
  mcVersion: string,
  platform: Platform,
): Promise<PluginResult | null> {
  const hangarPlatform = PLATFORM_MAP[platform];
  if (!hangarPlatform) return null;

  const cacheKey = `plugcheck:v1:hangar:${pluginName.toLowerCase()}:${mcVersion}:${platform}`;
  const cached = await getCached<PluginResult>(cacheKey);
  if (cached) return cached;

  try {
    const searchRes = await fetch(
      `${HANGAR_BASE}/projects?q=${encodeURIComponent(pluginName)}&limit=5`,
      { headers: HEADERS },
    );
    if (!searchRes.ok) return null;

    const { result: projects }: { result: HangarProject[] } =
      await searchRes.json();
    if (!projects || projects.length === 0) return null;

    const project =
      projects.find((p) => p.name.toLowerCase() === pluginName.toLowerCase()) ??
      projects[0];

    const { owner, slug } = project.namespace;
    const projectUrl = `https://hangar.papermc.io/${owner}/${slug}`;

    const versionsRes = await fetch(
      `${HANGAR_BASE}/projects/${owner}/${slug}/versions?platform=${hangarPlatform}&platformVersion=${mcVersion}&limit=5`,
      { headers: HEADERS },
    );

    if (!versionsRes.ok) {
      const result: PluginResult = {
        name: project.name,
        status: "incompatible",
        latestVersion: null,
        supportedVersions: [],
        lastUpdate: project.stats.lastUpdated,
        isAbandoned: false,
        source: "hangar",
        url: projectUrl,
        alternative: null,
        dependencies: [],
      };
      await setCached(cacheKey, result, SEARCH_TTL);
      return result;
    }

    const { result: versions }: { result: HangarVersion[] } =
      await versionsRes.json();
    const isCompatible = versions && versions.length > 0;

    const result: PluginResult = {
      name: project.name,
      status: isCompatible ? "compatible" : "incompatible",
      latestVersion: isCompatible ? versions[0].name : null,
      supportedVersions: isCompatible
        ? (versions[0].platformDependencies[hangarPlatform] ?? [])
        : [],
      lastUpdate: project.stats.lastUpdated,
      isAbandoned: false,
      source: "hangar",
      url: projectUrl,
      alternative: null,
      dependencies: [],
    };

    await setCached(cacheKey, result, SEARCH_TTL);
    return result;
  } catch {
    return null;
  }
}
