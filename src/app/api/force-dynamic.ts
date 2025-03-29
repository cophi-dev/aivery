// This file exports configuration to force dynamic behavior in API routes
// Import this in API route files with: import { dynamic } from '@/app/api/force-dynamic'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper function to set strong cache-busting headers
export function setNoCacheHeaders(headers: Headers) {
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Surrogate-Control', 'no-store');
  headers.set('X-Accel-Expires', '0');
  
  return headers;
}

// Helper response builder with cache control
export function dynamicResponse(body: any, status = 200) {
  const headers = new Headers();
  setNoCacheHeaders(headers);
  
  return new Response(JSON.stringify(body), {
    status,
    headers
  });
} 