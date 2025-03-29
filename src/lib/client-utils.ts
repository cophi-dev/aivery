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
// Keep track of the last received quote to prevent repeats
let lastReceivedQuote = '';

export async function getQuote(lat?: number, lon?: number, force: boolean = false) {
  try {
    // Generate a truly unique parameter to ensure no caching
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`;
    
    // Build URL with parameters to force uniqueness and track last quote
    const params = new URLSearchParams();
    params.append('nocache', uniqueId);
    params.append('timestamp', Date.now().toString());
    
    // Add the last quote to explicitly avoid repeats
    if (lastReceivedQuote) {
      params.append('lastQuote', encodeURIComponent(lastReceivedQuote));
    }
    
    // Add location if available
    if (lat && lon) {
      params.append('lat', lat.toString());
      params.append('lon', lon.toString());
    }
    
    // Force refresh
    params.append('force', 'true');
    
    // Use the dynamic quotes endpoint with all params
    const dynamicUrl = `/api/quotes/dynamic?${params.toString()}`;
    
    console.log(`[CLIENT] Fetching dynamic quote at ${new Date().toISOString().substring(11, 19)} with ID: ${uniqueId.substring(0, 10)}`);
    
    // Use a direct fetch with no-cache options
    const response = await fetch(dynamicUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': Date.now().toString(),
        'X-Random': uniqueId,
        'X-Last-Quote': lastReceivedQuote ? encodeURIComponent(lastReceivedQuote.substring(0, 30)) : ''
      },
      // Force each request to be fresh using cache: 'no-store'
      cache: 'no-store',
      next: { 
        revalidate: 0,
        // Bypass all caches including browser and service worker caches
        tags: [uniqueId] 
      } as any
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Make sure we got a different quote
    if (data.quote === lastReceivedQuote && data.quote) {
      console.log(`[CLIENT] Warning: Received the same quote again: "${data.quote.substring(0, 20)}..."`);
      
      // Generate a fallback different quote
      const fallbackQuotes = [
        "Consistency matters more than intensity.",
        "Small habits add up to big changes.", 
        "Focus on progress, not perfection.",
        "Every workout counts, no matter how small.",
        "Keep moving forward, even if it's just a little each day.",
        "Today's efforts become tomorrow's results.",
        "The best time to start was yesterday. The next best time is now.",
        "You're stronger than you think.",
        "Just showing up is half the battle."
      ].filter(q => q !== lastReceivedQuote);
      
      const clientRandomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
      
      // Log client-generated quote
      console.log(`[CLIENT] Generated different quote client-side: "${clientRandomQuote.substring(0, 20)}..."`);
      
      // Save as last quote
      lastReceivedQuote = clientRandomQuote;
      return clientRandomQuote;
    }
    
    // Save this quote as the last received
    if (data.quote) {
      lastReceivedQuote = data.quote;
    }
    
    // Log what we received to debug
    console.log(`[CLIENT] Received quote at ${new Date().toISOString().substring(11, 19)}: ${data.quote?.substring(0, 20)}...`);
    
    return data.quote || "Stay consistent with your fitness journey.";
  } catch (error) {
    console.error('Error fetching quote:', error);
    // Generate a completely random fallback quote - different from last
    const fallbackQuotes = [
      "Consistency matters more than intensity.",
      "Small habits add up to big changes.", 
      "Focus on progress, not perfection.",
      "Every workout counts, no matter how small.",
      "Keep moving forward, even if it's just a little each day.",
      "Today's efforts become tomorrow's results.",
      "The best time to start was yesterday. The next best time is now.",
      "You're stronger than you think.",
      "Just showing up is half the battle."
    ].filter(q => q !== lastReceivedQuote);
    
    // Ensure randomness using current timestamp
    const index = Date.now() % fallbackQuotes.length;
    const newQuote = fallbackQuotes[index];
    
    // Update last quote
    lastReceivedQuote = newQuote;
    
    return newQuote;
  }
} 