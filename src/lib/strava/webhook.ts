import { STRAVA_CONFIG } from './config';

// The verification token used in the webhook endpoint
export const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "aivery_strava_webhook_verify_token";

// URL for Strava push subscriptions API
const SUBSCRIPTION_URL = "https://www.strava.com/api/v3/push_subscriptions";

// Create a webhook subscription with Strava
export async function createWebhookSubscription() {
  try {
    console.log("Creating Strava webhook subscription");
    
    // First check if we already have an active subscription
    try {
      const existingSubscription = await getWebhookSubscription();
      if (existingSubscription) {
        console.log("Webhook subscription already exists:", existingSubscription);
        return existingSubscription;
      }
    } catch (error) {
      // If error is authentication related, we should stop here
      if (error instanceof Error && 
          (error.message.includes('credentials') || 
           error.message.includes('authentication') || 
           error.message.includes('401'))) {
        throw error;
      }
      // Otherwise continue to create a new subscription
      console.warn("Error checking existing subscriptions, will try to create a new one:", error);
    }
    
    // Validate required environment variables
    const callbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!callbackBaseUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL environment variable is not set");
    }
    
    // Validate Strava credentials
    const clientId = STRAVA_CONFIG.clientId;
    const clientSecret = STRAVA_CONFIG.clientSecret;
    
    if (!clientId || !clientSecret) {
      throw new Error("Strava API credentials (Client ID and Client Secret) are not properly configured");
    }
    
    // Validate URL is not localhost or is explicitly allowed for testing
    if (callbackBaseUrl.includes('localhost') && !process.env.ALLOW_LOCALHOST_WEBHOOK) {
      console.warn("Warning: Using localhost URL for Strava webhook. This will only work with proper tunneling (e.g., ngrok).");
      console.warn("Set ALLOW_LOCALHOST_WEBHOOK=true if you're using tunneling for testing.");
    }
    
    // Create new subscription
    const callbackUrl = `${callbackBaseUrl}/api/strava/webhook`;
    
    // Log request details
    console.log("Creating webhook subscription with params:", {
      url: SUBSCRIPTION_URL,
      client_id: clientId,
      callback_url: callbackUrl,
      verify_token: WEBHOOK_VERIFY_TOKEN,
      method: 'Direct URL request without URLSearchParams'
    });
    
    // Make a direct URL-encoded request
    // This approach avoids Content-Type header issues that can occur with URLSearchParams
    const url = `${SUBSCRIPTION_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&callback_url=${encodeURIComponent(callbackUrl)}&verify_token=${encodeURIComponent(WEBHOOK_VERIFY_TOKEN)}`;
    
    const response = await fetch(url, {
      method: 'POST'
    });
    
    // Get response text for error handling
    const responseText = await response.text();
    let responseData;
    
    try {
      // Try to parse as JSON if possible
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Not JSON, use text as is
      responseData = responseText;
    }
    
    if (!response.ok) {
      console.error("Failed to create webhook subscription:", {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      
      // Provide more helpful error message based on status code
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please check your Strava API credentials (Client ID and Client Secret)."
        );
      } else if (response.status === 400 && responseText.includes("not verifiable")) {
        throw new Error(
          "Strava could not verify the callback URL. Make sure your app is publicly accessible. " +
          "For local development, use ngrok or similar service to expose your local server to the internet. " +
          "See README.md for instructions on setting up ngrok."
        );
      } else if (response.status === 403) {
        throw new Error(
          "Strava API access forbidden. Please check your API application permissions and scopes."
        );
      }
      
      throw new Error(`Failed to create webhook subscription: ${response.status} ${responseText}`);
    }
    
    const subscription = responseData;
    console.log("Webhook subscription created successfully:", subscription);
    
    return subscription;
  } catch (error) {
    console.error("Error creating webhook subscription:", error);
    throw error;
  }
}

// Get current webhook subscription status
export async function getWebhookSubscription() {
  try {
    // Check if client ID and client secret are available
    if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
      console.error("Missing Strava credentials:", {
        hasClientId: !!STRAVA_CONFIG.clientId,
        hasClientSecret: !!STRAVA_CONFIG.clientSecret
      });
      throw new Error("Strava credentials are not configured");
    }

    console.log("Getting webhook subscriptions with params:", {
      url: SUBSCRIPTION_URL,
      clientId: STRAVA_CONFIG.clientId,
      hasClientSecret: !!STRAVA_CONFIG.clientSecret
    });
    
    const params = new URLSearchParams({
      client_id: STRAVA_CONFIG.clientId as string,
      client_secret: STRAVA_CONFIG.clientSecret as string
    });
    
    const response = await fetch(`${SUBSCRIPTION_URL}?${params.toString()}`, {
      method: 'GET'
    });
    
    console.log("Webhook subscription response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    // Get response text for error handling
    const responseText = await response.text();
    let responseData;
    
    try {
      // Try to parse as JSON if possible
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Not JSON, use text as is
      responseData = { error: responseText };
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        // No subscriptions found
        return null;
      }
      
      console.error("Failed to get webhook subscriptions:", {
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        clientId: STRAVA_CONFIG.clientId
      });
      
      // Provide more helpful error message based on status code
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please check your Strava API credentials (Client ID and Client Secret)."
        );
      } else if (response.status === 403) {
        throw new Error(
          "Strava API access forbidden. Please check your API application permissions and scopes."
        );
      }
      
      throw new Error(`Failed to get webhook subscriptions: ${response.status} ${responseText}`);
    }
    
    // Return the first subscription if any exist
    return responseData && Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : null;
  } catch (error) {
    console.error("Error getting webhook subscription:", error);
    throw error;
  }
}

// Delete a webhook subscription
export async function deleteWebhookSubscription(id: number) {
  try {
    // Validate Strava credentials
    if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
      throw new Error("Strava API credentials (Client ID and Client Secret) are not properly configured");
    }
    
    console.log(`Deleting webhook subscription ${id}`);
    
    const params = new URLSearchParams({
      client_id: STRAVA_CONFIG.clientId as string,
      client_secret: STRAVA_CONFIG.clientSecret as string
    });
    
    const response = await fetch(`${SUBSCRIPTION_URL}/${id}?${params.toString()}`, {
      method: 'DELETE'
    });
    
    // Get response text for error handling
    const responseText = await response.text();
    let responseData;
    
    try {
      // Try to parse as JSON if possible
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Not JSON, use text as is
      responseData = { text: responseText };
    }
    
    if (!response.ok) {
      console.error(`Failed to delete webhook subscription ${id}:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      
      // Provide more helpful error message based on status code
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please check your Strava API credentials (Client ID and Client Secret)."
        );
      } else if (response.status === 403) {
        throw new Error(
          "Strava API access forbidden. Please check your API application permissions and scopes."
        );
      } else if (response.status === 404) {
        throw new Error(`Webhook subscription ${id} not found. It may have been already deleted.`);
      }
      
      throw new Error(`Failed to delete webhook subscription: ${response.status} ${responseText}`);
    }
    
    console.log(`Webhook subscription ${id} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting webhook subscription ${id}:`, error);
    throw error;
  }
} 