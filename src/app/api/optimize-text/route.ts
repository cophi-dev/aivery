import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { getTextFromResponse } from "@/lib/utils";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    // Determine the appropriate prompt based on field
    let systemPrompt =
      "You are an expert fitness coach and AI assistant helping optimize user input.";

    if (field === "trainingPreferences") {
      systemPrompt += `
Your task is to enhance and structure the user's training preferences into a natural conversational paragraph.
- Write from the user's first-person perspective
- ONLY use details the user has explicitly mentioned - DO NOT invent or add new information
- Focus on making their actual preferences more clear and structured
- Keep it personal and conversational in tone
- Be concise and clear
- DO NOT add generic motivational statements at the end
- DO NOT repeat context information (age, location, weight, etc.) that's already provided separately in the context
- Format as a clean, simple statement without unnecessary embellishment`;
    } else if (field === "fitnessGoals") {
      systemPrompt += `
Your task is to enhance and structure the user's fitness goals into a natural conversational paragraph.
- Write from the user's first-person perspective
- ONLY use goals the user has explicitly mentioned - DO NOT invent or add new goals
- Make existing goals more specific and measureable if possible
- If they mention dates or timeframes, preserve those exactly
- Keep it personal and conversational in tone
- Be concise and clear
- DO NOT add generic motivational statements at the end
- DO NOT repeat context information (age, location, weight, etc.) that's already provided separately in the context
- Format as a clean, simple statement without unnecessary embellishment`;
    } else if (field === "dietaryPreferences") {
      systemPrompt += `
Your task is to enhance and structure the user's dietary preferences into a natural conversational paragraph.
- Write from the user's first-person perspective
- ONLY use preferences the user has explicitly mentioned - DO NOT invent or add new dietary habits
- Keep it personal and conversational in tone
- Be concise and clear
- DO NOT add generic health statements at the end
- DO NOT repeat context information (age, location, weight, etc.) that's already provided separately in the context
- Format as a clean, simple statement without unnecessary embellishment`;
    }

    // Add context information if available
    let userPrompt = `Optimize this ${field} information: "${text}"`;

    if (context) {
      userPrompt += `\n\nRelevant user context:`;
      if (context.height) userPrompt += `\n- Height: ${context.height}cm`;
      if (context.weight) userPrompt += `\n- Weight: ${context.weight}kg`;
      if (context.age) userPrompt += `\n- Age: ${context.age}`;
      if (context.gender) userPrompt += `\n- Gender: ${context.gender}`;
      if (context.activityLevel)
        userPrompt += `\n- Activity level: ${context.activityLevel}`;
      if (context.location) userPrompt += `\n- Location: ${context.location}`;
      if (context.units) userPrompt += `\n- Preferred units: ${context.units}`;
    }

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract and return the optimized text
    const optimizedText = getTextFromResponse(response.content) || text;

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
