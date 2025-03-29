/**
 * Client-side utility functions for handling API requests
 */

/**
 * Enhanced fetch function that includes auth credentials and handles common error scenarios
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Always include credentials
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'Accept': 'application/json',
      'Content-Type': options.body ? 'application/json' : 'text/plain',
      'X-Client-Auth': '1', // Custom header to indicate client auth
    },
  };

  try {
    // Attempt the fetch with auth credentials
    const response = await fetch(url, fetchOptions);
    
    // If 401 unauthorized, try once more with force param
    if (response.status === 401) {
      console.log('Unauthorized API call, retrying with force param:', url);
      
      // Add a query parameter to force refresh auth
      const separator = url.includes('?') ? '&' : '?';
      const retryUrl = `${url}${separator}_auth=force`;
      
      // Retry the request with the force param
      const retryResponse = await fetch(retryUrl, fetchOptions);
      
      return retryResponse;
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

/**
 * Get user data with auth and retry
 */
export async function getUserData() {
  try {
    const response = await fetchWithAuth('/api/user');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Get quotes with optional lat/lon coordinates
 */
export async function getQuote(lat?: number, lon?: number, force: boolean = false) {
  try {
    // Build the URL with query parameters
    let url = '/api/quotes';
    const params = new URLSearchParams();
    
    // Generate a truly unique identifier
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const unique = `${timestamp}-${random}`;
    
    // Add a unique parameter to prevent caching
    params.append('unique', unique);
    
    // Add location if available
    if (lat && lon) {
      params.append('lat', lat.toString());
      params.append('lon', lon.toString());
    }
    
    // Always force refresh 
    params.append('force', 'true');
    
    // Add a client-specific ID
    params.append('client', random);
    
    // Combine URL and parameters
    url = `${url}?${params.toString()}`;
    
    console.log(`[CLIENT] Fetching quote at ${new Date().toISOString().substring(11, 19)} with unique=${timestamp}`);
    
    // Use a no-cache fetch approach
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': timestamp.toString(),
        'X-Client-ID': random
      },
      cache: 'no-store',
      credentials: 'include',
      next: { revalidate: 0 } as any
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Log what we received to debug
    console.log(`[CLIENT] Received quote at ${new Date().toISOString().substring(11, 19)}: ${data.quote?.substring(0, 20)}...`);
    
    return data.quote || "Stay consistent with your fitness journey.";
  } catch (error) {
    console.error('Error fetching quote:', error);
    // Use a timestamp to make even the fallback different each time
    const fallbackQuotes = [
      "Consistency matters more than intensity.",
      "Small habits add up to big changes.", 
      "Focus on progress, not perfection.",
      "Every workout counts, no matter how small."
    ];
    const index = Date.now() % fallbackQuotes.length;
    return fallbackQuotes[index];
  }
} 