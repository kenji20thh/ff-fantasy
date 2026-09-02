import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'

const display = Space_Mono({ variable: '--font-display', subsets: ['latin'], weight: ['400', '700'] })
const body = Space_Grotesk({ variable: '--font-body', subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'FF / Fantasy — The official Free Fire fantasy league',
  description: 'Build your ultimate Free Fire squad and climb the FF Fantasy leaderboard.',
  generator: 'v0.app',
}

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#0b0d0c' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className={`${display.variable} ${body.variable} antialiased`}><AuthProvider><AppShell>{children}</AppShell></AuthProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
