import type { Metadata } from 'next'
import Script from 'next/script'
import localFont from 'next/font/local'
import { Noto_Sans_Runic } from 'next/font/google'
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import { ThemeProvider } from 'next-themes'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import { WebMcpTools } from '@/components/webmcp-tools'
import { ReactQueryProvider } from '@/components/react-query/react-query-provider'
import { WalletStoreHydration } from '@/components/wallet-store-hydration'
import { AppConfig } from '@/config'
import { getLangDir, type Locale } from '@/i18n/config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(AppConfig.baseUrl),
  title: AppConfig.title,
  icons: {
    icon: AppConfig.favicon,
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    title: 'THORChain Swap',
    statusBarStyle: 'black-translucent'
  },
  openGraph: {
    title: AppConfig.title,
    description: AppConfig.description,
    url: AppConfig.baseUrl,
    siteName: 'THORChain Swap',
    images: [
      {
        url: `${AppConfig.baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: AppConfig.title
      }
    ],
    type: 'website',
    locale: 'en_US'
  },
  twitter: {
    card: 'summary_large_image',
    title: AppConfig.title,
    description: AppConfig.description,
    images: [
      {
        url: `${AppConfig.baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: AppConfig.title
      }
    ]
  },
  verification: {
    google: 'MWABJkMWVW-TIfLuXops2ZuVAYv71PSmQ6Iz6IGvu08'
  }
}

const crit = localFont({
  variable: '--font-crit',
  display: 'swap',
  src: [
    { path: './fonts/Crit-Light-Trial.otf', weight: '300', style: 'normal' },
    { path: './fonts/Crit-Light-Italic-Trial.otf', weight: '300', style: 'italic' },
    { path: './fonts/Crit-Regular-Trial.otf', weight: '400', style: 'normal' },
    { path: './fonts/Crit-Italic-Trial.otf', weight: '400', style: 'italic' },
    { path: './fonts/Crit-Medium-Trial.otf', weight: '500', style: 'normal' },
    { path: './fonts/Crit-Medium-Italic-Trial.otf', weight: '500', style: 'italic' },
    { path: './fonts/Crit-Semibold-Trial.otf', weight: '600', style: 'normal' },
    { path: './fonts/Crit-Semibold-Italic-Trial.otf', weight: '600', style: 'italic' },
    { path: './fonts/Crit-Bold-Trial.otf', weight: '700', style: 'normal' },
    { path: './fonts/Crit-Bold-Italic-Trial.otf', weight: '700', style: 'italic' }
  ]
})

const notoRunic = Noto_Sans_Runic({
  variable: '--font-runic',
  display: 'swap',
  weight: '400',
  subsets: ['runic']
})

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await getLocale()) as Locale
  const messages = await getMessages()

  return (
    <html lang={locale} dir={getLangDir(locale)} data-brand={AppConfig.id} suppressHydrationWarning>
      {AppConfig.gtag && <GoogleTagManager gtmId={AppConfig.gtag} />}
      <GoogleAnalytics gaId="G-VZ0FQ1WC7G" />
      <Script
        id="hotjar"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:6592863,hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`
        }}
      />
      {AppConfig.pixelId && (
        <Script
          dangerouslySetInnerHTML={{
            __html: `!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${AppConfig.pixelId}')`
          }}
        />
      )}
      <body className={`${crit.variable} ${notoRunic.variable} bg-body font-sans antialiased`}>
        {/* Agent discovery links; React hoists them into <head>. */}
        <link rel="mcp-server-card" type="application/json" href="/.well-known/mcp-server-card.json" />
        <link rel="alternate" type="text/markdown" title="llms.txt" href="/llms.txt" />
        <WebMcpTools />
        <WalletStoreHydration />
        <ReactQueryProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider defaultTheme="light" attribute="class" disableTransitionOnChange>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
        </ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
