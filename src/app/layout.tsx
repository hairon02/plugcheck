import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://plugcheck.dev'),
  title: 'PlugCheck — Verify Minecraft Plugin Compatibility',
  description:
    'Upload your .jar files or paste your plugin list. Find out in seconds which plugins are compatible with your target Minecraft version.',
  openGraph: {
    title: 'PlugCheck — Verify Minecraft Plugin Compatibility',
    description:
      'Check plugin compatibility, detect conflicts, and find alternatives. No login required.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
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
        <Analytics />
      </body>
    </html>
  )
}
