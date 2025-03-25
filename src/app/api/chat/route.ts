import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { getWorkoutById, getPreviousWorkouts, getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongoose"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"

// Allow responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, workoutId } = await req.json()
  
  // Get current user
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  
  // Store the chat messages in the database for persistence
  if (userId && messages.length > 0) {
    try {
      await dbConnect()
      const chatCollection = await getCollection("aivery", "chats")
      
      // Store only the most recent user message
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "user") {
        await chatCollection.insertOne({
          userId: new ObjectId(userId),
          content: lastMessage.content,
          role: lastMessage.role,
          workoutId: workoutId ? new ObjectId(workoutId) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    } catch (error) {
      console.error("Error storing chat message:", error)
    }
  }
  
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
  // If user is authenticated, fetch their recent workouts for context
  else if (userId) {
    try {
      // Use direct database access to ensure we have the freshest data
      const workoutsCollection = await getCollection("aivery", "workouts")
      const recentWorkouts = await workoutsCollection
        .find({ userId: new ObjectId(userId) })
        .sort({ date: -1 })
        .limit(5)
        .toArray()
      
      if (recentWorkouts.length > 0) {
        // Sort workouts by date (newest first)
        const sortedWorkouts = recentWorkouts.sort((a, b) => 
          new Date(b.date as any).getTime() - new Date(a.date as any).getTime()
        )
        
        // Get the most recent workout
        const latestWorkout = sortedWorkouts[0]
        const latestWorkoutDate = new Date(latestWorkout.date as any).toLocaleDateString()
        const isToday = new Date(latestWorkout.date as any).toDateString() === new Date().toDateString()
        
        systemPrompt += `
          The user has ${recentWorkouts.length} recent workouts in the system.
          
          Their most recent workout was on ${latestWorkoutDate}${isToday ? " (today)" : ""}.
          Recent workout details:
          - Name: ${latestWorkout.name || latestWorkout.type}
          - Type: ${latestWorkout.type}
          - Duration: ${latestWorkout.duration} minutes
          - Intensity: ${latestWorkout.intensity}
          ${latestWorkout.exercises ? `- Exercises: ${latestWorkout.exercises.map((ex: any) => ex.name).join(", ")}` : ""}
          
          If the user asks about their recent workout, gym session, training session, or how they did today, refer to this information.
          If they mention "gym", "workout", or "training" specifically, you should assume they're referring to their most recent workout.
          Don't explicitly state you have this data - use it naturally in your response.
          Be encouraging about their progress and suggest relevant improvements.
          
          If the workout name is "Gym" or includes "gym", it's a general strength training session at the gym.
        `
        
        // Add summary of workout history
        const workoutTypes = sortedWorkouts.map(w => w.type as string)
        const uniqueTypes = Array.from(new Set(workoutTypes))
        const typeCounts = uniqueTypes.map(type => ({
          type,
          count: workoutTypes.filter(t => t === type).length
        }))
        
        systemPrompt += `
          Workout history summary:
          ${typeCounts.map(tc => `- ${tc.count} ${tc.type} workouts`).join("\n")}
          
          Use this history to provide contextually relevant advice and motivation.
        `
        
        // Fetch previous chat history for context
        try {
          const chatCollection = await getCollection("aivery", "chats")
          const chatHistory = await chatCollection
            .find({ userId: new ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray()
            
          if (chatHistory.length > 0) {
            systemPrompt += `
              Recent conversation history with this user:
              ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join("\n")}
              
              Use this to maintain context and provide consistent advice.
            `
          }
        } catch (error) {
          console.error("Error fetching chat history:", error)
        }
      }
    } catch (error) {
      console.error("Error fetching user's recent workouts:", error)
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

