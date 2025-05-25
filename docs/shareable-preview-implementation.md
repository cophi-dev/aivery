# Shareable Preview Implementation

## Overview
This document outlines the comprehensive Open Graph (OG) and social media preview implementation for Aivery. The system ensures that when users share links to your app, they display properly with your logo, proper descriptions, and branded images.

## What Was Implemented

### 1. Enhanced Main Layout Meta Tags (`src/app/layout.tsx`)
- Added comprehensive Open Graph meta tags
- Included Twitter Card support
- Added proper structured data with logo and branding
- Implemented fallback mechanisms

### 2. Metadata Utility (`src/lib/utils/metadata.ts`)
- Created `generateMetadata()` function for consistent OG tags across pages
- Helper functions for dynamic OG image generation
- Centralized metadata management

### 3. Branded OG Images
- **Static SVG**: `/public/icons/aivery-og.svg` - Generated branded OG image
- **Fallback API**: `/api/og-fallback` - Dynamic branded image endpoint
- **Dynamic Screenshots**: Enhanced existing `/api/og-screenshot` functionality

### 4. Page-Specific Metadata
Updated major pages with proper metadata:
- **Homepage** (`src/app/page.tsx`) - Uses utility function
- **Exercises** (`src/app/exercises/page.tsx`) - Enhanced descriptions
- **Individual Exercises** (`src/app/exercises/[id]/page.tsx`) - Dynamic screenshots + fallbacks
- **Dashboard** (`src/app/dashboard/layout.tsx`) - New layout with metadata
- **Workouts** (`src/app/workouts/layout.tsx`) - New layout with metadata  
- **Chat/AI Coach** (`src/app/chat/layout.tsx`) - Enhanced existing layout

### 5. Testing & Debug Tools
- **Test Page**: `/debug/og-test` - Complete testing interface
- Links to Facebook Debugger, Twitter Card Validator, LinkedIn Inspector
- Preview image generation and testing

## How It Works

### Static Fallback Chain
1. **Primary**: Dynamic screenshot from Vercel Blob storage
2. **Secondary**: Static SVG file (`/icons/aivery-og.svg`)
3. **Tertiary**: API-generated fallback (`/api/og-fallback`)

### Dynamic OG Images
- Exercise pages automatically generate screenshots
- Screenshots stored in Vercel Blob for fast access
- Fallback to branded image if screenshot fails

### Metadata Structure
Every page now includes:
- Proper title and description
- Open Graph tags (title, description, image, url, type)
- Twitter Card tags (summary_large_image)
- SEO-friendly robots meta tags
- Canonical URLs

## Usage

### Using the Metadata Utility
```typescript
import { generateMetadata } from '@/lib/utils/metadata'

export const metadata: Metadata = generateMetadata({
  title: "Your Page Title | Aivery",
  description: "Your page description for social sharing",
  path: "/your-page-path", 
  keywords: ["keyword1", "keyword2"],
  type: "website" // or "article"
})
```

### Testing Social Previews

1. **Visit the Test Page**: Go to `/debug/og-test`
2. **Test Social Platforms**:
   - Facebook: Use Facebook Debugger
   - Twitter: Use Twitter Card Validator  
   - LinkedIn: Use LinkedIn Post Inspector
3. **Generate Screenshots**: Use the screenshot generation button

### Key URLs for Testing
- Main OG Image: `/icons/aivery-og.svg`
- Fallback API: `/api/og-fallback`
- Test Page: `/debug/og-test`

## Environment Variables Required

Make sure these are set:
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Your actual domain
BLOB_URL=https://your-blob-storage-url       # Vercel Blob URL (optional)
```

## Benefits

### ✅ Professional Social Sharing
- Branded previews with Aivery logo
- Consistent descriptions across all platforms
- High-quality 1200x630 images

### ✅ SEO Improvements  
- Proper meta tags for search engines
- Structured data with brand information
- Canonical URLs preventing duplicate content

### ✅ Dynamic Content
- Exercise pages get custom screenshots
- Workout pages show relevant previews
- Fallback system ensures something always shows

### ✅ Easy Maintenance
- Centralized metadata utility
- Consistent branding across all pages
- Easy to add new pages with proper OG tags

## Troubleshooting

### If Social Previews Don't Update:
1. Use Facebook Debugger to clear cache
2. Check the test page for image accessibility
3. Verify environment variables are set correctly

### If Images Don't Load:
- Check `/api/og-fallback` loads properly
- Verify static SVG file exists at `/icons/aivery-og.svg`
- Test dynamic screenshot generation

### For New Pages:
1. Use the `generateMetadata()` utility
2. Add page-specific keywords and descriptions
3. Test with the debug tools

## Next Steps

1. **Deploy and Test**: Deploy to production and test social sharing
2. **Monitor Performance**: Check OG image load times  
3. **Add More Pages**: Apply metadata to remaining important pages
4. **Customize Images**: Create page-specific branded images as needed

The implementation provides a robust foundation for social media sharing with professional-looking previews that accurately represent your Aivery brand. 