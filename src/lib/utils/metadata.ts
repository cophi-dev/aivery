import { Metadata } from 'next'

interface GenerateMetadataOptions {
  title: string
  description: string
  path?: string
  ogImage?: string
  noIndex?: boolean
  keywords?: string[]
  type?: 'website' | 'article'
}

export function generateMetadata({
  title,
  description,
  path = '',
  ogImage,
  noIndex = false,
  keywords = [],
  type = 'website'
}: GenerateMetadataOptions): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app'
  const url = `${baseUrl}${path}`
  
  // Default OG image with logo - fallback to API-generated image if static doesn't exist
  const defaultOgImage = '/icons/aivery-og.svg'
  const fallbackOgImage = '/api/og-fallback'
  const imageUrl = ogImage || defaultOgImage
  
  return {
    title,
    description,
    keywords: ['fitness', 'AI', 'workout tracking', 'personal trainer', ...keywords],
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      locale: 'en_US',
      url,
      siteName: 'Aivery',
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
          type: 'image/png',
        },
        {
          url: '/icons/aivery.svg',
          width: 512,
          height: 512,
          alt: 'Aivery Logo',
          type: 'image/svg+xml',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@aivery_app',
      creator: '@aivery_app',
      title,
      description,
      images: [imageUrl],
    },
    robots: noIndex ? {
      index: false,
      follow: false,
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

// Helper function to create dynamic OG images using the existing screenshot API
export function getDynamicOgImage(path: string): string {
  const baseUrl = process.env.BLOB_URL
  if (!baseUrl) return '/icons/aivery-og.png'
  
  const filename = `og-images${path.replace(/^\/|\/$/g, '').replace(/\//g, '_')}.png`
  return `${baseUrl}/${filename}`
}

// Helper to trigger OG image generation
export async function generateOgImage(path: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/og-screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetPath: path,
        forceUpdate: false,
      }),
    })
    
    if (!response.ok) {
      console.warn(`Failed to generate OG image for ${path}`)
      return null
    }
    
    const data = await response.json()
    return data.blobUrl
  } catch (error) {
    console.warn(`Error generating OG image for ${path}:`, error)
    return null
  }
} 