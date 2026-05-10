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
        backgroundColor: 'var(--color-card)',
        color: 'var(--color-foreground)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-card)')}
    >
      Export CSV
    </button>
  )
}
