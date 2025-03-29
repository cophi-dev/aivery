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
 * Get personalized fitness quotes with optional location context
 * This function handles fetching quotes from the API with proper caching control
 * to ensure users always see fresh, relevant content
 */
// Keep track of the last received quote to prevent repeats
let lastReceivedQuote = '';
let lastQuoteTimestamp = 0;

export async function getQuote(lat?: number, lon?: number, force: boolean = false) {
  try {
    // Generate a truly unique request identifier
    const timestamp = Date.now();
    const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2)}`;
    
    // Only request a new quote if it's been at least 10 seconds or forced
    const shouldFetchNew = force || !lastReceivedQuote || (timestamp - lastQuoteTimestamp) > 10000;
    
    if (!shouldFetchNew) {
      console.log(`[CLIENT] Using cached quote (age: ${(timestamp - lastQuoteTimestamp) / 1000}s)`);
      return lastReceivedQuote;
    }
    
    // Build request parameters
    const params = new URLSearchParams();
    params.append('nocache', uniqueId);
    params.append('timestamp', timestamp.toString());
    
    // Add the last quote to explicitly avoid repeats
    if (lastReceivedQuote) {
      params.append('lastQuote', encodeURIComponent(lastReceivedQuote));
    }
    
    // Add location if available for weather-aware quotes
    if (lat && lon) {
      params.append('lat', lat.toString());
      params.append('lon', lon.toString());
    }
    
    // Always force refresh when explicitly requested
    if (force) {
      params.append('force', 'true');
    }
    
    // Use the dynamic quotes endpoint
    const dynamicUrl = `/api/quotes/dynamic?${params.toString()}`;
    
    console.log(`[CLIENT] Fetching dynamic quote at ${new Date().toISOString().substring(11, 19)} with ID: ${uniqueId.substring(0, 10)}`);
    
    // Use cache-busting headers to prevent any caching
    const response = await fetch(dynamicUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': timestamp.toString(),
        'X-Random': uniqueId
      },
      cache: 'no-store',
      next: { 
        revalidate: 0,
        tags: [uniqueId] 
      } as any
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.statusText}`);
    }
    
    const data = await response.json();
    let cleanQuote = data.quote || '';
    
    // If we somehow still got the same quote, use client-side fallback
    if (cleanQuote === lastReceivedQuote && cleanQuote) {
      console.log(`[CLIENT] Warning: Received the same quote again: "${cleanQuote.substring(0, 20)}..."`);
      
      // Client-side fallback quotes for variety
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
      
      console.log(`[CLIENT] Generated different quote client-side: "${clientRandomQuote.substring(0, 20)}..."`);
      
      // Update tracking variables
      lastReceivedQuote = clientRandomQuote;
      lastQuoteTimestamp = timestamp;
      return clientRandomQuote;
    }
    
    // Save this quote as the last received
    lastReceivedQuote = cleanQuote;
    lastQuoteTimestamp = timestamp;
    
    console.log(`[CLIENT] Received quote at ${new Date().toISOString().substring(11, 19)}: ${cleanQuote.substring(0, 20)}...`);
    
    return cleanQuote || "Stay consistent with your fitness journey.";
  } catch (error) {
    console.error('Error fetching quote:', error);
    
    // Generate a fallback quote different from the last one
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
    
    const index = Date.now() % fallbackQuotes.length;
    const newQuote = fallbackQuotes[index];
    
    lastReceivedQuote = newQuote;
    lastQuoteTimestamp = Date.now();
    
    return newQuote;
  }
} 