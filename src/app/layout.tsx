import "./globals.css"
import { Inter, Poppins, DM_Serif_Display } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/components/providers/auth-provider"
import { MainHeader } from "@/components/main-header"
import { PersistentChat } from "@/components/persistent-chat"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/use-toast"
import ForceCleanup from "./cleanup"
import { Metadata } from "next"
// Import the dynamic config to force dynamic rendering
import "./dynamic-config"
// Import the version from the version file
import { VERSION, getTimestamp } from "./version"
// Import next/dynamic for client components
import { default as NextDynamic } from "next/dynamic"
// Import Vercel Analytics
import { Analytics } from '@vercel/analytics/react';

// Import CacheBuster with client-side only rendering
const CacheBuster = NextDynamic(() => import("@/components/cache-buster"), { ssr: false })

// Initialize Poppins
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // Include needed weights
  variable: "--font-poppins", // Define CSS variable
})

// Initialize DM Serif Display
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400", // DM Serif Display typically only has 400 weight
  variable: "--font-dm-serif", // Define CSS variable
})

// Keep Inter if needed elsewhere, otherwise could remove
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

// Force dynamic rendering for the entire app
// export const dynamic = 'force-dynamic' // Removed
// export const revalidate = 0 // Removed
// export const fetchCache = 'force-no-store' // Removed
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: "Aivery",
  description: "Your AI-powered fitness companion.",
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="build-time" content={getTimestamp()} />
        <meta name="build-id" content={VERSION} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#4B9EFF" />
        <link rel="manifest" href="/manifest.json" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: .5; }
              }
              #splash-screen img {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `,
          }}
        />
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
            
            // Force PWA to update icons by registering a new service worker
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                  registration.update();
                }
              });
            }
            
            // Add unique timestamp to prevent edge caching
            window.CACHE_BUSTER = Date.now();
            ` 
          }} 
        />
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/apple-icon-512x512.png" />
        {/* Add other sizes if needed, e.g.:
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-icon-120x120.png" /> 
        */}
      </head>
      <body className={`${poppins.variable} ${inter.variable} ${dmSerif.variable} font-sans antialiased`} suppressHydrationWarning>
        {/* Initial Load Splash Screen */}
        <div id="splash-screen" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, transition: 'opacity 0.5s ease-out' }}>
          <img src="/icons/aivery.svg" alt="Loading Aivery..." style={{ width: '150px', height: '150px' }} />
        </div>

        {/* Client-side cache buster */}
        <CacheBuster />
        
        <AuthProvider>
          <ForceCleanup />
          
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="aivery-theme"
            disableTransitionOnChange
          >
            <ToastProvider>
              {/* Always render MainHeader */}
              <MainHeader />
              {/* Conditionally apply main padding based on session - REMOVED */}
              <main className="min-h-screen">{children}</main> 
              {/* {session?.user && <PersistentChat />} */}
              <Toaster />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
        {/* Script to hide splash screen */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', () => {
                setTimeout(() => { // Add a delay before starting fade
                  const splash = document.getElementById('splash-screen');
                  if (splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => {
                      splash.style.display = 'none';
                    }, 500); // Must match transition duration
                  }
                }, 300); // Delay in milliseconds (e.g., 300ms)
              });
            `,
          }}
        />
      </body>
    </html>
  )
}
