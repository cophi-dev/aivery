// This file forces all API routes to be dynamic by setting a parent route with dynamic configuration

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function GET() {
  // Add no-cache headers for this response
  const headers = new Headers()
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '-1')
  headers.set('Surrogate-Control', 'no-store')
  headers.set('X-Accel-Expires', '0')

  // Return API status
  return new Response(
    JSON.stringify({
      status: 'ok',
      dynamic: true,
      message: 'API is running in dynamic mode',
      timestamp: new Date().toISOString(),
      cacheBusting: Math.random().toString(36).substring(2)
    }),
    {
      status: 200,
      headers
    }
  )
}

export async function HEAD() {
  // Add no-cache headers for this response
  const headers = new Headers()
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '-1')
  headers.set('Surrogate-Control', 'no-store')
  headers.set('X-Accel-Expires', '0')
  
  return new Response(null, {
    status: 200,
    headers
  })
} 