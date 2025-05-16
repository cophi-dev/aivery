import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// import Anthropic from "@anthropic-ai/sdk"; // REMOVED
import { getTextFromResponse } from "@/lib/utils";

// Initialize Anthropic client // REMOVED
// const anthropic = new Anthropic({ // REMOVED
//   apiKey: process.env.ANTHROPIC_API_KEY, // REMOVED
// }); // REMOVED

// Allow responses up to 10 seconds
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    // Check authentication with better error handling
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error(
        "Authentication failed: No session or user found in optimize-text route",
      );
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Ensure Grok API key is available
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      console.error("[optimize-text] GROK_API_KEY not configured.");
      // Return the original text if AI is unavailable
      const { text } = await request.json(); // Need to parse here to get original text
      return NextResponse.json({ optimizedText: text });
    }

    // Parse request body
    const data = await request.json();
    const { text, field, context } = data;

    if (!text || !field) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(
      `Optimizing ${field} for user ${session.user.email || session.user.id}`,
    );

    // --- Refactored: Concise Prompt Construction ---
    let systemPrompt =
      "You are an expert fitness coach. Rewrite the user's input as a clear, first-person, conversational paragraph. Only use details the user provided. Do not invent, add, or repeat context. Be concise. No generic advice or motivational statements.";

    // Add a field-specific instruction if needed
    if (field === "trainingPreferences") {
      systemPrompt += " Focus on training style, frequency, and environment.";
    } else if (field === "fitnessGoals") {
      systemPrompt += " Focus on making goals specific and measurable if possible.";
    } else if (field === "dietaryPreferences") {
      systemPrompt += " Focus on dietary restrictions, preferences, or nutrition goals.";
    }

    // User prompt: just the raw text
    let userPrompt = text;
    // Optionally, add context if available and not empty
    if (context && Object.keys(context).length > 0) {
      userPrompt += "\n\nContext:";
      if (context.height) userPrompt += ` Height: ${context.height}cm.`;
      if (context.weight) userPrompt += ` Weight: ${context.weight}kg.`;
      if (context.age) userPrompt += ` Age: ${context.age}.`;
      if (context.gender) userPrompt += ` Gender: ${context.gender}.`;
      if (context.activityLevel) userPrompt += ` Activity level: ${context.activityLevel}.`;
      if (context.location) userPrompt += ` Location: ${context.location}.`;
      if (context.units) userPrompt += ` Units: ${context.units}.`;
    }

    // Call Grok API
    // const response = await anthropic.messages.create({ // REMOVED
    //   model: "claude-3-5-haiku-20241022", // REMOVED
    //   max_tokens: 500, // REMOVED
    //   temperature: 0.7, // REMOVED
    //   system: systemPrompt, // REMOVED
    //   messages: [{ role: "user", content: userPrompt }], // REMOVED
    // }); // REMOVED

    const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400, // Lowered to further reduce risk of hitting limit
        temperature: 0.7,
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[optimize-text] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
      // Return original text on error
      return NextResponse.json({ optimizedText: text });
    }

    const apiResponseData = await fetchResponse.json();
    console.log("[optimize-text] Grok Raw Response:", apiResponseData);

    // Extract and return the optimized text
    // const optimizedText = getTextFromResponse(response.content) || text; // REMOVED
    let optimizedText = text; // Default to original text
    if (
      apiResponseData.choices &&
      apiResponseData.choices[0] &&
      apiResponseData.choices[0].message &&
      apiResponseData.choices[0].message.content &&
      apiResponseData.choices[0].message.content.trim().length > 0
    ) {
      optimizedText = apiResponseData.choices[0].message.content.trim();
    } else {
      console.warn("[optimize-text] No completion returned from Grok:", apiResponseData);
      return NextResponse.json({ error: "AI did not return an optimized result. Please try again or rephrase your input." }, { status: 502 });
    }

    // Clean up any introductory text patterns that shouldn't be shown to the user
    const cleanedText = optimizedText
      .replace(/^Here is an optimized (training preferences|fitness goal|dietary preferences) (paragraph|statement) based on the information you provided:\s*/i, '')
      .replace(/^"(.+)"$/, '$1') // Remove any surrounding quotes if present
      .trim();

    return NextResponse.json({ optimizedText: cleanedText });
  } catch (error) {
    console.error("Error optimizing text:", error);
    return NextResponse.json(
      { error: "Failed to optimize text" },
      { status: 500 },
    );
  }
}
