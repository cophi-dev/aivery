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
    const existingSubscription = await getWebhookSubscription();
    if (existingSubscription) {
      console.log("Webhook subscription already exists:", existingSubscription);
      return existingSubscription;
    }
    
    // Validate required environment variables
    const callbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!callbackBaseUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL environment variable is not set");
    }
    
    // Validate URL is not localhost or is explicitly allowed for testing
    if (callbackBaseUrl.includes('localhost') && !process.env.ALLOW_LOCALHOST_WEBHOOK) {
      console.warn("Warning: Using localhost URL for Strava webhook. This will only work with proper tunneling (e.g., ngrok).");
      console.warn("Set ALLOW_LOCALHOST_WEBHOOK=true if you're using tunneling for testing.");
    }
    
    // Create new subscription
    const callbackUrl = `${callbackBaseUrl}/api/strava/webhook`;
    
    // Prepare the form data parameters
    const clientId = STRAVA_CONFIG.clientId as string;
    const clientSecret = STRAVA_CONFIG.clientSecret as string;
    
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to create webhook subscription:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Provide more helpful error message for common issues
      if (response.status === 400 && errorText.includes("not verifiable")) {
        throw new Error(
          "Strava could not verify the callback URL. Make sure your app is publicly accessible. " +
          "For local development, use ngrok or similar service to expose your local server to the internet. " +
          "See README.md for instructions on setting up ngrok."
        );
      }
      
      throw new Error(`Failed to create webhook subscription: ${response.status} ${errorText}`);
    }
    
    const subscription = await response.json();
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
    
    if (!response.ok) {
      if (response.status === 404) {
        // No subscriptions found
        return null;
      }
      
      const errorText = await response.text();
      console.error("Failed to get webhook subscriptions:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        clientId: STRAVA_CONFIG.clientId
      });
      throw new Error(`Failed to get webhook subscriptions: ${response.status} ${errorText}`);
    }
    
    const subscriptions = await response.json();
    console.log("Received webhook subscriptions:", subscriptions);
    
    // Return the first subscription if any exist
    return subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
  } catch (error) {
    console.error("Error getting webhook subscription:", error);
    throw error;
  }
}

// Delete a webhook subscription
export async function deleteWebhookSubscription(id: number) {
  try {
    const params = new URLSearchParams({
      client_id: STRAVA_CONFIG.clientId as string,
      client_secret: STRAVA_CONFIG.clientSecret as string
    });
    
    const response = await fetch(`${SUBSCRIPTION_URL}/${id}?${params.toString()}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete webhook subscription: ${response.status} ${errorText}`);
    }
    
    console.log(`Webhook subscription ${id} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting webhook subscription ${id}:`, error);
    throw error;
  }
} 