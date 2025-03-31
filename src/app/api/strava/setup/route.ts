import { NextRequest, NextResponse } from "next/server";
import { createWebhookSubscription, getWebhookSubscription, deleteWebhookSubscription } from "@/lib/strava/webhook";

// A simple secret key to prevent unauthorized access
// In a real app, use a proper authentication system
const ADMIN_KEY = process.env.ADMIN_API_KEY || "aivery_admin_key";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action") || "status";

    // Get current subscription status
    if (action === "status") {
      const subscription = await getWebhookSubscription();
      return NextResponse.json({
        success: true,
        subscribed: !!subscription,
        subscription,
      });
    }

    // Create new subscription
    if (action === "create") {
      const subscription = await createWebhookSubscription();
      return NextResponse.json({
        success: true,
        message: "Webhook subscription created",
        subscription,
      });
    }

    // Delete existing subscription
    if (action === "delete") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Subscription ID is required" },
          { status: 400 }
        );
      }

      await deleteWebhookSubscription(parseInt(id));
      return NextResponse.json({
        success: true,
        message: "Webhook subscription deleted",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in Strava setup:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
} 