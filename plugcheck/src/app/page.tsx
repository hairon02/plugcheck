import { Navbar } from '@/components/shared/Navbar'
import { HowItWorks } from '@/components/shared/HowItWorks'
import { Footer } from '@/components/shared/Footer'
import { CheckerSection } from '@/components/checker/CheckerSection'

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Navbar />
      <main>
        <section className="px-4 py-16 text-center">
          <h1
            className="mx-auto max-w-2xl text-4xl font-bold leading-tight sm:text-5xl"
            style={{ color: 'var(--color-foreground)' }}
          >
            Which of your plugins survive the update?
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl text-base"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Drop your .jar files or paste plugin names. You get a compatibility report in a few seconds.
          </p>
        </section>

        <section className="px-4 pb-16">
          <CheckerSection />
        </section>

        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}
