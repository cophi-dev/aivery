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
// Import the version from the version file
import { VERSION, getTimestamp } from "./version"
// Import next/dynamic for client components
import { default as NextDynamic } from "next/dynamic"

// Import CacheBuster with client-side only rendering
const CacheBuster = NextDynamic(() => import("@/components/cache-buster"), { ssr: false })

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
    'x-build-id': VERSION,
    'x-build-time': getTimestamp(),
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
        <meta name="version" content={VERSION} />
        {/* Additional cache-busting meta tags */}
        <meta httpEquiv="Surrogate-Control" content="no-store" />
        <meta httpEquiv="Clear-Site-Data" content="cache" />
        <meta name="MobileOptimized" content="width" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="build-time" content={getTimestamp()} />
        <meta name="build-id" content={VERSION} />
        {/* Generate unique URLs for all resources */}
        <link rel="manifest" href={`/manifest.json?v=${VERSION}`} />
        <script 
          dangerouslySetInnerHTML={{ 
            __html: `
            window.APP_VERSION="${VERSION}";
            window.BUILD_TIME="${getTimestamp()}";
            console.log("🔄 App Version:", window.APP_VERSION);
            // Immediately clear any caches on page load
            if ('caches' in window) {
              caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                  caches.delete(cacheName);
                  console.log("Cleared cache:", cacheName);
                });
              });
            }
            // Add unique timestamp to prevent edge caching
            window.CACHE_BUSTER = Date.now();
            ` 
          }} 
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {/* Client-side cache buster */}
        <CacheBuster />
        
        {/* Small debug indicator instead of full banner */}
        <div style={{
          background: 'rgba(220, 38, 38, 0.8)',
          color: 'white',
          padding: '4px 8px',
          fontSize: '12px',
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 9999,
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          v{VERSION.substring(0, 8)}
        </div>
        
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
