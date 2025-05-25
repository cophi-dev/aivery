import { Metadata } from 'next'
import { generateMetadata } from '@/lib/utils/metadata'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = generateMetadata({
  title: "Open Graph Test | Aivery",
  description: "Testing Open Graph meta tags and social media previews for Aivery fitness app",
  path: "/debug/og-test",
  keywords: ["test", "open graph", "social media", "preview"],
  noIndex: true // Don't index this debug page
})

export default function OGTestPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Open Graph Preview Test</h1>
        <p className="text-muted-foreground">
          This page helps test the Open Graph meta tags and social media previews for Aivery.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preview URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Main OG Image</h3>
              <div className="space-y-2">
                <Link href="/icons/aivery-og.svg" target="_blank">
                  <Button variant="outline" size="sm">View Static SVG</Button>
                </Link>
                <Link href="/api/og-fallback" target="_blank">
                  <Button variant="outline" size="sm">View Fallback API</Button>
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Dynamic Screenshot</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Generate dynamic OG images for any page
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  fetch('/api/og-screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetPath: '/debug/og-test' })
                  })
                  .then(res => res.json())
                  .then(data => {
                    if (data.blobUrl) {
                      window.open(data.blobUrl, '_blank');
                    }
                  })
                  .catch(console.error);
                }}
              >
                Generate Screenshot
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Social Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Facebook Debugger</h3>
              <Link 
                href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app')}/debug/og-test`}
                target="_blank"
              >
                <Button variant="outline" size="sm">Test on Facebook</Button>
              </Link>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Twitter Card Validator</h3>
              <Link 
                href={`https://cards-dev.twitter.com/validator`}
                target="_blank"
              >
                <Button variant="outline" size="sm">Test on Twitter</Button>
              </Link>
            </div>

            <div>
              <h3 className="font-semibold mb-2">LinkedIn Inspector</h3>
              <Link 
                href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app')}/debug/og-test`}
                target="_blank"
              >
                <Button variant="outline" size="sm">Test on LinkedIn</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Current Meta Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
{`<meta property="og:title" content="Open Graph Test | Aivery" />
<meta property="og:description" content="Testing Open Graph meta tags and social media previews for Aivery fitness app" />
<meta property="og:url" content="${process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app'}/debug/og-test" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app'}/icons/aivery-og.svg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Aivery" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@aivery_app" />
<meta name="twitter:title" content="Open Graph Test | Aivery" />
<meta name="twitter:description" content="Testing Open Graph meta tags and social media previews for Aivery fitness app" />
<meta name="twitter:image" content="${process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app'}/api/og-fallback" />`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Test Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              <Link href="/">
                <Button variant="outline" className="w-full">Home Page</Button>
              </Link>
              <Link href="/exercises">
                <Button variant="outline" className="w-full">Exercises</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 