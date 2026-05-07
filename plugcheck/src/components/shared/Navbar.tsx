'use client'

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
