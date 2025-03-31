export const STRAVA_CONFIG = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  redirectUri: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/strava/callback'
    : `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`,
  scopes: ['read', 'activity:read_all'],
  authUrl: 'https://www.strava.com/oauth/authorize',
  tokenUrl: 'https://www.strava.com/oauth/token',
  apiUrl: 'https://www.strava.com/api/v3'
}

export function getStravaAuthUrl() {
  if (!STRAVA_CONFIG.clientId) {
    throw new Error('STRAVA_CLIENT_ID is not configured')
  }

  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId,
    redirect_uri: STRAVA_CONFIG.redirectUri,
    response_type: 'code',
    scope: STRAVA_CONFIG.scopes.join(','),
    approval_prompt: 'force'
  })

  return `${STRAVA_CONFIG.authUrl}?${params.toString()}`
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

  console.log('Exchanging code for token with data:', {
    url: STRAVA_CONFIG.tokenUrl,
    client_id: STRAVA_CONFIG.clientId,
    // Hide secret
    has_client_secret: !!STRAVA_CONFIG.clientSecret,
    code: code.substring(0, 5) + '...'
  });

  try {
    const response = await fetch(STRAVA_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    // Get response text first to ensure we have it for error reporting
    const responseText = await response.text();
    
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
        error: errorData
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
      } else {
        throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText} - ${errorData.error || responseText}`);
      }
    }

    // Parse the successful response
    try {
      const data = JSON.parse(responseText);
      
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
    // Log network errors
    if (error && typeof error === 'object' && 
        ('name' in error) && 
        (error.name === 'TypeError' || error.name === 'NetworkError')) {
      console.error('Network error during token exchange:', error);
      throw new Error(`Network error connecting to Strava: ${(error as Error).message}`);
    }
    
    // Re-throw the error if it was already handled above
    throw error;
  }
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
    url: STRAVA_CONFIG.tokenUrl,
    client_id: STRAVA_CONFIG.clientId,
    // Hide sensitive info
    has_client_secret: !!STRAVA_CONFIG.clientSecret,
    refresh_token: refreshToken.substring(0, 5) + '...'
  });

  try {
    const response = await fetch(STRAVA_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
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

    return response.json();
  } catch (error) {
    console.error('Error during token refresh:', error);
    throw error;
  }
} 