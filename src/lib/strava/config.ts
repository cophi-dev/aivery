export const STRAVA_CONFIG = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  redirectUri: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/strava/callback'
    : `https://aivery2.vercel.app/api/strava/callback`,
  scopes: ['read', 'activity:read_all'],
  authUrl: 'https://www.strava.com/oauth/authorize',
  tokenUrl: 'https://www.strava.com/api/v3/oauth/token',
  apiUrl: 'https://www.strava.com/api/v3'
}

export function getStravaAuthUrl() {
  if (!STRAVA_CONFIG.clientId) {
    throw new Error('STRAVA_CLIENT_ID is not configured')
  }

  // Generate a random state value for security
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);

  // Make sure the redirect URI is properly set for the environment
  const redirectUri = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/api/strava/callback'
    : 'https://aivery2.vercel.app/api/strava/callback';

  console.log('Creating Strava auth URL with:', {
    clientId: STRAVA_CONFIG.clientId,
    redirect_uri: redirectUri,
    environment: process.env.NODE_ENV || 'unknown'
  });

  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: STRAVA_CONFIG.scopes.join(','),
    approval_prompt: 'force',
    state: state
  });

  const authUrl = `${STRAVA_CONFIG.authUrl}?${params.toString()}`;
  console.log('Generated Strava auth URL:', authUrl.split('?')[0] + '?...');
  
  return authUrl;
}

export async function exchangeCodeForToken(code: string) {
  if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
    throw new Error('Strava credentials are not configured')
  }

  // Create form data params
  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId,
    client_secret: STRAVA_CONFIG.clientSecret,
    code,
    grant_type: 'authorization_code'
  });

  // Log attempt with detailed info
  console.log('Attempting to exchange code for token:', {
    url: STRAVA_CONFIG.tokenUrl,
    client_id: STRAVA_CONFIG.clientId,
    has_client_secret: !!STRAVA_CONFIG.clientSecret,
    code_prefix: code.substring(0, 5) + '...',
    redirect_uri: STRAVA_CONFIG.redirectUri,
    environment: process.env.NODE_ENV || 'unknown',
    app_url: process.env.NEXT_PUBLIC_APP_URL || 'not set'
  });

  let retryCount = 0;
  const maxRetries = 2;
  const retryDelay = 1000; // 1 second delay between retries

  while (retryCount <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Let's try a direct POST to the correct Strava token endpoint
      const tokenEndpoint = 'https://www.strava.com/oauth/token';
      
      console.log(`Attempt ${retryCount + 1}/${maxRetries + 1} - Posting to token endpoint:`, tokenEndpoint);
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString(),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      // Get response text first to ensure we have it for error reporting
      const responseText = await response.text();
      
      // Debug log the raw response
      console.log('Strava token exchange raw response:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        let errorData;
        try {
          // Try to parse as JSON if possible
          errorData = JSON.parse(responseText);
        } catch (e) {
          // Not JSON, use text as is
          errorData = { error: responseText };
        }
        
        console.error('Strava token exchange error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          attempt: retryCount + 1,
          maxRetries: maxRetries
        });
        
        // Create specific error messages based on status code
        if (response.status === 400) {
          if (errorData.error === 'invalid_grant') {
            throw new Error('Invalid authorization code. The code may have expired or been used already.');
          } else {
            throw new Error(`Bad request: ${errorData.error || 'Invalid parameters'}`);
          }
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please check your Strava API credentials (Client ID and Client Secret).');
        } else if (response.status === 404) {
          if (retryCount < maxRetries) {
            console.log(`Strava API returned 404, retrying with different endpoint in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
            continue;
          } else {
            throw new Error(`Strava API endpoint not found (404). Please check if Strava's API endpoints have changed.`);
          }
        } else {
          throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText} - ${errorData.error || responseText}`);
        }
      }

      // Parse the successful response
      try {
        const data = JSON.parse(responseText);
        
        // Log successful token exchange (redacted)
        console.log('Strava token exchange successful:', {
          has_access_token: !!data.access_token,
          has_refresh_token: !!data.refresh_token,
          expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : 'missing',
          athlete_id: data.athlete?.id || 'missing'
        });
        
        // Validate the response has the expected fields
        if (!data.access_token || !data.refresh_token || !data.expires_at) {
          console.error('Strava token exchange returned incomplete data:', data);
          throw new Error('Received incomplete response from Strava API');
        }
        
        return data;
      } catch (parseError) {
        console.error('Failed to parse Strava token response:', parseError, responseText);
        throw new Error('Invalid response from Strava API');
      }
    } catch (error) {
      // Check if this is a timeout error
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        if (retryCount < maxRetries) {
          console.log(`Strava API request timed out, retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
          continue;
        } else {
          throw new Error(`Network timeout connecting to Strava API after ${maxRetries} attempts`);
        }
      }
      
      // Log network errors
      if (error && typeof error === 'object' && 
          ('name' in error) && 
          (error.name === 'TypeError' || error.name === 'NetworkError')) {
        console.error('Network error during token exchange:', error);
        
        if (retryCount < maxRetries) {
          console.log(`Network error, retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
          continue;
        } else {
          throw new Error(`Network error connecting to Strava after ${maxRetries} attempts: ${(error as Error).message}`);
        }
      }
      
      // Re-throw the error if it was already handled above or if we've exhausted retries
      throw error;
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw new Error(`Failed to exchange code for token after ${maxRetries} attempts`);
}

export async function refreshToken(refreshToken: string) {
  if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
    throw new Error('Strava credentials are not configured')
  }

  // Create form data params
  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId,
    client_secret: STRAVA_CONFIG.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  console.log('Refreshing token with data:', {
    client_id: STRAVA_CONFIG.clientId,
    has_client_secret: !!STRAVA_CONFIG.clientSecret,
    refresh_token: refreshToken.substring(0, 5) + '...',
    environment: process.env.NODE_ENV || 'unknown'
  });

  try {
    // Use the same direct endpoint that works for token exchange
    const tokenEndpoint = 'https://www.strava.com/oauth/token';
    
    console.log('Posting refresh token request to:', tokenEndpoint);
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava token refresh error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Log successful token refresh (redacted)
    console.log('Strava token refresh successful:', {
      has_access_token: !!data.access_token,
      has_refresh_token: !!data.refresh_token,
      expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : 'missing'
    });
    
    return data;
  } catch (error) {
    console.error('Error during token refresh:', error);
    throw error;
  }
} 