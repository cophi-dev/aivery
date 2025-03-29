import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/components/providers/auth-provider"
import { MainHeader } from "@/components/main-header"
import { PersistentChat } from "@/components/persistent-chat"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ToastProvider } from "@/components/ui/toast"
import ForceCleanup from "./cleanup"
import { Metadata } from "next"
// Import the dynamic config to force dynamic rendering
import "./dynamic-config"

// Force dynamic rendering for the entire app
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Aivery - AI Fitness Coach",
  description: "Your personal AI fitness coach",
  // Add cache control directive 
  other: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '-1',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Force cache busting for all resources */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ForceCleanup />
          
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            storageKey="aivery-theme"
            disableTransitionOnChange
          >
            <ToastProvider>
              <MainHeader />
              <main className="min-h-screen pt-14">{children}</main>
              {session?.user && <PersistentChat />}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
