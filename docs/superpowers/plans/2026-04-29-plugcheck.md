# PlugCheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PlugCheck — a public, stateless web tool that verifies Minecraft plugin/mod compatibility against any MC version, detects conflicts, and flags abandoned plugins.

**Architecture:** Next.js 15 App Router monolith. JAR files are parsed client-side with JSZip (files never touch the server). API routes query Modrinth/Hangar/Spiget in parallel, cache results in Upstash Redis (TTL 6h), then run conflict detection before returning a full report.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS v4, shadcn/ui, JSZip, js-yaml, Zod, @upstash/redis, @upstash/ratelimit, Vitest

**Working directory:** `/home/hairon/Documents/PlugCheck`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/types/index.ts` | All shared TypeScript types |
| `src/data/mc-versions.json` | MC version list for selector |
| `src/data/known-conflicts.json` | Curated incompatible plugin pairs |
| `src/lib/jar-parser.ts` | JSZip → PluginInput[] (client-side) |
| `src/lib/cache.ts` | Upstash Redis get/set wrapper |
| `src/lib/conflict-detector.ts` | Pure conflict detection logic |
| `src/lib/api/modrinth.ts` | Modrinth API v2 client |
| `src/lib/api/hangar.ts` | Hangar PaperMC API client |
| `src/lib/api/spiget.ts` | Spiget SpigotMC API client |
| `src/lib/api/github.ts` | GitHub abandonment check |
| `src/lib/api/aggregator.ts` | Orchestrates all API clients with priority |
| `src/app/api/check/route.ts` | POST /api/check — main endpoint |
| `src/app/api/search/route.ts` | GET /api/search — autocomplete |
| `src/app/globals.css` | Tailwind + CSS variables design system |
| `src/app/layout.tsx` | Root layout, fonts, metadata |
| `src/app/page.tsx` | Single-page UI |
| `src/components/checker/CheckerSection.tsx` | All checker state ("use client") |
| `src/components/checker/PlatformTabs.tsx` | Paper/Fabric/Forge tabs |
| `src/components/checker/VersionSelector.tsx` | MC version dropdown |
| `src/components/checker/DropZone.tsx` | Drag & drop JAR files |
| `src/components/checker/PluginNameInput.tsx` | Textarea + autocomplete |
| `src/components/checker/CheckButton.tsx` | CTA with loading state |
| `src/components/results/ResultsPanel.tsx` | Results wrapper |
| `src/components/results/SummaryBar.tsx` | 4-number summary cards |
| `src/components/results/ConflictCard.tsx` | Amber conflict alerts |
| `src/components/results/ResultsTable.tsx` | Table of plugin results |
| `src/components/results/PluginRow.tsx` | Single table row |
| `src/components/results/StatusBadge.tsx` | Colored status pill |
| `src/components/results/ExportButton.tsx` | CSV export |
| `src/components/shared/Navbar.tsx` | Top nav |
| `src/components/shared/Footer.tsx` | Footer with API credits |
| `src/components/shared/HowItWorks.tsx` | 3-step explainer |
| `src/lib/__tests__/jar-parser.test.ts` | Unit tests for JAR parsing |
| `src/lib/__tests__/conflict-detector.test.ts` | Unit tests for conflict logic |
| `src/lib/__tests__/aggregator.test.ts` | Unit tests for API orchestration |

---

## Phase 1 — Foundation

### Task 1: Scaffold Next.js project

**Files:**
- Create: entire project structure via CLI

- [ ] **Step 1: Run scaffold command**

```bash
cd /home/hairon/Documents/PlugCheck
pnpm create next-app@latest plugcheck --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

When prompted: TypeScript → Yes, ESLint → Yes, Tailwind → Yes, `src/` → Yes, App Router → Yes, import alias → `@/*`

- [ ] **Step 2: Install core dependencies**

```bash
cd plugcheck
pnpm add jszip js-yaml @upstash/redis @upstash/ratelimit zod
pnpm add -D @types/js-yaml vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

When prompted: style → Default, base color → Slate, CSS variables → Yes

- [ ] **Step 4: Add shadcn components**

```bash
pnpm dlx shadcn@latest add button badge table tabs select textarea card separator
```

- [ ] **Step 5: Initialize git**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js 15 project with shadcn/ui"
```

Expected: commit succeeds, working tree clean

---

### Task 2: Configure design system

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace globals.css**

```css
/* src/app/globals.css */
@import "tailwindcss";

/* Design system CSS variables — referenced in components via var() or Tailwind arbitrary values */
:root {
  --color-primary: #16A34A;
  --color-on-primary: #FFFFFF;
  --color-secondary: #6366F1;
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted: #F1F5F9;
  --color-muted-fg: #64748B;
  --color-border: #E2E8F0;
  --color-destructive: #DC2626;
  --color-warning: #D97706;
  --color-ring: #16A34A;
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans, system-ui, sans-serif);
}
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
pnpm dev
```

Expected: `Ready on http://localhost:3000` with no TypeScript or Tailwind errors. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: configure design system CSS variables"
```

---

### Task 3: TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write types file**

```typescript
// src/types/index.ts

export type Platform = "paper" | "spigot" | "fabric" | "forge" | "purpur"

export type PluginStatus = "compatible" | "incompatible" | "abandoned" | "unknown"

export interface PluginInput {
  name: string
  version: string | null        // from JAR metadata or null if not found
  type: "plugin" | "mod"
  dependencies: string[]        // hard + soft deps from plugin.yml / fabric.mod.json
  source: "jar" | "manual"
}

export interface AlternativePlugin {
  name: string
  url: string
  reason: string
}

export interface PluginResult {
  name: string
  status: PluginStatus
  latestVersion: string | null
  supportedVersions: string[]
  lastUpdate: string | null     // ISO date string
  isAbandoned: boolean
  source: "modrinth" | "spigot" | "hangar" | "github"
  url: string | null
  alternative: AlternativePlugin | null
  dependencies: string[]
}

export interface ConflictResult {
  type: "dependency" | "known" | "duplicate"
  plugins: string[]
  severity: "error" | "warning"
  reason: string
}

export interface CheckResponse {
  results: PluginResult[]
  conflicts: ConflictResult[]
  summary: {
    total: number
    compatible: number
    incompatible: number
    abandoned: number
    unknown: number
    conflicts: number
  }
  mcVersion: string
  platform: Platform
  checkedAt: string             // ISO date string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core TypeScript types"
```

---

### Task 4: Static data files

**Files:**
- Create: `src/data/mc-versions.json`
- Create: `src/data/known-conflicts.json`

- [ ] **Step 1: Create mc-versions.json**

```json
[
  "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18"
]
```

Save to: `src/data/mc-versions.json`

- [ ] **Step 2: Create known-conflicts.json**

```json
[
  {
    "plugins": ["EssentialsX", "CMI"],
    "severity": "error",
    "reason": "Both provide /home, /spawn, /msg and economy — direct command conflict"
  },
  {
    "plugins": ["WorldEdit", "FastAsyncWorldEdit"],
    "severity": "warning",
    "reason": "FAWE is a fork of WorldEdit — use one, not both"
  },
  {
    "plugins": ["PlaceholderAPI", "MVdWPlaceholderAPI"],
    "severity": "warning",
    "reason": "Competing placeholder APIs — may conflict in some plugins"
  },
  {
    "plugins": ["AuthMe", "nLogin"],
    "severity": "error",
    "reason": "Duplicate authentication systems — only one can manage logins"
  },
  {
    "plugins": ["Multiverse-Core", "MyWorlds"],
    "severity": "warning",
    "reason": "Competing world management plugins — can cause world loading conflicts"
  },
  {
    "plugins": ["WorldGuard", "GriefPrevention"],
    "severity": "warning",
    "reason": "Overlapping region protection — can cause permission conflicts"
  },
  {
    "plugins": ["Vault", "EconomyAPI"],
    "severity": "warning",
    "reason": "Competing economy bridge APIs — plugins may pick different ones"
  },
  {
    "plugins": ["ProtocolLib", "ProtocolSupport"],
    "severity": "error",
    "reason": "Both manipulate the Minecraft protocol — known incompatibility"
  },
  {
    "plugins": ["EssentialsX", "CMI"],
    "severity": "error",
    "reason": "Duplicate player management features"
  },
  {
    "plugins": ["LuckPerms", "GroupManager"],
    "severity": "error",
    "reason": "Duplicate permissions systems — only one should manage permissions"
  }
]
```

Save to: `src/data/known-conflicts.json`

- [ ] **Step 3: Commit**

```bash
git add src/data/
git commit -m "feat: add MC versions list and known conflict pairs"
```

---

### Task 5: Project config files

**Files:**
- Create: `CLAUDE.md`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create CLAUDE.md**

```markdown
# PlugCheck

Web tool that verifies Minecraft plugin/mod compatibility. No login, stateless, MVP validation tool.

## Commands

- `pnpm dev` — Start dev server (localhost:3000)
- `pnpm build` — Production build
- `pnpm lint` — ESLint
- `pnpm test` — Vitest unit tests

## Tech Stack

Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v4 + shadcn/ui + JSZip (client) + Upstash Redis + Vercel

## Key Architecture Rules

1. **JAR files are parsed client-side with JSZip** — files NEVER reach the server, only metadata does
2. **All external API calls go through cache.ts** — never call Modrinth/Spiget/Hangar directly from routes
3. **Rate limiting on every API route** — 10 req/min for /api/check, 30 req/min for /api/search
4. **TypeScript strict, zero `any`** — use `unknown` + type guards if type is uncertain
5. **CheckerSection.tsx is the only large "use client"** — all checker state lives there
6. **Cache key format:** `plugcheck:v1:{pluginName.toLowerCase()}:{mcVersion}:{platform}`

## Directory Structure

- `src/app/` — App Router pages and API routes
- `src/components/checker/` — Input components (DropZone, PluginNameInput, etc.)
- `src/components/results/` — Output components (ResultsTable, ConflictCard, etc.)
- `src/components/shared/` — Navbar, Footer, HowItWorks
- `src/lib/` — Business logic (jar-parser, conflict-detector, cache, api/)
- `src/data/` — Static JSON (mc-versions, known-conflicts)
- `src/types/index.ts` — All TypeScript types
```

- [ ] **Step 2: Create .env.example**

```bash
# .env.example — copy to .env.local and fill in values
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url_here
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token_here
# Optional — without this, GitHub API is limited to 60 requests/hour
GITHUB_TOKEN=your_github_personal_access_token_here
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create src/test/setup.ts**

```typescript
// src/test/setup.ts
import '@testing-library/react'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to the `scripts` section:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .env.example vitest.config.ts src/test/setup.ts package.json
git commit -m "feat: add project config files and Vitest setup"
```

---

## Phase 2 — Core Library

### Task 6: jar-parser — plugin.yml (TDD)

**Files:**
- Create: `src/lib/__tests__/jar-parser.test.ts`
- Create: `src/lib/jar-parser.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/jar-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseJarFiles } from '../jar-parser'

// Creates an in-memory ZIP file (same format as .jar) with the given files inside
async function createMockJar(
  files: Record<string, string>,
  jarName = 'test-plugin.jar'
): Promise<File> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content)
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return new File([bytes], jarName, { type: 'application/java-archive' })
}

describe('parseJarFiles — plugin.yml (Paper/Spigot)', () => {
  it('extracts name, version, and hard dependencies', async () => {
    const jar = await createMockJar({
      'plugin.yml': `name: EssentialsX\nversion: 2.20.1\ndepend:\n  - Vault\nsoftdepend:\n  - Essentials`,
    }, 'EssentialsX.jar')

    const result = await parseJarFiles([jar])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'EssentialsX',
      version: '2.20.1',
      type: 'plugin',
      dependencies: ['Vault', 'Essentials'],
      source: 'jar',
    })
  })

  it('uses filename as fallback when plugin.yml has no name field', async () => {
    const jar = await createMockJar({
      'plugin.yml': `version: 1.0.0`,
    }, 'MyPlugin.jar')

    const result = await parseJarFiles([jar])
    expect(result[0].name).toBe('MyPlugin')
  })

  it('handles missing depend/softdepend fields gracefully', async () => {
    const jar = await createMockJar({
      'plugin.yml': `name: SimplePlugin\nversion: 1.0.0`,
    })

    const result = await parseJarFiles([jar])
    expect(result[0].dependencies).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm test:run src/lib/__tests__/jar-parser.test.ts
```

Expected: FAIL — `Cannot find module '../jar-parser'`

- [ ] **Step 3: Implement jar-parser.ts (plugin.yml support)**

```typescript
// src/lib/jar-parser.ts
import JSZip from 'jszip'
import type { PluginInput } from '@/types'

// Returns filename without .jar extension — used as fallback plugin name
function fileBaseName(file: File): string {
  return file.name.replace(/\.jar$/i, '')
}

// js-yaml is large — dynamic import keeps it out of the initial bundle
async function parseYaml(content: string): Promise<Record<string, unknown>> {
  const { load } = await import('js-yaml')
  const parsed = load(content)
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}

export async function parseJarFiles(files: File[]): Promise<PluginInput[]> {
  return Promise.all(files.map(parseJar))
}

async function parseJar(file: File): Promise<PluginInput> {
  const zip = await JSZip.loadAsync(file)

  // --- Paper / Spigot ---
  const pluginYml = zip.file('plugin.yml')
  if (pluginYml) {
    const content = await pluginYml.async('string')
    const data = await parseYaml(content)
    const depend = Array.isArray(data['depend']) ? (data['depend'] as string[]) : []
    const softdepend = Array.isArray(data['softdepend']) ? (data['softdepend'] as string[]) : []
    return {
      name: typeof data['name'] === 'string' ? data['name'] : fileBaseName(file),
      version: typeof data['version'] === 'string' ? data['version'] : null,
      type: 'plugin',
      dependencies: [...depend, ...softdepend],
      source: 'jar',
    }
  }

  // Fabric and Forge handled in Task 7
  return {
    name: fileBaseName(file),
    version: null,
    type: 'plugin',
    dependencies: [],
    source: 'jar',
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm test:run src/lib/__tests__/jar-parser.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/jar-parser.ts src/lib/__tests__/jar-parser.test.ts
git commit -m "feat: jar-parser with plugin.yml support (TDD)"
```

---

### Task 7: jar-parser — Fabric and Forge support (TDD)

**Files:**
- Modify: `src/lib/__tests__/jar-parser.test.ts`
- Modify: `src/lib/jar-parser.ts`

- [ ] **Step 1: Add failing tests for Fabric and Forge**

Append to `src/lib/__tests__/jar-parser.test.ts`:

```typescript
describe('parseJarFiles — fabric.mod.json (Fabric)', () => {
  it('extracts id, version, and mod dependencies', async () => {
    const jar = await createMockJar({
      'fabric.mod.json': JSON.stringify({
        id: 'fabric-api',
        version: '0.92.0',
        depends: {
          'fabricloader': '>=0.14.0',
          'minecraft': '~1.21',
          'sodium': '*',       // real dependency — should be included
        },
      }),
    }, 'fabric-api.jar')

    const result = await parseJarFiles([jar])
    expect(result[0]).toMatchObject({
      name: 'fabric-api',
      version: '0.92.0',
      type: 'mod',
      source: 'jar',
    })
    // fabricloader and minecraft are infrastructure deps — filtered out
    expect(result[0].dependencies).toContain('sodium')
    expect(result[0].dependencies).not.toContain('fabricloader')
    expect(result[0].dependencies).not.toContain('minecraft')
  })
})

describe('parseJarFiles — META-INF/mods.toml (Forge)', () => {
  it('extracts modId and version via regex', async () => {
    const toml = `
[[mods]]
modId = "jei"
version = "19.20.0.243"
displayName = "Just Enough Items"
`
    const jar = await createMockJar({ 'META-INF/mods.toml': toml }, 'jei.jar')
    const result = await parseJarFiles([jar])
    expect(result[0]).toMatchObject({
      name: 'jei',
      version: '19.20.0.243',
      type: 'mod',
      source: 'jar',
    })
  })
})

describe('parseJarFiles — unknown format', () => {
  it('uses filename as name and returns null version for unrecognized JARs', async () => {
    const jar = await createMockJar({ 'readme.txt': 'nothing useful' }, 'unknown-plugin.jar')
    const result = await parseJarFiles([jar])
    expect(result[0].name).toBe('unknown-plugin')
    expect(result[0].version).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failures for new cases**

```bash
pnpm test:run src/lib/__tests__/jar-parser.test.ts
```

Expected: 3 existing tests PASS, 3 new tests FAIL

- [ ] **Step 3: Extend jar-parser.ts with Fabric and Forge**

Replace the `parseJar` function in `src/lib/jar-parser.ts` with:

```typescript
// Infrastructure deps in Fabric mods — not plugin dependencies, filter them out
const FABRIC_INFRASTRUCTURE_DEPS = new Set(['fabricloader', 'minecraft', 'java'])

async function parseJar(file: File): Promise<PluginInput> {
  const zip = await JSZip.loadAsync(file)

  // --- Paper / Spigot ---
  const pluginYml = zip.file('plugin.yml')
  if (pluginYml) {
    const content = await pluginYml.async('string')
    const data = await parseYaml(content)
    const depend = Array.isArray(data['depend']) ? (data['depend'] as string[]) : []
    const softdepend = Array.isArray(data['softdepend']) ? (data['softdepend'] as string[]) : []
    return {
      name: typeof data['name'] === 'string' ? data['name'] : fileBaseName(file),
      version: typeof data['version'] === 'string' ? data['version'] : null,
      type: 'plugin',
      dependencies: [...depend, ...softdepend],
      source: 'jar',
    }
  }

  // --- Fabric ---
  const fabricMod = zip.file('fabric.mod.json')
  if (fabricMod) {
    const content = await fabricMod.async('string')
    const data = JSON.parse(content) as Record<string, unknown>
    const depends =
      data['depends'] && typeof data['depends'] === 'object'
        ? Object.keys(data['depends'] as Record<string, unknown>).filter(
            (k) => !FABRIC_INFRASTRUCTURE_DEPS.has(k)
          )
        : []
    return {
      name: typeof data['id'] === 'string' ? data['id'] : fileBaseName(file),
      version: typeof data['version'] === 'string' ? data['version'] : null,
      type: 'mod',
      dependencies: depends,
      source: 'jar',
    }
  }

  // --- Forge ---
  // mods.toml uses TOML format — extract only what we need with regex
  const modsToml = zip.file('META-INF/mods.toml')
  if (modsToml) {
    const content = await modsToml.async('string')
    const modIdMatch = content.match(/modId\s*=\s*"([^"]+)"/)
    const versionMatch = content.match(/\bversion\s*=\s*"([^"]+)"/)
    return {
      name: modIdMatch?.[1] ?? fileBaseName(file),
      version: versionMatch?.[1] ?? null,
      type: 'mod',
      dependencies: [],
      source: 'jar',
    }
  }

  // --- Unknown format ---
  return {
    name: fileBaseName(file),
    version: null,
    type: 'plugin',
    dependencies: [],
    source: 'jar',
  }
}
```

- [ ] **Step 4: Run all jar-parser tests — expect all pass**

```bash
pnpm test:run src/lib/__tests__/jar-parser.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/jar-parser.ts src/lib/__tests__/jar-parser.test.ts
git commit -m "feat: extend jar-parser with Fabric and Forge support"
```

---

### Task 8: cache.ts

**Files:**
- Create: `src/lib/cache.ts`

- [ ] **Step 1: Create cache wrapper**

```typescript
// src/lib/cache.ts
import { Redis } from '@upstash/redis'

// Singleton — serverless functions may reuse the same module instance
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY_PREFIX = 'plugcheck:v1'

// Consistent key format ensures we never accidentally share cache across platforms or versions
export function buildCacheKey(pluginName: string, mcVersion: string, platform: string): string {
  return `${KEY_PREFIX}:${pluginName.toLowerCase()}:${mcVersion}:${platform}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key)
  } catch {
    // Cache is best-effort — a Redis failure should not break the app
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat: add Upstash Redis cache wrapper"
```

---

### Task 9: modrinth.ts

**Files:**
- Create: `src/lib/api/modrinth.ts`

- [ ] **Step 1: Create Modrinth API client**

```typescript
// src/lib/api/modrinth.ts
import type { PluginResult, Platform } from '@/types'

const BASE_URL = 'https://api.modrinth.com/v2'
// Modrinth requires a descriptive User-Agent to avoid rate limits
const UA = 'PlugCheck/1.0 (contact@plugcheck.app)'

// Modrinth project type differs between plugins and mods
function getProjectType(platform: Platform): string {
  return platform === 'fabric' || platform === 'forge' ? 'mod' : 'plugin'
}

export async function searchModrinth(
  name: string,
  mcVersion: string,
  platform: Platform
): Promise<PluginResult | null> {
  const projectType = getProjectType(platform)
  const facets = encodeURIComponent(JSON.stringify([[`project_type:${projectType}`]]))
  const searchUrl = `${BASE_URL}/search?query=${encodeURIComponent(name)}&facets=${facets}&limit=5`

  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': UA },
    // next.revalidate:0 disables Next.js fetch cache — we handle caching via Redis
    next: { revalidate: 0 },
  })
  if (!searchRes.ok) return null

  const searchData = await searchRes.json() as {
    hits: Array<{ project_id: string; title: string; slug: string; source_url?: string }>
  }

  // Prefer exact name match, then take first result
  const hit =
    searchData.hits.find((h) => h.title.toLowerCase() === name.toLowerCase()) ??
    searchData.hits[0]
  if (!hit) return null

  // Fetch versions that support the requested MC version
  const versionsUrl = `${BASE_URL}/project/${hit.project_id}/versions?game_versions=${encodeURIComponent(JSON.stringify([mcVersion]))}`
  const versionsRes = await fetch(versionsUrl, { headers: { 'User-Agent': UA }, next: { revalidate: 0 } })

  if (!versionsRes.ok) {
    // Plugin exists on Modrinth but no release for this MC version
    return {
      name: hit.title,
      status: 'incompatible',
      latestVersion: null,
      supportedVersions: [],
      lastUpdate: null,
      isAbandoned: false,
      source: 'modrinth',
      url: `https://modrinth.com/project/${hit.slug}`,
      alternative: null,
      dependencies: [],
    }
  }

  const versions = await versionsRes.json() as Array<{
    version_number: string
    date_published: string
    game_versions: string[]
  }>

  const latest = versions[0]
  const allSupportedVersions = [...new Set(versions.flatMap((v) => v.game_versions))]

  return {
    name: hit.title,
    status: latest ? 'compatible' : 'incompatible',
    latestVersion: latest?.version_number ?? null,
    supportedVersions: allSupportedVersions,
    lastUpdate: latest?.date_published ?? null,
    isAbandoned: false,
    source: 'modrinth',
    url: `https://modrinth.com/project/${hit.slug}`,
    alternative: null,
    dependencies: [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/modrinth.ts
git commit -m "feat: add Modrinth API client"
```

---

### Task 10: hangar.ts

**Files:**
- Create: `src/lib/api/hangar.ts`

- [ ] **Step 1: Create Hangar API client**

```typescript
// src/lib/api/hangar.ts
import type { PluginResult, Platform } from '@/types'

const BASE_URL = 'https://hangar.papermc.io/api/v1'

// Hangar only hosts Paper-compatible plugins — Fabric/Forge are not supported here
const PLATFORM_MAP: Partial<Record<Platform, string>> = {
  paper: 'PAPER',
  spigot: 'PAPER',  // Spigot plugins usually run on Paper
  purpur: 'PAPER',  // Purpur is Paper-based
}

export async function searchHangar(
  name: string,
  mcVersion: string,
  platform: Platform
): Promise<PluginResult | null> {
  const hangarPlatform = PLATFORM_MAP[platform]
  if (!hangarPlatform) return null  // Fabric/Forge not on Hangar

  const searchUrl = `${BASE_URL}/projects?q=${encodeURIComponent(name)}&limit=5`
  const searchRes = await fetch(searchUrl, { next: { revalidate: 0 } })
  if (!searchRes.ok) return null

  const searchData = await searchRes.json() as {
    result: Array<{ name: string; namespace: { owner: string; slug: string } }>
  }

  const project =
    searchData.result.find((p) => p.name.toLowerCase() === name.toLowerCase()) ??
    searchData.result[0]
  if (!project) return null

  const { owner, slug } = project.namespace
  const versionsUrl = `${BASE_URL}/projects/${owner}/${slug}/versions?platform=${hangarPlatform}&platformVersion=${mcVersion}&limit=5`
  const versionsRes = await fetch(versionsUrl, { next: { revalidate: 0 } })

  if (!versionsRes.ok) {
    return {
      name: project.name,
      status: 'incompatible',
      latestVersion: null,
      supportedVersions: [],
      lastUpdate: null,
      isAbandoned: false,
      source: 'hangar',
      url: `https://hangar.papermc.io/${owner}/${slug}`,
      alternative: null,
      dependencies: [],
    }
  }

  const versionsData = await versionsRes.json() as {
    result: Array<{ name: string; createdAt: string }>
  }
  const latest = versionsData.result[0]

  return {
    name: project.name,
    status: latest ? 'compatible' : 'incompatible',
    latestVersion: latest?.name ?? null,
    supportedVersions: latest ? [mcVersion] : [],
    lastUpdate: latest?.createdAt ?? null,
    isAbandoned: false,
    source: 'hangar',
    url: `https://hangar.papermc.io/${owner}/${slug}`,
    alternative: null,
    dependencies: [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/hangar.ts
git commit -m "feat: add Hangar PaperMC API client"
```

---

### Task 11: spiget.ts

**Files:**
- Create: `src/lib/api/spiget.ts`

- [ ] **Step 1: Create Spiget API client**

```typescript
// src/lib/api/spiget.ts
import type { PluginResult, Platform } from '@/types'

const BASE_URL = 'https://api.spiget.org/v2'

// Spiget only indexes SpigotMC resources — Fabric/Forge are not supported
const SUPPORTED_PLATFORMS: Set<Platform> = new Set(['paper', 'spigot', 'purpur'])

// 18 months in seconds — threshold for considering a plugin abandoned
const ABANDONMENT_SECONDS = 18 * 30 * 24 * 60 * 60

export async function searchSpiget(
  name: string,
  mcVersion: string,
  platform: Platform
): Promise<PluginResult | null> {
  if (!SUPPORTED_PLATFORMS.has(platform)) return null

  const searchUrl = `${BASE_URL}/search/resources/${encodeURIComponent(name)}?field=name&size=5`
  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': 'PlugCheck/1.0' },
    next: { revalidate: 0 },
  })
  if (!searchRes.ok) return null

  const resources = await searchRes.json() as Array<{
    id: number
    name: string
    tag: string
    updateDate: number    // Unix timestamp in seconds
    external: boolean
  }>

  const resource =
    resources.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? resources[0]
  if (!resource) return null

  // Fetch latest version number
  const versionRes = await fetch(`${BASE_URL}/resources/${resource.id}/versions/latest`, {
    headers: { 'User-Agent': 'PlugCheck/1.0' },
    next: { revalidate: 0 },
  })
  const versionData = versionRes.ok
    ? (await versionRes.json() as { name: string })
    : null

  const lastUpdateIso = resource.updateDate
    ? new Date(resource.updateDate * 1000).toISOString()
    : null

  // Spiget updateDate is a Unix timestamp in seconds
  const isAbandoned = resource.updateDate
    ? Date.now() / 1000 - resource.updateDate > ABANDONMENT_SECONDS
    : false

  return {
    name: resource.name,
    // Spiget's free API doesn't provide per-version compatibility data — default compatible
    status: isAbandoned ? 'abandoned' : 'compatible',
    latestVersion: versionData?.name ?? null,
    supportedVersions: [],
    lastUpdate: lastUpdateIso,
    isAbandoned,
    source: 'spigot',
    url: `https://www.spigotmc.org/resources/${resource.id}/`,
    alternative: null,
    dependencies: [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/spiget.ts
git commit -m "feat: add Spiget SpigotMC API client"
```

---

### Task 12: github.ts

**Files:**
- Create: `src/lib/api/github.ts`

- [ ] **Step 1: Create GitHub abandonment checker**

```typescript
// src/lib/api/github.ts

// 18 months in milliseconds
const ABANDONMENT_THRESHOLD_MS = 18 * 30 * 24 * 60 * 60 * 1000

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

export async function checkGitHubAbandonment(repoUrl: string): Promise<boolean> {
  const parsed = parseGitHubUrl(repoUrl)
  if (!parsed) return false

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'PlugCheck/1.0',
  }
  // GITHUB_TOKEN is optional — without it, GitHub limits unauthenticated requests to 60/hour
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers, next: { revalidate: 0 } }
  )
  if (!res.ok) return false  // Can't determine — assume active

  const data = await res.json() as { archived: boolean; pushed_at: string | null }

  if (data.archived) return true

  if (data.pushed_at) {
    return Date.now() - new Date(data.pushed_at).getTime() > ABANDONMENT_THRESHOLD_MS
  }

  return false
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/github.ts
git commit -m "feat: add GitHub abandonment checker"
```

---

### Task 13: aggregator.ts (TDD)

**Files:**
- Create: `src/lib/__tests__/aggregator.test.ts`
- Create: `src/lib/api/aggregator.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/__tests__/aggregator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PluginInput, PluginResult } from '@/types'

vi.mock('../api/hangar')
vi.mock('../api/spiget')
vi.mock('../api/modrinth')
vi.mock('../api/github')

import * as hangar from '../api/hangar'
import * as spiget from '../api/spiget'
import * as modrinth from '../api/modrinth'
import * as github from '../api/github'
import { resolvePlugin } from '../api/aggregator'

const INPUT: PluginInput = {
  name: 'EssentialsX',
  version: '2.20.1',
  type: 'plugin',
  dependencies: ['Vault'],
  source: 'jar',
}

const MOCK_RESULT: PluginResult = {
  name: 'EssentialsX',
  status: 'compatible',
  latestVersion: '2.20.1',
  supportedVersions: ['1.21.4'],
  lastUpdate: '2024-01-01',
  isAbandoned: false,
  source: 'hangar',
  url: 'https://hangar.papermc.io/test/EssentialsX',
  alternative: null,
  dependencies: ['Vault'],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(github.checkGitHubAbandonment).mockResolvedValue(false)
})

describe('resolvePlugin', () => {
  it('tries Hangar first for Paper platform and returns its result', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(MOCK_RESULT)
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(hangar.searchHangar).toHaveBeenCalledOnce()
    expect(spiget.searchSpiget).not.toHaveBeenCalled()
    expect(result.source).toBe('hangar')
  })

  it('falls back to Spiget when Hangar returns null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue({ ...MOCK_RESULT, source: 'spigot' })
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(spiget.searchSpiget).toHaveBeenCalledOnce()
    expect(result.source).toBe('spigot')
  })

  it('falls back to Modrinth when Hangar and Spiget both return null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue(null)
    vi.mocked(modrinth.searchModrinth).mockResolvedValue({ ...MOCK_RESULT, source: 'modrinth' })
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(result.source).toBe('modrinth')
  })

  it('tries Modrinth first for Fabric platform', async () => {
    vi.mocked(modrinth.searchModrinth).mockResolvedValue({ ...MOCK_RESULT, source: 'modrinth' })
    const result = await resolvePlugin({ ...INPUT, type: 'mod' }, '1.21.4', 'fabric')
    expect(modrinth.searchModrinth).toHaveBeenCalledOnce()
    expect(hangar.searchHangar).not.toHaveBeenCalled()
    expect(result.source).toBe('modrinth')
  })

  it('returns status unknown when all sources return null', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(null)
    vi.mocked(spiget.searchSpiget).mockResolvedValue(null)
    vi.mocked(modrinth.searchModrinth).mockResolvedValue(null)
    const result = await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(result.status).toBe('unknown')
    expect(result.name).toBe('EssentialsX')
  })

  it('skips GitHub abandonment check when result has no GitHub URL', async () => {
    vi.mocked(hangar.searchHangar).mockResolvedValue(MOCK_RESULT) // Hangar URL, not GitHub
    await resolvePlugin(INPUT, '1.21.4', 'paper')
    expect(github.checkGitHubAbandonment).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/lib/__tests__/aggregator.test.ts
```

Expected: FAIL — `Cannot find module '../api/aggregator'`

- [ ] **Step 3: Implement aggregator.ts**

```typescript
// src/lib/api/aggregator.ts
import type { PluginInput, PluginResult, Platform } from '@/types'
import { searchModrinth } from './modrinth'
import { searchHangar } from './hangar'
import { searchSpiget } from './spiget'
import { checkGitHubAbandonment } from './github'

type ApiSource = 'hangar' | 'spiget' | 'modrinth'

// Priority order determines which API is tried first — best data source wins
// Paper: Hangar (official PaperMC repo) → Spiget (largest catalog) → Modrinth
// Fabric/Forge: Modrinth (best mod coverage) only
const PLATFORM_PRIORITY: Record<Platform, ApiSource[]> = {
  paper:  ['hangar', 'spiget', 'modrinth'],
  spigot: ['spiget', 'hangar', 'modrinth'],
  purpur: ['hangar', 'spiget', 'modrinth'],
  fabric: ['modrinth'],
  forge:  ['modrinth'],
}

const API_HANDLERS: Record<
  ApiSource,
  (name: string, mcVersion: string, platform: Platform) => Promise<PluginResult | null>
> = {
  hangar:   searchHangar,
  spiget:   searchSpiget,
  modrinth: searchModrinth,
}

export async function resolvePlugin(
  plugin: PluginInput,
  mcVersion: string,
  platform: Platform
): Promise<PluginResult> {
  const priority = PLATFORM_PRIORITY[platform]

  for (const source of priority) {
    try {
      const result = await API_HANDLERS[source](plugin.name, mcVersion, platform)
      if (!result) continue

      // GitHub abandonment check supplements API data when result has a GitHub source URL
      if (result.url?.includes('github.com') && !result.isAbandoned) {
        const isAbandoned = await checkGitHubAbandonment(result.url).catch(() => false)
        return { ...result, isAbandoned, status: isAbandoned ? 'abandoned' : result.status }
      }
      return result
    } catch {
      // Continue to next source — one failing API shouldn't block the others
    }
  }

  // No source returned data — unknown is better than crashing
  return {
    name: plugin.name,
    status: 'unknown',
    latestVersion: null,
    supportedVersions: [],
    lastUpdate: null,
    isAbandoned: false,
    source: 'modrinth',
    url: null,
    alternative: null,
    dependencies: plugin.dependencies,
  }
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/lib/__tests__/aggregator.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/aggregator.ts src/lib/__tests__/aggregator.test.ts
git commit -m "feat: add API aggregator with platform priority (TDD)"
```

---

### Task 14: conflict-detector.ts (TDD)

**Files:**
- Create: `src/lib/__tests__/conflict-detector.test.ts`
- Create: `src/lib/conflict-detector.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/__tests__/conflict-detector.test.ts
import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../conflict-detector'
import type { PluginResult } from '@/types'

function makeResult(
  name: string,
  status: PluginResult['status'] = 'compatible',
  dependencies: string[] = []
): PluginResult {
  return {
    name,
    status,
    latestVersion: '1.0.0',
    supportedVersions: ['1.21.4'],
    lastUpdate: '2024-01-01',
    isAbandoned: false,
    source: 'modrinth',
    url: null,
    alternative: null,
    dependencies,
  }
}

describe('detectConflicts — Level 1: Known pairs', () => {
  it('detects EssentialsX + CMI as an error conflict', () => {
    const results = [makeResult('EssentialsX'), makeResult('CMI')]
    const conflicts = detectConflicts(results)
    const known = conflicts.find((c) => c.type === 'known')
    expect(known).toBeDefined()
    expect(known?.severity).toBe('error')
    expect(known?.plugins).toContain('EssentialsX')
    expect(known?.plugins).toContain('CMI')
  })

  it('is case-insensitive for plugin name matching', () => {
    const results = [makeResult('essentialsx'), makeResult('cmi')]
    const conflicts = detectConflicts(results)
    expect(conflicts.some((c) => c.type === 'known')).toBe(true)
  })

  it('does not flag plugins that are not in any conflict pair', () => {
    const results = [makeResult('SomeRandomPlugin'), makeResult('AnotherPlugin')]
    const known = detectConflicts(results).filter((c) => c.type === 'known')
    expect(known).toHaveLength(0)
  })
})

describe('detectConflicts — Level 2: Dependency on incompatible plugin', () => {
  it('flags an error when plugin requires an incompatible dependency', () => {
    const results = [
      makeResult('EssentialsX', 'compatible', ['Vault']),
      makeResult('Vault', 'incompatible'),
    ]
    const conflicts = detectConflicts(results)
    const depError = conflicts.find((c) => c.type === 'dependency' && c.severity === 'error')
    expect(depError).toBeDefined()
    expect(depError?.plugins).toContain('EssentialsX')
    expect(depError?.plugins).toContain('Vault')
  })
})

describe('detectConflicts — Level 3: Missing dependencies', () => {
  it('warns when a hard dependency is not in the checked list', () => {
    const results = [makeResult('EssentialsX', 'compatible', ['Vault'])]
    const conflicts = detectConflicts(results)
    const warning = conflicts.find((c) => c.type === 'dependency' && c.severity === 'warning')
    expect(warning).toBeDefined()
    expect(warning?.plugins).toContain('Vault')
  })

  it('does not warn about deps that ARE in the checked list', () => {
    const results = [
      makeResult('EssentialsX', 'compatible', ['Vault']),
      makeResult('Vault', 'compatible'),
    ]
    const warnings = detectConflicts(results).filter(
      (c) => c.type === 'dependency' && c.severity === 'warning'
    )
    expect(warnings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/lib/__tests__/conflict-detector.test.ts
```

Expected: FAIL — `Cannot find module '../conflict-detector'`

- [ ] **Step 3: Implement conflict-detector.ts**

```typescript
// src/lib/conflict-detector.ts
import type { PluginResult, ConflictResult } from '@/types'
import knownConflictsData from '@/data/known-conflicts.json'

interface KnownConflict {
  plugins: string[]
  severity: 'error' | 'warning'
  reason: string
}

const knownConflicts = knownConflictsData as KnownConflict[]

function normalize(name: string): string {
  return name.toLowerCase().trim()
}

export function detectConflicts(results: PluginResult[]): ConflictResult[] {
  const conflicts: ConflictResult[] = []
  const presentNames = new Set(results.map((r) => normalize(r.name)))

  // Level 1: Check every known conflict pair — if all plugins in the pair are present, it's a conflict
  for (const conflict of knownConflicts) {
    if (conflict.plugins.every((p) => presentNames.has(normalize(p)))) {
      conflicts.push({
        type: 'known',
        plugins: conflict.plugins,
        severity: conflict.severity,
        reason: conflict.reason,
      })
    }
  }

  // Level 2 & 3: Walk each plugin's dependency list
  for (const plugin of results) {
    for (const dep of plugin.dependencies) {
      const depResult = results.find((r) => normalize(r.name) === normalize(dep))

      if (depResult) {
        // Level 2: Dependency exists but is incompatible — this will likely crash the server
        if (depResult.status === 'incompatible') {
          conflicts.push({
            type: 'dependency',
            plugins: [plugin.name, dep],
            severity: 'error',
            reason: `${plugin.name} requires ${dep}, but ${dep} is incompatible with the selected Minecraft version`,
          })
        }
      } else {
        // Level 3: Dependency not in the checked list — may or may not be installed
        conflicts.push({
          type: 'dependency',
          plugins: [plugin.name, dep],
          severity: 'warning',
          reason: `${plugin.name} depends on ${dep}, which is not in your checked list`,
        })
      }
    }
  }

  return conflicts
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/lib/__tests__/conflict-detector.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
pnpm test:run
```

Expected: all tests PASS (jar-parser + aggregator + conflict-detector)

- [ ] **Step 6: Commit**

```bash
git add src/lib/conflict-detector.ts src/lib/__tests__/conflict-detector.test.ts
git commit -m "feat: add conflict detector with 3-level detection (TDD)"
```

---

## Phase 3 — API Routes

### Task 15: POST /api/check

**Files:**
- Create: `src/app/api/check/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { resolvePlugin } from '@/lib/api/aggregator'
import { detectConflicts } from '@/lib/conflict-detector'
import { getCached, setCached, buildCacheKey } from '@/lib/cache'
import type { PluginResult, CheckResponse, Platform } from '@/types'

// Node.js runtime required — we use process.env and fs-adjacent operations
export const runtime = 'nodejs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 10 requests per IP per minute — prevents abuse without blocking legitimate users
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: false,
})

const PluginInputSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().nullable(),
  type: z.enum(['plugin', 'mod']),
  dependencies: z.array(z.string()),
  source: z.enum(['jar', 'manual']),
})

const CheckRequestSchema = z.object({
  plugins: z.array(PluginInputSchema).min(1).max(100),
  mcVersion: z.string().min(1),
  platform: z.enum(['paper', 'spigot', 'fabric', 'forge', 'purpur']),
})

function errorJson(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status })
}

export async function POST(req: NextRequest) {
  // Rate limit by IP — x-forwarded-for is set by Vercel's edge network
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success, reset } = await ratelimit.limit(ip)
  if (!success) {
    return errorJson('RATE_LIMITED', 'Too many requests. Please wait a minute.', 429)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorJson('INVALID_REQUEST', 'Request body must be valid JSON', 400)
  }

  const parsed = CheckRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorJson('INVALID_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid request', 400)
  }

  const { plugins, mcVersion, platform } = parsed.data

  // Resolve all plugins in parallel — each goes cache → API → cache
  let results: PluginResult[]
  try {
    results = await Promise.all(
      plugins.map(async (plugin) => {
        const key = buildCacheKey(plugin.name, mcVersion, platform)
        const cached = await getCached<PluginResult>(key)
        if (cached) return cached

        const result = await resolvePlugin(plugin, mcVersion, platform as Platform)
        await setCached(key, result, 6 * 60 * 60)  // 6 hour TTL
        return result
      })
    )
  } catch {
    return errorJson('UPSTREAM_ERROR', 'External APIs are temporarily unavailable', 502)
  }

  const conflicts = detectConflicts(results)

  const response: CheckResponse = {
    results,
    conflicts,
    summary: {
      total:        results.length,
      compatible:   results.filter((r) => r.status === 'compatible').length,
      incompatible: results.filter((r) => r.status === 'incompatible').length,
      abandoned:    results.filter((r) => r.isAbandoned).length,
      unknown:      results.filter((r) => r.status === 'unknown').length,
      conflicts:    conflicts.length,
    },
    mcVersion,
    platform: platform as Platform,
    checkedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/check/route.ts
git commit -m "feat: add POST /api/check with rate limiting and caching"
```

---

### Task 16: GET /api/search

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getCached, setCached } from '@/lib/cache'

export const runtime = 'nodejs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success } = await ratelimit.limit(`search:${ip}`)
  if (!success) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const platform = searchParams.get('platform') ?? 'paper'

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

  await setCached(cacheKey, deduped, 60 * 60)  // 1 hour — search results change slowly
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: add GET /api/search autocomplete with rate limiting"
```

---

## Phase 4 — UI Components

### Task 17: StatusBadge + PluginRow + ResultsTable

**Files:**
- Create: `src/components/results/StatusBadge.tsx`
- Create: `src/components/results/PluginRow.tsx`
- Create: `src/components/results/ResultsTable.tsx`

- [ ] **Step 1: Create StatusBadge.tsx**

```tsx
// src/components/results/StatusBadge.tsx
import type { PluginStatus } from '@/types'

type BadgeVariant = PluginStatus | 'alternative'

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; label: string }> = {
  compatible:   { bg: '#DCFCE7', color: '#15803D', label: 'Compatible' },
  incompatible: { bg: '#FEE2E2', color: '#B91C1C', label: 'Incompatible' },
  abandoned:    { bg: '#FEF3C7', color: '#B45309', label: 'Abandoned' },
  alternative:  { bg: '#EDE9FE', color: '#5B21B6', label: 'Has Alternative' },
  unknown:      { bg: '#F1F5F9', color: '#475569', label: 'Unknown' },
}

interface StatusBadgeProps {
  status: PluginStatus
  hasAlternative?: boolean
}

export function StatusBadge({ status, hasAlternative }: StatusBadgeProps) {
  // Show "Has Alternative" badge when an abandoned plugin has a suggested replacement
  const variant: BadgeVariant = hasAlternative ? 'alternative' : status
  const { bg, color, label } = BADGE_STYLES[variant]

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Create PluginRow.tsx**

```tsx
// src/components/results/PluginRow.tsx
import type { PluginResult } from '@/types'
import { StatusBadge } from './StatusBadge'

interface PluginRowProps {
  result: PluginResult
  isAlternate: boolean  // alternating row background for readability
}

export function PluginRow({ result, isAlternate }: PluginRowProps) {
  return (
    <tr style={{ backgroundColor: isAlternate ? 'var(--color-muted)' : 'var(--color-surface)' }}>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {/* JetBrains Mono for plugin names — makes them visually distinct from prose */}
          <span className="font-mono text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            {result.name}
          </span>
          {result.alternative && (
            <a
              href={result.alternative.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: 'var(--color-secondary)' }}
            >
              → Try {result.alternative.name}
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs" style={{ color: 'var(--color-muted-fg)' }}>
          {result.latestVersion ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={result.status} hasAlternative={!!result.alternative} />
      </td>
      <td className="px-4 py-3">
        {result.url ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline transition-all duration-150 ease-out"
            style={{ color: 'var(--color-secondary)' }}
          >
            View →
          </a>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>—</span>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 3: Create ResultsTable.tsx**

```tsx
// src/components/results/ResultsTable.tsx
import type { PluginResult } from '@/types'
import { PluginRow } from './PluginRow'

interface ResultsTableProps {
  results: PluginResult[]
}

export function ResultsTable({ results }: ResultsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-muted)' }}>
          <tr>
            {['Plugin', 'Latest Version', 'Status', 'Link'].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-muted-fg)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
          {results.map((result, i) => (
            <PluginRow key={result.name} result={result} isAlternate={i % 2 !== 0} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/results/StatusBadge.tsx src/components/results/PluginRow.tsx src/components/results/ResultsTable.tsx
git commit -m "feat: add StatusBadge, PluginRow, ResultsTable components"
```

---

### Task 18: ConflictCard + SummaryBar + ExportButton + ResultsPanel

**Files:**
- Create: `src/components/results/ConflictCard.tsx`
- Create: `src/components/results/SummaryBar.tsx`
- Create: `src/components/results/ExportButton.tsx`
- Create: `src/components/results/ResultsPanel.tsx`

- [ ] **Step 1: Create ConflictCard.tsx**

```tsx
// src/components/results/ConflictCard.tsx
import type { ConflictResult } from '@/types'

interface ConflictCardProps {
  conflicts: ConflictResult[]
}

export function ConflictCard({ conflicts }: ConflictCardProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: '#92400E' }}>
        ⚡ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
      </h3>
      <ul className="space-y-2">
        {conflicts.map((conflict, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#78350F' }}>
            {/* Error = almost certainly breaks server, warning = possible issue */}
            <span className="mt-0.5 shrink-0">
              {conflict.severity === 'error' ? '🔴' : '🟡'}
            </span>
            <div>
              <span className="font-mono font-medium">{conflict.plugins.join(' + ')}</span>
              <span style={{ color: '#92400E' }}> — {conflict.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Create SummaryBar.tsx**

```tsx
// src/components/results/SummaryBar.tsx
import type { CheckResponse } from '@/types'

interface SummaryBarProps {
  summary: CheckResponse['summary']
}

const SUMMARY_ITEMS = [
  { key: 'compatible'   as const, label: 'Compatible',   icon: '✅', color: '#15803D' },
  { key: 'incompatible' as const, label: 'Incompatible', icon: '❌', color: '#B91C1C' },
  { key: 'abandoned'    as const, label: 'Abandoned',    icon: '⚠️', color: '#B45309' },
  { key: 'conflicts'    as const, label: 'Conflicts',    icon: '⚡', color: '#C2410C' },
]

export function SummaryBar({ summary }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SUMMARY_ITEMS.map(({ key, label, icon, color }) => (
        <div
          key={key}
          className="rounded-lg p-3 text-center shadow-sm"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
            {summary[key]}
          </div>
          <div className="mt-0.5 text-xs font-medium" style={{ color }}>
            {icon} {label}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create ExportButton.tsx**

```tsx
// src/components/results/ExportButton.tsx
'use client'
import type { CheckResponse } from '@/types'

interface ExportButtonProps {
  data: CheckResponse
}

function buildCsv(data: CheckResponse): string {
  const headers = ['Plugin', 'Status', 'Latest Version', 'Source', 'URL', 'Abandoned']
  const rows = data.results.map((r) => [
    r.name,
    r.status,
    r.latestVersion ?? '',
    r.source,
    r.url ?? '',
    r.isAbandoned ? 'Yes' : 'No',
  ])
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function ExportButton({ data }: ExportButtonProps) {
  function handleExport() {
    const csv = buildCsv(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `plugcheck-${data.platform}-${data.mcVersion}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ease-out"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-foreground)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface)')}
    >
      Export CSV
    </button>
  )
}
```

- [ ] **Step 4: Create ResultsPanel.tsx**

```tsx
// src/components/results/ResultsPanel.tsx
import type { CheckResponse } from '@/types'
import { SummaryBar } from './SummaryBar'
import { ConflictCard } from './ConflictCard'
import { ResultsTable } from './ResultsTable'
import { ExportButton } from './ExportButton'

interface ResultsPanelProps {
  data: CheckResponse
}

export function ResultsPanel({ data }: ResultsPanelProps) {
  return (
    // animate-in requires shadcn's tailwind-animate plugin — already installed via shadcn init
    <div className="animate-in fade-in-0 slide-in-from-bottom-4 mt-6 space-y-4 duration-300">
      <SummaryBar summary={data.summary} />
      <ConflictCard conflicts={data.conflicts} />
      <ResultsTable results={data.results} />
      <div className="flex justify-end">
        <ExportButton data={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/results/
git commit -m "feat: add ConflictCard, SummaryBar, ExportButton, ResultsPanel"
```

---

### Task 19: Checker input components

**Files:**
- Create: `src/components/checker/VersionSelector.tsx`
- Create: `src/components/checker/PlatformTabs.tsx`
- Create: `src/components/checker/CheckButton.tsx`

- [ ] **Step 1: Create VersionSelector.tsx**

```tsx
// src/components/checker/VersionSelector.tsx
'use client'
import mcVersions from '@/data/mc-versions.json'

interface VersionSelectorProps {
  value: string
  onChange: (version: string) => void
}

export function VersionSelector({ value, onChange }: VersionSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: 'var(--color-foreground)' }}
      >
        Minecraft Version
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out focus:outline-none"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-foreground)',
        }}
      >
        {(mcVersions as string[]).map((version) => (
          <option key={version} value={version}>
            {version}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Create PlatformTabs.tsx**

```tsx
// src/components/checker/PlatformTabs.tsx
'use client'
import type { Platform } from '@/types'

const TABS: Array<{ value: Platform; label: string }> = [
  { value: 'paper',  label: 'Paper / Spigot' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge',  label: 'Forge' },
]

interface PlatformTabsProps {
  value: Platform
  onChange: (platform: Platform) => void
}

export function PlatformTabs({ value, onChange }: PlatformTabsProps) {
  return (
    <div
      className="flex gap-1 rounded-lg p-1"
      style={{ backgroundColor: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
    >
      {TABS.map((tab) => {
        const isActive = value === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ease-out"
            style={{
              backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
              color: isActive ? 'var(--color-foreground)' : 'var(--color-muted-fg)',
              boxShadow: isActive ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create CheckButton.tsx**

```tsx
// src/components/checker/CheckButton.tsx
'use client'

interface CheckButtonProps {
  onClick: () => void
  isLoading: boolean
  disabled: boolean
}

export function CheckButton({ onClick, isLoading, disabled }: CheckButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
      }}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Checking...
        </span>
      ) : (
        'Check Compatibility'
      )}
    </button>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/checker/VersionSelector.tsx src/components/checker/PlatformTabs.tsx src/components/checker/CheckButton.tsx
git commit -m "feat: add VersionSelector, PlatformTabs, CheckButton components"
```

---

### Task 20: DropZone

**Files:**
- Create: `src/components/checker/DropZone.tsx`

- [ ] **Step 1: Create DropZone.tsx**

```tsx
// src/components/checker/DropZone.tsx
'use client'
import { useState, useRef, type DragEvent } from 'react'
import type { PluginInput } from '@/types'

interface DropZoneProps {
  onPluginsAdded: (plugins: PluginInput[]) => void
}

export function DropZone({ onPluginsAdded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadedFileNames, setLoadedFileNames] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const jarFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.jar'))
    if (jarFiles.length === 0) return

    setIsProcessing(true)
    setLoadedFileNames(jarFiles.map((f) => f.name))

    try {
      // Dynamic import — JSZip (~100KB) is only loaded when the user actually drops JARs
      const { parseJarFiles } = await import('@/lib/jar-parser')
      const plugins = await parseJarFiles(jarFiles)
      onPluginsAdded(plugins)
    } catch {
      setLoadedFileNames([])
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear drag state when leaving the drop zone itself, not its children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer rounded-xl p-8 text-center transition-all duration-150 ease-out"
      style={{
        border: isDragging
          ? '2px dashed var(--color-primary)'
          : '2px dashed var(--color-border)',
        backgroundColor: isDragging ? '#F0FDF4' : 'var(--color-surface)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jar"
        multiple
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
      />
      {isProcessing ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-fg)' }}>
          Parsing JAR files...
        </p>
      ) : loadedFileNames.length > 0 ? (
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            {loadedFileNames.length} JAR{loadedFileNames.length !== 1 ? 's' : ''} loaded
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-fg)' }}>
            {loadedFileNames.slice(0, 3).join(', ')}{loadedFileNames.length > 3 ? ` +${loadedFileNames.length - 3} more` : ''}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            Drop .jar files here
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-fg)' }}>
            or click to browse — files are parsed locally and never uploaded
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/checker/DropZone.tsx
git commit -m "feat: add DropZone with client-side JAR parsing"
```

---

### Task 21: PluginNameInput

**Files:**
- Create: `src/components/checker/PluginNameInput.tsx`

- [ ] **Step 1: Create PluginNameInput.tsx**

```tsx
// src/components/checker/PluginNameInput.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { PluginInput, Platform } from '@/types'

interface PluginNameInputProps {
  onPluginsChange: (plugins: PluginInput[]) => void
  platform: Platform
}

// Each non-empty line becomes one PluginInput
function parseTextToPlugins(text: string): PluginInput[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      version: null,
      type: 'plugin' as const,
      dependencies: [],
      source: 'manual' as const,
    }))
}

export function PluginNameInput({ onPluginsChange, platform }: PluginNameInputProps) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; source: string }>>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable reference — prevents DropZone re-renders when text changes
  const stableOnChange = useCallback(onPluginsChange, [])

  useEffect(() => {
    stableOnChange(parseTextToPlugins(text))
  }, [text, stableOnChange])

  function handleChange(value: string) {
    setText(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const lastLine = value.split('\n').pop()?.trim() ?? ''
    if (lastLine.length < 2) {
      setSuggestions([])
      return
    }

    // 400ms debounce — balances responsiveness vs. API call volume
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(lastLine)}&platform=${platform}`)
        if (!res.ok) return
        const data = await res.json() as { suggestions: Array<{ name: string; source: string }> }
        setSuggestions(data.suggestions ?? [])
      } catch {
        // Autocomplete is non-critical — silently fail
      }
    }, 400)
  }

  function applySuggestion(name: string) {
    const lines = text.split('\n')
    lines[lines.length - 1] = name
    setText(lines.join('\n') + '\n')
    setSuggestions([])
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
        Plugin names <span style={{ color: 'var(--color-muted-fg)', fontWeight: 400 }}>(one per line)</span>
      </label>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={'EssentialsX\nWorldGuard\nVault\n...'}
        rows={5}
        className="resize-none rounded-lg px-3 py-2 font-mono text-sm transition-all duration-150 ease-out focus:outline-none"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-foreground)',
        }}
        onFocus={(e) => (e.target.style.outline = `2px solid var(--color-ring)`)}
        onBlur={(e) => {
          e.target.style.outline = 'none'
          setTimeout(() => setSuggestions([]), 200)
        }}
      />
      {suggestions.length > 0 && (
        <ul
          className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg shadow-sm"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          {suggestions.map((s) => (
            <li
              key={s.name}
              onMouseDown={() => applySuggestion(s.name)}
              className="cursor-pointer px-3 py-2 text-sm transition-all duration-150 ease-out"
              style={{ color: 'var(--color-foreground)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s.name}
              <span className="ml-2 text-xs" style={{ color: 'var(--color-muted-fg)' }}>
                {s.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/checker/PluginNameInput.tsx
git commit -m "feat: add PluginNameInput with debounced autocomplete"
```

---

### Task 22: CheckerSection (state hub)

**Files:**
- Create: `src/components/checker/CheckerSection.tsx`

- [ ] **Step 1: Create CheckerSection.tsx**

```tsx
// src/components/checker/CheckerSection.tsx
'use client'
import { useState, useCallback } from 'react'
import type { Platform, PluginInput, CheckResponse } from '@/types'
import { PlatformTabs } from './PlatformTabs'
import { VersionSelector } from './VersionSelector'
import { DropZone } from './DropZone'
import { PluginNameInput } from './PluginNameInput'
import { CheckButton } from './CheckButton'
import { ResultsPanel } from '@/components/results/ResultsPanel'

// CheckerSection is the single "use client" boundary for the entire tool.
// All interactive state lives here — child components receive only what they need.
export function CheckerSection() {
  const [platform, setPlatform] = useState<Platform>('paper')
  const [mcVersion, setMcVersion] = useState('1.21.4')
  const [jarPlugins, setJarPlugins] = useState<PluginInput[]>([])
  const [manualPlugins, setManualPlugins] = useState<PluginInput[]>([])
  const [results, setResults] = useState<CheckResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // useCallback prevents DropZone and PluginNameInput from re-rendering on every parent state change
  const handleJarPlugins = useCallback((plugins: PluginInput[]) => setJarPlugins(plugins), [])
  const handleManualPlugins = useCallback((plugins: PluginInput[]) => setManualPlugins(plugins), [])

  // Merge both sources — JAR-parsed plugins take precedence (they have version info)
  const allPlugins = [
    ...jarPlugins,
    ...manualPlugins.filter(
      (m) => !jarPlugins.some((j) => j.name.toLowerCase() === m.name.toLowerCase())
    ),
  ]

  // handleCheck is triggered by user action (button click), never by useEffect
  async function handleCheck() {
    if (allPlugins.length === 0) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugins: allPlugins, mcVersion, platform }),
      })

      if (!res.ok) {
        const body = await res.json() as { message?: string }
        setError(body.message ?? 'Something went wrong. Please try again.')
        return
      }

      setResults(await res.json() as CheckResponse)
    } catch {
      setError('Could not connect to the server. Check your internet connection.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="space-y-4">
          <PlatformTabs value={platform} onChange={setPlatform} />
          <VersionSelector value={mcVersion} onChange={setMcVersion} />
          <DropZone onPluginsAdded={handleJarPlugins} />

          <div className="flex items-center gap-3">
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
            <span className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>or type names</span>
            <div className="flex-1" style={{ borderTop: '1px solid var(--color-border)' }} />
          </div>

          <PluginNameInput onPluginsChange={handleManualPlugins} platform={platform} />

          {error && (
            <p
              className="rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: '#FEF2F2', color: 'var(--color-destructive)' }}
            >
              {error}
            </p>
          )}

          {allPlugins.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>
              {allPlugins.length} plugin{allPlugins.length !== 1 ? 's' : ''} ready to check
            </p>
          )}

          <CheckButton
            onClick={handleCheck}
            isLoading={isLoading}
            disabled={allPlugins.length === 0}
          />
        </div>
      </div>

      {results && <ResultsPanel data={results} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/checker/CheckerSection.tsx
git commit -m "feat: add CheckerSection as central state hub"
```

---

### Task 23: Shared components + page + layout

**Files:**
- Create: `src/components/shared/Navbar.tsx`
- Create: `src/components/shared/Footer.tsx`
- Create: `src/components/shared/HowItWorks.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Navbar.tsx**

```tsx
// src/components/shared/Navbar.tsx
export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-10"
      style={{
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold" style={{ color: 'var(--color-foreground)' }}>
          PlugCheck
        </span>
        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className="text-sm transition-all duration-150 ease-out"
            style={{ color: 'var(--color-muted-fg)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-foreground)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-fg)')}
          >
            How it works
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-all duration-150 ease-out"
            style={{ color: 'var(--color-muted-fg)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-foreground)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-fg)')}
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create Footer.tsx**

```tsx
// src/components/shared/Footer.tsx
export function Footer() {
  return (
    <footer
      className="mt-16"
      style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 text-center">
        <p className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>
          Data from{' '}
          {[
            { label: 'Modrinth', href: 'https://modrinth.com' },
            { label: 'SpigotMC', href: 'https://www.spigotmc.org' },
            { label: 'Hangar', href: 'https://hangar.papermc.io' },
            { label: 'GitHub', href: 'https://github.com' },
          ].map(({ label, href }, i, arr) => (
            <span key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-all duration-150 ease-out"
                style={{ color: 'var(--color-muted-fg)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-foreground)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-fg)')}
              >
                {label}
              </a>
              {i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
          {' '}&mdash; not affiliated with Mojang, PaperMC, or SpigotMC.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Create HowItWorks.tsx**

```tsx
// src/components/shared/HowItWorks.tsx
const STEPS = [
  {
    icon: '📦',
    title: 'Upload or type',
    description:
      'Drop your .jar files or paste plugin names. JAR files are read entirely in your browser — nothing is uploaded to a server.',
  },
  {
    icon: '🔍',
    title: 'We check the sources',
    description:
      'PlugCheck queries Hangar, SpigotMC, and Modrinth in parallel to find compatibility data for your target Minecraft version.',
  },
  {
    icon: '📊',
    title: 'Get your report',
    description:
      'Seconds later, see which plugins are compatible, incompatible, or abandoned — plus detected conflicts between them.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-3xl px-4 py-16">
      <h2
        className="mb-10 text-center text-2xl font-semibold"
        style={{ color: 'var(--color-foreground)' }}
      >
        How it works
      </h2>
      <div className="grid gap-8 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: 'var(--color-muted)' }}
            >
              {step.icon}
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {step.title}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-fg)' }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Replace page.tsx**

```tsx
// src/app/page.tsx
import { Navbar } from '@/components/shared/Navbar'
import { HowItWorks } from '@/components/shared/HowItWorks'
import { Footer } from '@/components/shared/Footer'
import { CheckerSection } from '@/components/checker/CheckerSection'

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="px-4 py-16 text-center">
          <h1
            className="mx-auto max-w-2xl text-4xl font-bold leading-tight sm:text-5xl"
            style={{ color: 'var(--color-foreground)' }}
          >
            Which of your plugins survive the update?
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl text-base"
            style={{ color: 'var(--color-muted-fg)' }}
          >
            Upload your .jar files or paste a plugin list. Get a full compatibility report in seconds — no login required.
          </p>
        </section>

        {/* Checker */}
        <section className="px-4 pb-16">
          <CheckerSection />
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 5: Replace layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'PlugCheck — Verify Minecraft Plugin Compatibility',
  description:
    'Upload your .jar files or paste your plugin list. Find out in seconds which plugins are compatible with your target Minecraft version.',
  openGraph: {
    title: 'PlugCheck — Verify Minecraft Plugin Compatibility',
    description:
      'Check plugin compatibility, detect conflicts, and find alternatives. No login required.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PlugCheck — Verify Minecraft Plugin Compatibility',
    description: 'Check plugin compatibility in seconds. No login required.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

Expected: build succeeds with no TypeScript errors. There may be warnings about missing env vars (Upstash) — that's expected in build without .env.local.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/ src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add shared components, page, layout — UI complete"
```

---

## Phase 5 — Production

### Task 24: OG image placeholder + .env.local

**Files:**
- Create: `public/og-image.png` (placeholder)
- Create: `.env.local` (from .env.example, filled in by developer)

- [ ] **Step 1: Create a placeholder OG image**

Create a 1200×630 PNG file at `public/og-image.png`. For MVP, this can be a simple image created with any tool. It should show:
- Product name: "PlugCheck"
- Tagline: "Verify Minecraft plugin compatibility instantly"
- Background: `#16A34A` (primary green) or `#F8FAFC`

Use any image editor, or generate with this HTML saved as an SVG then converted:
```html
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F8FAFC"/>
  <text x="600" y="280" font-family="sans-serif" font-size="72" font-weight="700" fill="#0F172A" text-anchor="middle">PlugCheck</text>
  <text x="600" y="370" font-family="sans-serif" font-size="32" fill="#64748B" text-anchor="middle">Verify Minecraft plugin compatibility instantly</text>
</svg>
```

- [ ] **Step 2: Create .env.local**

Copy `.env.example` to `.env.local` and fill in real values:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
# GITHUB_TOKEN=your_github_pat  # optional
```

Get values from: console.upstash.com → create a Redis database → REST API tab

- [ ] **Step 3: Test locally with real credentials**

```bash
pnpm dev
```

Open http://localhost:3000. Type "EssentialsX" in the plugin name field, select Paper, MC 1.21.4, click Check.

Expected: results appear within 10 seconds showing EssentialsX as compatible or unknown.

- [ ] **Step 4: Commit (exclude .env.local)**

```bash
# Verify .env.local is in .gitignore (create-next-app adds it automatically)
grep ".env.local" .gitignore

git add public/og-image.png
git commit -m "feat: add OG image placeholder"
```

---

### Task 25: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

Create a new repository at github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/plugcheck.git
git push -u origin main
```

- [ ] **Step 2: Connect to Vercel**

Go to vercel.com → New Project → Import from GitHub → select `plugcheck` repo

Settings:
- Framework preset: Next.js (auto-detected)
- Root directory: `.` (default)
- Build command: `pnpm build` (or leave as default)

- [ ] **Step 3: Add environment variables in Vercel dashboard**

In Project Settings → Environment Variables, add:
- `UPSTASH_REDIS_REST_URL` → your URL
- `UPSTASH_REDIS_REST_TOKEN` → your token
- `GITHUB_TOKEN` → your PAT (optional)

- [ ] **Step 4: Deploy**

Click Deploy in Vercel. Wait for build to complete (~2 minutes).

Expected: deployment URL like `plugcheck.vercel.app`

---

### Task 26: Smoke test

- [ ] **Step 1: Test JAR upload**

Go to the deployed URL. Drop 3 real Paper plugin JARs into the drop zone. Click Check.

Expected: results appear in < 10 seconds, table shows plugin names, statuses, and links.

- [ ] **Step 2: Test name input with Fabric**

Switch to Fabric tab. Type in the textarea:
```
fabric-api
sodium
lithium
```

Click Check.

Expected: Modrinth is queried, results show as compatible or incompatible for current MC version.

- [ ] **Step 3: Test conflict detection**

Switch back to Paper. In the textarea, type:
```
EssentialsX
CMI
```

Click Check.

Expected: ConflictCard appears with amber background showing "EssentialsX + CMI — Both provide /home, /spawn..."

- [ ] **Step 4: Test rate limiting**

Make 11 POST requests to `/api/check` within 1 minute (use browser dev tools or curl).

Expected: 11th request returns HTTP 429 with `{ "error": "RATE_LIMITED", "message": "..." }`

- [ ] **Step 5: Test OG image**

Paste the deployed URL into https://cards.twitter.com/validator

Expected: OG image appears correctly (1200×630), title and description show.

- [ ] **Step 6: Run full test suite one final time**

```bash
pnpm test:run
```

Expected: all tests PASS

---

## Verification

**Local smoke test:**
1. `pnpm dev` → open localhost:3000
2. Drop a JAR → click Check → results appear
3. Type plugin names → click Check → results appear
4. Type "EssentialsX" + "CMI" → conflict card visible
5. `pnpm test:run` → all pass
6. `pnpm build` → no errors

**Post-deploy:**
1. Deployed URL loads in < 2s
2. API requests go through (check Vercel function logs)
3. Second check for same plugins is faster (Redis cache hit)
4. Rate limit fires on 11th request

**Architecture documentation (included in this project):**
- `docs/superpowers/specs/2026-04-29-plugcheck-design.md` — full architecture doc with data flow diagram, design decisions, and component hierarchy
- Inline code comments explain the WHY throughout all lib/ files and CheckerSection.tsx
