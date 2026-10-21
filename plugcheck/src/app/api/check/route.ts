import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { resolvePlugin } from "@/lib/aggregator";
import { detectConflicts } from "@/lib/conflict-detector";
import { getCached, setCached, buildCacheKey, redis } from "@/lib/cache";
import type { PluginResult, CheckResponse, Platform } from "@/types";

export const runtime = "nodejs";

// 10 requests per IP per minute — prevents abuse without blocking legitimate users
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: false,
});

const PluginInputSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().nullable(),
  type: z.enum(["plugin", "mod"]),
  dependencies: z.array(z.string().max(200)).max(50),
  source: z.enum(["jar", "manual"]),
});

const CheckRequestSchema = z.object({
  plugins: z.array(PluginInputSchema).min(1).max(300),
  mcVersion: z.string().min(1).max(20),
  platform: z.enum(["paper", "spigot", "fabric", "forge", "purpur"]),
});

function errorJson(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-real-ip")?.trim() ??
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "anonymous";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return errorJson(
      "RATE_LIMITED",
      "Too many requests. Please wait a minute.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  const parsed = CheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
    );
  }

  const { plugins, mcVersion, platform } = parsed.data;

  let results: PluginResult[];
  try {
    results = await Promise.all(
      plugins.map(async (plugin) => {
        const key = buildCacheKey(plugin.name, mcVersion, platform);
        const cached = await getCached<PluginResult>(key);
        if (cached) return cached;

        const result = await resolvePlugin(
          plugin,
          mcVersion,
          platform as Platform,
        );
        await setCached(key, result, 6 * 60 * 60);
        return result;
      }),
    );
  } catch {
    return errorJson(
      "UPSTREAM_ERROR",
      "External APIs are temporarily unavailable",
      502,
    );
  }

  const conflicts = detectConflicts(results);

  const response: CheckResponse = {
    results,
    conflicts,
    summary: {
      total: results.length,
      compatible: results.filter((r) => r.status === "compatible").length,
      incompatible: results.filter((r) => r.status === "incompatible").length,
      abandoned: results.filter((r) => r.isAbandoned).length,
      unknown: results.filter((r) => r.status === "unknown").length,
      conflicts: conflicts.length,
    },
    mcVersion,
    platform: platform as Platform,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
