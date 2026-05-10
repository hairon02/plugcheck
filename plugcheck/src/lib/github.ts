import { getCached, setCached } from "@/lib/cache";

const GITHUB_API = "https://api.github.com/repos";
const ABANDONMENT_THRESHOLD_MS = 18 * 30 * 24 * 60 * 60 * 1000;
const GITHUB_TTL = 24 * 60 * 60;

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function checkGitHubAbandonment(repoUrl: string): Promise<boolean> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) return false;

  const cacheKey = `plugcheck:v1:github:${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
  const cached = await getCached<boolean>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "PlugCheck/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`${GITHUB_API}/${parsed.owner}/${parsed.repo}`, {
      headers,
    });
    if (!res.ok) return false;

    const data = (await res.json()) as {
      archived: boolean;
      pushed_at: string | null;
    };

    let isAbandoned = false;
    if (data.archived) {
      isAbandoned = true;
    } else if (data.pushed_at) {
      isAbandoned =
        Date.now() - new Date(data.pushed_at).getTime() >
        ABANDONMENT_THRESHOLD_MS;
    }

    await setCached(cacheKey, isAbandoned, GITHUB_TTL);
    return isAbandoned;
  } catch {
    return false;
  }
}
