'use client'

export function Footer() {
  return (
    <footer
      className="mt-16"
      style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 text-center">
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
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
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-foreground)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-foreground)')}
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
