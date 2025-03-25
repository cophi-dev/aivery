import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { getWorkoutById, getPreviousWorkouts } from "@/lib/db/repositories/workoutRepository"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Allow responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, workoutId } = await req.json()

  // Base system prompt for fitness coaching - more conversational and concise
  let systemPrompt = `
    You are Aivery, a friendly and encouraging AI fitness coach.
    Respond in a conversational, concise manner like a real trainer would talk to their client.
    Keep responses brief (under 150 words when possible) and focus on practical, actionable advice.
    Avoid using technical language unless necessary.
    Use a friendly, motivational tone without being overly formal.
    Current date: ${new Date().toLocaleDateString()}
  `

  // If a workout ID is provided, fetch the workout data and enhance the system prompt
  if (workoutId) {
    try {
      const workout = await getWorkoutById(workoutId)
      if (workout) {
        // Get previous workouts of the same type for comparison
        const previousWorkouts = await getPreviousWorkouts(
          workout.userId,
          workout.name || workout.type, // Fallback to type if name is not available
          new Date(workout.date),
          3
        )

        systemPrompt += `
          The user is asking about their ${workout.name || workout.type} workout from ${new Date(workout.date).toLocaleDateString()}.
          
          Quick workout summary:
          - Duration: ${workout.duration} minutes
          - Intensity: ${workout.intensity}
          - Type: ${workout.type || "strength"}
          ${workout.volume ? `- Volume: ${workout.volume} kg` : ""}
          ${workout.distance ? `- Distance: ${workout.distance} km` : ""}
          
          ${workout.exercises ? `Exercises: ${workout.exercises.map((ex: any) => ex.name).join(", ")}` : "No exercise data available"}
          
          When analyzing, be concise and conversational. Avoid numbered lists and formal analysis structure.
          Focus on 1-2 key observations and 1-2 specific improvement suggestions.
          Keep your total response under 200 words.
        `

        // Add previous workout data if available
        if (previousWorkouts.length > 0) {
          systemPrompt += `
            You have access to previous similar workouts, but don't explicitly mention this data.
            Use it to naturally comment on progress or trends you notice.
          `
        }
      }
    } catch (error) {
      console.error("Error fetching workout for AI analysis:", error)
    }
  }

  // Add user stats - simplified
  systemPrompt += `
    The user is a 32-year-old intermediate lifter looking to build muscle and improve strength.
  `

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: systemPrompt,
  })

  return result.toDataStreamResponse()
}

