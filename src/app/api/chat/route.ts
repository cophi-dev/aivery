import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import User from "@/lib/db/models/user"; // Assuming User model is needed for personalization
import dbConnect from "@/lib/db/mongodb"; // If needed for user lookup

// Force dynamic rendering and prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Initialize the Anthropic SDK
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Allow responses up to 30 seconds
export const maxDuration = 30;

// Helper function to safely extract text from Claude response content
function getTextFromResponse(content: any): string | undefined {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }
  const firstBlock = content[0];
  if (firstBlock && typeof firstBlock === "object" && "text" in firstBlock) {
    return firstBlock.text as string;
  }
  return undefined;
}

// --- Main POST handler ---
export async function POST(req: Request) {
  let session;
  let userId: string | undefined;
  let userName: string | undefined = 'User';

  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("[CHAT] User not authenticated");
      return new Response("Authentication required", { status: 401 });
    }
    userId = session.user.id;
    userName = session.user.name || 'User'; // Get user name for personalization

    const body = await req.json();
    const currentQuery = body.query; // Assuming the new message is passed as 'query'
    const messageHistory = body.history || []; // Assuming history is passed as 'history'

    if (!currentQuery) {
      return new Response("Query is required", { status: 400 });
    }

    console.log(`[CHAT] Received query from user ${userId} (${userName}):`, currentQuery);

    // **Filter the history to exclude any system messages**
    const validHistory = messageHistory.filter(
      (msg: { role: string }) => msg.role === 'user' || msg.role === 'assistant'
    );

    // Combine valid history with the current user query
    const messagesForApi = [
        ...validHistory,
        { role: "user" as const, content: currentQuery }
    ];

    // **Define the system prompt here** 
    // (Combine any necessary instructions, context fetching logic would go here if needed)
    const systemPrompt = `Act as Aivery, a friendly and encouraging AI fitness coach. 
The user's name is ${userName}.
Keep responses concise and helpful, focusing on fitness, health, and wellness.
If asked about specific workout data, mention that functionality is under development or fetch/format data here if implemented.`;

    console.log("[CHAT] Calling Anthropic API...");
    // **Call Anthropic API with correct parameters**
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,      // Pass system prompt as top-level parameter
      messages: messagesForApi,  // Pass filtered user/assistant messages
    });

    const aiResponse = getTextFromResponse(response.content);
    console.log("[CHAT] AI Response generated.");

    return new Response(aiResponse || "Sorry, I couldn't generate a response.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error: any) {
    console.error("Chat API Error:", error); // Log the full error server-side
    
    let userErrorMessage = "Sorry, I encountered an error. Please try again.";
    let statusCode = 500;

    // Check for specific Anthropic errors if possible (structure might vary)
    if (error.status === 400 && error?.error?.type === 'invalid_request_error') {
       userErrorMessage = `There was an issue with the request format: ${error.error.message}`;
       statusCode = 400;
    } else if (error.status === 401 || error.status === 403) {
        userErrorMessage = "There seems to be an authentication issue with the AI service.";
        statusCode = error.status;
    } else if (error.status === 429) {
        userErrorMessage = "The AI service is experiencing high traffic. Please try again shortly.";
        statusCode = 429;
    }
    // Avoid exposing potentially sensitive details from generic errors
    if (userErrorMessage.includes('API key') || userErrorMessage.includes('Anthropic')) {
         userErrorMessage = "An unexpected error occurred while communicating with the AI service.";
    }

    return new Response(userErrorMessage, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: statusCode, 
    });
  }
}

// Removed complex helper functions like processAIDataRequest, fetchDataBasedOnAnalysis etc. 
// Removed workoutRepository imports as data fetching logic is simplified/removed for now
// Removed workout-analysis imports
