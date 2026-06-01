import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { SettingsProvider } from '@/lib/settings-context'
import InstallPrompt from '@/components/InstallPrompt'
import PushInit from '@/components/PushInit'
import Script from 'next/script'

export const metadata: Metadata = {
  title: '본부 관리 시스템',
  description: '본부-사업장 소통 및 관리',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '본부관리' },
}
export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png"/>
      </head>
      <body>
        <AuthProvider>
          <SettingsProvider>
            {children}
            <InstallPrompt/>
            <PushInit/>
          </SettingsProvider>
        </AuthProvider>
        <Script id="sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(()=>{})
          }
        `}</Script>
      </body>
    </html>
  )
}
