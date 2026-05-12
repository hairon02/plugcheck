const STEPS = [
  {
    icon: '📦',
    title: 'Upload or type',
    description:
      'Drop your .jar files or type plugin names. Everything runs in your browser. Your files never leave your machine.',
  },
  {
    icon: '🔍',
    title: 'We check the sources',
    description:
      'PlugCheck checks Hangar, SpigotMC, and Modrinth all at once to see what versions each plugin actually supports.',
  },
  {
    icon: '📊',
    title: 'Get your report',
    description:
      "Within seconds you'll see what works, what doesn't, and which plugins have been abandoned. Known conflicts show up too.",
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
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
