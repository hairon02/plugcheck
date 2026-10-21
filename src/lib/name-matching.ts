/** Normalize display names and slugs for exact project identity checks. */
export function normalizeProjectName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isExactProjectMatch(query: string, ...candidates: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeProjectName(query)
  return normalizedQuery.length > 0 && candidates.some(
    (candidate) => candidate != null && normalizeProjectName(candidate) === normalizedQuery
  )
}
