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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava token exchange error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error during token exchange:', error);
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