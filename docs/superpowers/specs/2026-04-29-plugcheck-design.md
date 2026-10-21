# PlugCheck — Design Document

> Spec generado: 2026-04-29
> Blueprint original: 2026-04-28 (The Architect)
> Decisiones adicionales: documentación dual (arquitectura + código comentado), build por fases con checkpoints

---

## 1. Qué es PlugCheck

PlugCheck es una herramienta web pública, sin login, que resuelve un problema real y frecuente: cada vez que Mojang lanza una nueva versión de Minecraft, los administradores de servidores deben revisar manualmente si cada uno de sus plugins sigue siendo compatible. Con 20, 50, o 100 plugins, eso es horas de trabajo.

**PlugCheck lo hace en segundos:**
- Sube archivos `.jar` directamente (se parsean en el browser, nunca en el servidor)
- O pega una lista de nombres de plugins/mods
- Selecciona la versión objetivo de Minecraft
- Obtiene un reporte: qué es compatible, qué está roto, qué fue abandonado, qué pares entran en conflicto

**Mercado objetivo:** 85–90% de servidores corre Paper/Spigot. También soporta Fabric y Forge.

**MVP:** Completamente stateless, sin base de datos, sin autenticación. Herramienta pura de validación.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Framework | Next.js 15 (App Router) + TypeScript strict | Monolito simple: frontend + API routes en un repo, SSR para SEO |
| Styling | Tailwind CSS v4 | Estándar del ecosistema, CSS variables nativas |
| Componentes | shadcn/ui | Primitivos accesibles, 100% customizable, zero overhead de runtime |
| JAR Parsing | JSZip (client-side) | Los `.jar` se parsean en el browser — los archivos NUNCA salen del usuario |
| API Integration | Next.js API Routes (serverless) | Llama a Modrinth + Spiget + Hangar + GitHub en paralelo |
| Caching | Upstash Redis | Serverless Redis, TTL por respuesta de API, evita rate limits |
| Hosting | Vercel | Free tier suficiente para MVP, serverless nativo |
| Package Manager | pnpm | Más rápido que npm |
| Font | Plus Jakarta Sans | Headings y body |
| Monospace | JetBrains Mono | Nombres de plugin, versiones |

---

## 3. Arquitectura: Flujo de Datos

```
[Usuario]
    │
    ├─ Sube .jar files
    │       │
    │       ▼
    │   [JSZip - Browser]
    │   Parsea ZIP → extrae plugin.yml / fabric.mod.json / mods.toml
    │   Resultado: PluginInput[] (nombre, versión, dependencias)
    │   ⚠️  Los archivos NUNCA llegan al servidor
    │
    └─ O escribe nombres manualmente → PluginInput[]
    
    │
    ▼
[POST /api/check]
    │
    ├─ Rate limiting (Upstash, 10 req/min/IP)
    ├─ Validación Zod del body
    │
    ├─ Para cada plugin en paralelo (Promise.all):
    │       │
    │       ├─ Cache hit? → retornar resultado cacheado
    │       │
    │       └─ Cache miss:
    │               │
    │               ▼
    │           [aggregator.ts]
    │           Paper/Spigot: Hangar → Spiget → Modrinth
    │           Fabric/Forge:  Modrinth → (fallback: GitHub)
    │               │
    │               ├─ GitHub check (¿repo archivado? ¿sin commits 18+ meses?)
    │               └─ Guardar en Redis (TTL 6h)
    │
    ├─ [conflict-detector.ts]
    │   Nivel 1: Known pairs (known-conflicts.json)
    │   Nivel 2: Dependency + incompatible status
    │   Nivel 3: Missing hard dependencies
    │
    └─ Retorna CheckResponse JSON
    
    │
    ▼
[Cliente - ResultsPanel]
    ├─ SummaryBar (N compatibles · N rotos · N abandonados · N conflictos)
    ├─ ConflictCard (si hay conflictos)
    ├─ ResultsTable (fila por plugin con StatusBadge)
    └─ ExportButton (CSV o texto plano)
```

---

## 4. Estructura de Directorios

```
plugcheck/
  src/
    app/
      page.tsx                    # Landing + checker (single page)
      layout.tsx                  # Metadata, fuentes, OG image
      globals.css                 # Tailwind + CSS variables del design system
      api/
        check/route.ts            # POST — verifica lista de plugins
        search/route.ts           # GET  — autocomplete de nombres
    components/
      checker/
        DropZone.tsx              # Drag & drop de múltiples .jar
        PluginNameInput.tsx       # Textarea con autocomplete
        VersionSelector.tsx       # Dropdown versión MC
        PlatformTabs.tsx          # Paper/Spigot | Fabric | Forge
        CheckButton.tsx           # CTA con loading state
      results/
        ResultsPanel.tsx          # Wrapper del panel de resultados
        SummaryBar.tsx            # Resumen numérico animado
        ResultsTable.tsx          # Tabla principal
        PluginRow.tsx             # Fila individual de plugin
        StatusBadge.tsx           # Badge coloreado por status
        ConflictCard.tsx          # Alertas de conflictos (fondo amber)
        ExportButton.tsx          # Export CSV / texto
      shared/
        Navbar.tsx
        Footer.tsx
        HowItWorks.tsx
      ui/                         # shadcn/ui generados (button, badge, table…)
    lib/
      jar-parser.ts               # Lee .jar con JSZip, extrae metadatos
      conflict-detector.ts        # Detecta conflictos known + dependency
      cache.ts                    # Wrapper Upstash Redis
      api/
        modrinth.ts               # Cliente Modrinth API v2
        spiget.ts                 # Cliente Spiget API
        hangar.ts                 # Cliente Hangar API (PaperMC)
        github.ts                 # Check abandono vía GitHub API
        aggregator.ts             # Orquesta las 4 APIs con prioridad por plataforma
    data/
      known-conflicts.json        # Pares de plugins incompatibles (curado)
      mc-versions.json            # Versiones MC soportadas
    types/
      index.ts                    # Todos los tipos TypeScript
  public/
    logo.svg
    og-image.png                  # 1200×630 Open Graph
  .env.example
  CLAUDE.md
```

---

## 5. Tipos TypeScript Centrales

```typescript
// src/types/index.ts

type Platform = "paper" | "spigot" | "fabric" | "forge" | "purpur"

type PluginStatus = "compatible" | "incompatible" | "abandoned" | "unknown"

interface PluginInput {
  name: string
  version: string | null        // extraída del JAR o ingresada manualmente
  type: "plugin" | "mod"
  dependencies: string[]        // del plugin.yml / fabric.mod.json
  source: "jar" | "manual"
}

interface AlternativePlugin {
  name: string
  url: string
  reason: string
}

interface PluginResult {
  name: string
  status: PluginStatus
  latestVersion: string | null
  supportedVersions: string[]
  lastUpdate: string | null
  isAbandoned: boolean
  source: "modrinth" | "spigot" | "hangar" | "github"
  url: string | null
  alternative: AlternativePlugin | null
  dependencies: string[]
}

interface ConflictResult {
  type: "dependency" | "known" | "duplicate"
  plugins: string[]
  severity: "error" | "warning"
  reason: string
}

interface CheckResponse {
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
  checkedAt: string
}
```

---

## 6. API Routes

### POST /api/check

Endpoint principal. Recibe lista de plugins + versión MC + plataforma. Retorna reporte completo.

**Request:**
```json
{
  "plugins": [
    { "name": "EssentialsX", "version": "2.20.1", "type": "plugin", "dependencies": ["Vault"] }
  ],
  "mcVersion": "1.21.4",
  "platform": "paper"
}
```

**Lógica interna:**
1. Rate limiting (10 req/min/IP con Upstash `@upstash/ratelimit`)
2. Validar con Zod schema
3. `Promise.all()` — para cada plugin: cache hit → retornar | cache miss → aggregator → setCache(TTL 6h)
4. `detectConflicts(results, mcVersion)`
5. Construir summary
6. Return `NextResponse.json(checkResponse)`

**Error responses consistentes:**
```json
{ "error": "INVALID_REQUEST", "message": "mcVersion is required" }   // 400
{ "error": "RATE_LIMITED", "message": "Too many requests" }            // 429
{ "error": "UPSTREAM_ERROR", "message": "External APIs unavailable" }  // 502
```

### GET /api/search?q=essentials&platform=paper

Autocomplete de nombres. Busca en Modrinth + Spiget en paralelo. Cache 1h. Retorna top 5.

---

## 7. Componentes de UI — Jerarquía

```
HomePage (Server Component)
  └── Navbar
  └── HeroSection  ("¿Cuáles de tus plugins sobreviven la nueva versión?")
  └── CheckerSection  ← único "use client" grande, aquí vive TODO el estado
        ├── PlatformTabs        (paper / spigot / fabric / forge)
        ├── VersionSelector     (dropdown con mc-versions.json)
        ├── DropZone            (drag & drop, llama a jar-parser.ts)
        ├── PluginNameInput     (textarea + debounced autocomplete)
        ├── CheckButton         (loading state, disabled si no hay plugins)
        └── ResultsPanel        (visible solo tras primer check exitoso)
              ├── SummaryBar    (4 contadores: ✅ ❌ ⚠️ ⚡)
              ├── ConflictCard  (fondo amber, solo si hay conflictos)
              ├── ResultsTable
              │     └── PluginRow × N
              │           └── StatusBadge
              └── ExportButton  (CSV / texto plano)
  └── HowItWorks  (3 pasos explicativos con iconos Lucide)
  └── Footer
```

**Estado en CheckerSection:**
```typescript
const [platform, setPlatform] = useState<Platform>("paper")
const [mcVersion, setMcVersion] = useState("1.21.4")
const [plugins, setPlugins] = useState<PluginInput[]>([])
const [results, setResults] = useState<CheckResponse | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

---

## 8. Design System

### Colores (CSS variables en globals.css)

```css
:root {
  --color-primary: #16A34A;       /* verde — CTA, badge compatible */
  --color-on-primary: #FFFFFF;
  --color-secondary: #6366F1;     /* índigo — badge alternativa */
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;       /* cards, tabla, drop zone */
  --color-foreground: #0F172A;    /* texto principal */
  --color-muted: #F1F5F9;         /* fondos de inputs */
  --color-muted-fg: #64748B;      /* texto secundario */
  --color-border: #E2E8F0;
  --color-destructive: #DC2626;   /* badge incompatible */
  --color-warning: #D97706;       /* badge abandonado */
  --color-ring: #16A34A;          /* focus ring */
}
```

### Status Badges

| Status | Background | Texto |
|--------|-----------|-------|
| compatible | `#DCFCE7` | `#15803D` |
| incompatible | `#FEE2E2` | `#B91C1C` |
| abandoned | `#FEF3C7` | `#B45309` |
| alternative | `#EDE9FE` | `#5B21B6` |
| unknown | `#F1F5F9` | `#475569` |

### Tipografía

| Rol | Fuente | Peso |
|-----|--------|------|
| Hero H1 | Plus Jakarta Sans | 700 |
| Headings | Plus Jakarta Sans | 600 |
| Body | Plus Jakarta Sans | 400 |
| Nombres de plugin / versiones | JetBrains Mono | 500 |

### Estilo General

- **Flat design** — sin gradientes, sin sombras pesadas (`shadow-sm` máximo)
- **Border radius:** `rounded-lg` (inputs/badges) · `rounded-xl` (cards/panels) · `rounded-full` (badges pill)
- **Animaciones:** solo `transition-all duration-150 ease-out`
- **ResultsPanel:** aparece con `animate-in fade-in-0 slide-in-from-bottom-4`
- **DropZone activo:** borde punteado verde + fondo `green-50`

---

## 9. Reglas No Negociables

1. **TypeScript strict, cero `any`.** Usar `unknown` + type narrowing si el tipo no es claro.
2. **Los JARs se parsean 100% en el browser.** JSZip. Los archivos NUNCA llegan al servidor.
3. **Toda llamada a API externa pasa por `cache.ts`.** Sin excepción. Cache key: `plugcheck:v1:{name}:{mcVersion}:{platform}`.
4. **Rate limiting en todos los endpoints desde el día 1** — `@upstash/ratelimit`.
5. **Error shape consistente:** `{ error: string, message: string }` + HTTP status correcto.
6. **Mobile-first.** El checker debe ser usable en teléfono.
7. **Sin `useEffect` para data fetching.** El fetch se dispara por acción del usuario, no por efectos.
8. **One component per file, máximo 300 líneas.** Si crece, extraer sub-componentes.

---

## 10. Variables de Entorno

| Variable | Descripción | Obligatoria |
|----------|-------------|-------------|
| `UPSTASH_REDIS_REST_URL` | URL REST del Redis de Upstash | Sí |
| `UPSTASH_REDIS_REST_TOKEN` | Token de autenticación Upstash | Sí |
| `GITHUB_TOKEN` | PAT de GitHub (scope: public_repo read) | No (evita rate limit 60/hr) |

---

## 11. Fases de Build

| Fase | Pasos | Contenido |
|------|-------|-----------|
| **1 — Fundación** | 1–2 | Scaffold Next.js, dependencias, design system, tipos, datos estáticos |
| **2 — Core lib** | 3–6 | jar-parser, API clients, cache, conflict-detector |
| **3 — Backend** | 7–8 | API routes /check y /search con rate limiting |
| **4 — UI** | 9–11 | Todos los componentes, CheckerSection, página principal |
| **5 — Producción** | 12–15 | SEO, env vars, deploy Vercel, smoke test |

---

## 12. Decisiones de Diseño Clave

### Por qué JSZip en el browser
Los archivos `.jar` de plugins pueden contener código propietario. Parsearlos en el servidor implicaría subir archivos arbitrarios de usuarios, creando riesgo de seguridad y problemas de privacidad. JSZip en el browser elimina ambos problemas y además reduce el ancho de banda.

### Por qué sin base de datos
MVP de validación pura. Los resultados son frescos por definición (vienen de APIs externas con TTL). Agregar una DB añadiría complejidad sin valor para el primer ciclo de feedback.

### Por qué Upstash Redis y no simplemente `cache` en memoria
Las serverless functions de Vercel son stateless — cada invocación puede correr en una instancia diferente. Sin Redis, cada request llama a las APIs externas directamente, agotando rate limits en horas.

### Por qué el aggregator prueba APIs en orden
Hangar es la fuente oficial de PaperMC (más confiable para Paper/Spigot). Spiget tiene el catálogo más grande de plugins legacy. Modrinth está creciendo pero tiene mejor cobertura de Fabric/Forge. El orden minimiza llamadas fallidas.

### Por qué CheckerSection es el único "use client" grande
Next.js prefiere Server Components por defecto para reducir JavaScript en el cliente. Todo el estado del checker (platform, mcVersion, plugins, results) vive en un único componente padre, evitando prop drilling y manteniendo el boundary cliente/servidor claro.
