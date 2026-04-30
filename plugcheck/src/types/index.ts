export type Platform = "paper" | "spigot" | "fabric" | "forge" | "purpur"

export type PluginStatus = "compatible" | "incompatible" | "abandoned" | "unknown"

export interface PluginInput {
  name: string
  version: string | null
  type: "plugin" | "mod"
  dependencies: string[]
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
  lastUpdate: string | null
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
  checkedAt: string
}
