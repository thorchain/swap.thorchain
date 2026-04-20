import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import Script from 'next/script'
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { ReactQueryProvider } from '@/components/react-query/react-query-provider'
import { AppConfig } from '@/config'
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
  }
}

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap'
})

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-brand={AppConfig.id} suppressHydrationWarning>
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
      <body className={`${manrope.className} bg-body antialiased`}>
        <ReactQueryProvider>
          <ThemeProvider defaultTheme="light" attribute="class">
            {children}
          </ThemeProvider>
        </ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
