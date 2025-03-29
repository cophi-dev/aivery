// This file ensures all pages are server-rendered dynamically
// Import this file in layout.tsx to apply to all pages

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

// Disable static optimization for all routes
export const config = {
  unstable_runtimeJS: true,
  unstable_JsPreload: false
}

// This ensures that Next.js knows this site requires dynamic rendering
export default function configureDynamicRendering() {
  // This function doesn't need to do anything - its existence is enough
  return null
} 