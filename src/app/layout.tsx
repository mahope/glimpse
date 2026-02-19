import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { serverInit } from './server-init'
import { ToastHost } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Glimpse | mahope.dk",
  description: "Professional SEO tracking dashboard for WordPress sites",
  keywords: ["SEO", "Search Console", "Performance", "Analytics", "WordPress"],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await serverInit()
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <ToastHost />
        </ThemeProvider>
      </body>
    </html>
  )
}
