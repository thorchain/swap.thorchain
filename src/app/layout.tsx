import type { Metadata } from 'next'
import { ReactQueryProvider } from '@/components/react-query/react-query-provider'
import { Toaster } from '@/components/ui/sonner'
import { Manrope } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'THORChain Swap',
  description: 'THORChain Swap'
}

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap'
})

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.className} antialiased`}>
        <ReactQueryProvider>{children}</ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
