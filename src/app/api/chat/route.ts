import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { 
  getWorkoutById, 
  getPreviousWorkouts, 
  getWorkoutsByUserId, 
  getMonthlyWorkoutDistanceByType,
  getWorkoutDistanceForDateRange,
  getMonthlyWorkoutDurationByType,
  getWorkoutDurationForDateRange,
  getWorkoutNotesByType,
  getTotalDistanceByType,
  getWorkoutTypeStats
} from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongoose"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"

// Allow responses up to 30 seconds
export const maxDuration = 30

// Helper function to calculate total weight lifted for strength workouts
function calculateTotalWeightLifted(workout: any): number {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0
  }
  
  return workout.exercises.reduce((total: number, exercise: any) => {
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      return total
    }
    
    const exerciseTotal = exercise.sets.reduce((setTotal: number, set: any) => {
      return setTotal + (set.weight || 0) * (set.reps || 0)
    }, 0)
    
    return total + exerciseTotal
  }, 0)
}

// Add after imports
interface WorkoutQuery {
  type: 'distance' | 'pace' | 'duration' | 'stats' | 'progress' | 'general';
  timeframe?: 'all' | 'year' | 'month' | 'week' | 'recent';
  workoutType?: string;
  specific?: string;
}

// Add before POST function
function analyzeWorkoutQuery(message: string): WorkoutQuery {
  const msg = message.toLowerCase();
  
  // Initialize query object
  const query: WorkoutQuery = {
    type: 'general'
  };

  // Detect workout type
  if (msg.includes('run') || msg.includes('running')) {
    query.workoutType = 'running';
  } else if (msg.includes('swim') || msg.includes('swimming')) {
    query.workoutType = 'swimming';
  } else if (msg.includes('cycl') || msg.includes('bike') || msg.includes('biking')) {
    query.workoutType = 'cycling';
  } else if (msg.includes('strength') || msg.includes('gym') || msg.includes('weight')) {
    query.workoutType = 'strength';
  }

  // Detect query type - enhance pace detection
  if (msg.includes('pace') || msg.includes('fastest') || msg.includes('speed') || msg.includes('quick')) {
    query.type = 'pace';
    if (msg.includes('fastest') || msg.includes('best') || msg.includes('quickest')) {
      query.specific = 'fastest';
    }
  } else if (msg.includes('distance') || msg.includes('far') || msg.includes('km') || msg.includes('kilometers')) {
    query.type = 'distance';
  } else if (msg.includes('time') || msg.includes('long') || msg.includes('duration')) {
    query.type = 'duration';
  } else if (msg.includes('stats') || msg.includes('statistics')) {
    query.type = 'stats';
  } else if (msg.includes('progress') || msg.includes('improve') || msg.includes('better')) {
    query.type = 'progress';
  }

  // Detect timeframe
  if (msg.includes('all time') || msg.includes('total') || msg.includes('ever')) {
    query.timeframe = 'all';
  } else if (msg.includes('this year') || msg.includes('year')) {
    query.timeframe = 'year';
  } else if (msg.includes('this month') || msg.includes('month')) {
    query.timeframe = 'month';
  } else if (msg.includes('this week') || msg.includes('week')) {
    query.timeframe = 'week';
  } else if (msg.includes('recent') || msg.includes('latest') || msg.includes('last')) {
    query.timeframe = 'recent';
  }

  // Detect specific queries
  if (msg.includes('longest')) {
    query.specific = 'longest';
  } else if (msg.includes('average') || msg.includes('avg')) {
    query.specific = 'average';
  }

  return query;
}

export async function POST(req: Request) {
  const { messages, workoutId } = await req.json()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const userId = session.user.id
    
    // Analyze the latest user query
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()
    const queryAnalysis = lastUserMessage ? analyzeWorkoutQuery(lastUserMessage.content) : null
    
    // Get data based on query analysis
    let queryContext = ""
    if (queryAnalysis && queryAnalysis.workoutType) {
      const stats = await getWorkoutTypeStats(userId, queryAnalysis.workoutType)
      
      if (queryAnalysis.type === 'distance') {
        if (queryAnalysis.timeframe === 'all') {
          queryContext = `
            For your ${queryAnalysis.workoutType} workouts:
            - Total distance: ${stats.totalDistance.toFixed(2)} km
            - Total sessions: ${stats.totalSessions}
            - Average distance per session: ${stats.averageDistance?.toFixed(2)} km
            - Total time: ${stats.totalDuration} minutes
          `
        } else if (queryAnalysis.specific === 'longest') {
          queryContext = `
            Your longest ${queryAnalysis.workoutType}:
            - Distance: ${stats.longestSession?.distance.toFixed(2)} km
            - Date: ${stats.longestSession ? new Date(stats.longestSession.date).toLocaleDateString() : 'N/A'}
            - Duration: ${stats.longestSession?.duration} minutes
          `
        }
      } else if (queryAnalysis.type === 'pace') {
        if (stats.fastestSession && stats.fastestSession.date) {
          const date = new Date(stats.fastestSession.date).toLocaleDateString()
          const pace = stats.fastestPace?.toFixed(2)
          const distance = stats.fastestSession.distance.toFixed(2)
          const duration = stats.fastestSession.duration
          
          queryContext = `
            Your fastest ${queryAnalysis.workoutType} was on ${date}:
            - Pace: ${pace} min/km
            - Distance: ${distance} km
            - Duration: ${duration} minutes
            
            This is your current record pace. For comparison:
            - Your average pace is ${stats.averagePace?.toFixed(2)} min/km
            - Your average distance per session is ${stats.averageDistance?.toFixed(2)} km
          `
        } else {
          queryContext = `I don't have enough data to determine your fastest ${queryAnalysis.workoutType} pace yet.`
        }
      } else if (queryAnalysis.type === 'duration') {
        queryContext = `
          Your ${queryAnalysis.workoutType} duration stats:
          - Total time: ${stats.totalDuration} minutes
          - Average session duration: ${stats.averageDuration?.toFixed(0)} minutes
          - Total sessions: ${stats.totalSessions}
        `
      } else if (queryAnalysis.type === 'stats') {
        queryContext = `
          ${queryAnalysis.workoutType.charAt(0).toUpperCase() + queryAnalysis.workoutType.slice(1)} Statistics:
          - Total sessions: ${stats.totalSessions}
          - Total distance: ${stats.totalDistance.toFixed(2)} km
          - Total time: ${stats.totalDuration} minutes
          - Average distance per session: ${stats.averageDistance?.toFixed(2)} km
          - Average duration: ${stats.averageDuration?.toFixed(0)} minutes
          ${stats.averagePace ? `- Average pace: ${stats.averagePace.toFixed(2)} min/km` : ''}
          ${stats.fastestPace ? `- Best pace: ${stats.fastestPace.toFixed(2)} min/km` : ''}
        `
      }
    }

    // Get recent workouts and stats for general context
    const [recentWorkouts, runningStats] = await Promise.all([
      getWorkoutsByUserId(userId, 10),
      getWorkoutTypeStats(userId, 'running') // Keep running stats for backward compatibility
    ])

    // Build context about user's workouts
    let workoutContext = "Here's what I know about your workouts:\n"
    
    if (recentWorkouts.length > 0) {
      workoutContext += `- You've logged ${recentWorkouts.length} workouts recently\n`
      
      // Add running specific stats if available
      if (runningStats.totalSessions > 0) {
        workoutContext += `
          Running Statistics:
          - Total sessions: ${runningStats.totalSessions}
          - Total distance: ${runningStats.totalDistance.toFixed(2)} km
          - Average distance per session: ${runningStats.averageDistance?.toFixed(2)} km
          ${runningStats.fastestPace ? `- Fastest pace: ${runningStats.fastestPace.toFixed(2)} min/km${runningStats.fastestSession?.date ? ` (${new Date(runningStats.fastestSession.date).toLocaleDateString()})` : ''}` : ''}
          ${runningStats.longestSession ? `- Longest session: ${runningStats.longestSession.distance.toFixed(2)} km${runningStats.longestSession.date ? ` (${new Date(runningStats.longestSession.date).toLocaleDateString()})` : ''}` : ''}
          ${runningStats.averagePace ? `- Average pace: ${runningStats.averagePace.toFixed(2)} min/km` : ''}
        `
      }
      
      // Add workout type breakdown
      const workoutTypes = new Set(recentWorkouts.map(w => w.type))
      workoutContext += `- Your recent workouts include: ${Array.from(workoutTypes).join(", ")}\n`
    } else {
      workoutContext += "- You haven't logged any workouts yet\n"
    }

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

          // Add workout-specific details based on type
          if (workout.type === "strength") {
            // Calculate total weight lifted for strength workouts
            const totalWeightLifted = calculateTotalWeightLifted(workout);
            
            systemPrompt += `
              The user is asking about their ${workout.name || workout.type} workout from ${new Date(workout.date).toLocaleDateString()}.
              
              Quick workout summary:
              - Duration: ${workout.duration} minutes
              - Intensity: ${workout.intensity}
              - Type: ${workout.type || "strength"}
              ${workout.volume ? `- Volume: ${workout.volume} kg` : ""}
              ${totalWeightLifted > 0 ? `- Total weight moved: ${totalWeightLifted} kg` : ""}
              
              ${workout.exercises ? `Exercises: ${workout.exercises.map((ex: any) => ex.name).join(", ")}` : "No exercise data available"}
              
              When analyzing, be concise and conversational. Avoid numbered lists and formal analysis structure.
              Focus on 1-2 key observations and 1-2 specific improvement suggestions.
              Keep your total response under 200 words.
            `
          } else if (["running", "swimming", "cycling"].includes(workout.type)) {
            // Handle cardio workout details
            const distance = workout.distance || (workout.cardioDetails?.distance) || null;
            
            systemPrompt += `
              The user is asking about their ${workout.name || workout.type} workout from ${new Date(workout.date).toLocaleDateString()}.
              
              Quick workout summary:
              - Duration: ${workout.duration} minutes
              - Intensity: ${workout.intensity}
              - Type: ${workout.type}
              ${distance ? `- Distance: ${distance} km` : "- Distance: Not recorded"}
              
              ${workout.exercises ? `Exercises: ${workout.exercises.map((ex: any) => ex.name).join(", ")}` : "No exercise data available"}
              
              When analyzing, be concise and conversational. Avoid numbered lists and formal analysis structure.
              Focus on 1-2 key observations and 1-2 specific improvement suggestions.
              Keep your total response under 200 words.
            `
          } else {
            // Default for other workout types
            systemPrompt += `
              The user is asking about their ${workout.name || workout.type} workout from ${new Date(workout.date).toLocaleDateString()}.
              
              Quick workout summary:
              - Duration: ${workout.duration} minutes
              - Intensity: ${workout.intensity}
              - Type: ${workout.type || "strength"}
              ${workout.volume ? `- Volume: ${workout.volume} kg` : ""}
              
              ${workout.exercises ? `Exercises: ${workout.exercises.map((ex: any) => ex.name).join(", ")}` : "No exercise data available"}
              
              When analyzing, be concise and conversational. Avoid numbered lists and formal analysis structure.
              Focus on 1-2 key observations and 1-2 specific improvement suggestions.
              Keep your total response under 200 words.
            `
          }

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

          // Prepare workout information based on type
          let workoutDetails = "";
          
          if (latestWorkout.type === "strength") {
            // Calculate total weight for strength workouts
            const totalWeightLifted = calculateTotalWeightLifted(latestWorkout);
            workoutDetails = `
              ${totalWeightLifted > 0 ? `- Total weight moved: ${totalWeightLifted.toFixed(1)} kg` : ""}
              ${latestWorkout.volume ? `- Volume: ${latestWorkout.volume} kg` : ""}
              ${latestWorkout.exercises ? `- Exercises: ${latestWorkout.exercises.map((ex: any) => ex.name).join(", ")}` : ""}
            `;
          } else if (["running", "swimming", "cycling"].includes(latestWorkout.type)) {
            // Handle cardio workout details
            const distance = latestWorkout.distance || (latestWorkout.cardioDetails?.distance) || null;
            workoutDetails = `
              ${distance ? `- Distance: ${distance} km` : "- Distance: Not recorded"}
            `;
          }
          
          systemPrompt += `
            The user has ${recentWorkouts.length} recent workouts in the system.
            
            Their most recent workout was on ${latestWorkoutDate}${isToday ? " (today)" : ""}.
            Recent workout details:
            - Name: ${latestWorkout.name || latestWorkout.type}
            - Type: ${latestWorkout.type}
            - Duration: ${latestWorkout.duration} minutes
            - Intensity: ${latestWorkout.intensity}
            ${workoutDetails}
            
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

          // Add function to calculate monthly workout statistics
          systemPrompt += `
            You can query monthly workout statistics for the user. For example:
            
            - If the user asks about their swimming distance for a specific month, you can retrieve and provide this information.
            - If the user asks about their total running, swimming, or cycling distance over a period, you can calculate and provide this data.
            
            DO NOT mention that you have this ability explicitly unless they ask for this information.
          `
          
          // If the user is asking about monthly statistics, try to process that
          const isAskingForMonthlyStats = messages.some((msg: any) => {
            if (msg.role === 'user') {
              const content = msg.content.toLowerCase();
              return (
                (content.includes('month') || 
                 content.includes('this year') || 
                 content.includes('last month') ||
                 content.includes('past') || 
                 content.includes('previous') ||
                 content.includes('last few') ||
                 content.includes('how did i do')) && 
                (content.includes('swim') || 
                 content.includes('run') || 
                 content.includes('cycling') || 
                 content.includes('distance'))
              );
            }
            return false;
          });
          
          // Helper function to extract month and year from user message
          function extractMonthAndYear(messages: any[]) {
            const monthNames = [
              'january', 'february', 'march', 'april', 'may', 'june', 
              'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Get the most recent user message
            const userMessages = messages.filter(msg => msg.role === 'user');
            const lastUserMessage = userMessages[userMessages.length - 1]?.content.toLowerCase() || '';
            
            // Look for month name in the message
            const mentionedMonth = monthNames.find(month => lastUserMessage.includes(month));
            
            let monthIndex = mentionedMonth ? monthNames.indexOf(mentionedMonth) + 1 : null;
            let year = new Date().getFullYear(); // Default to current year
            
            // If no specific month was mentioned, use current month
            if (!monthIndex) {
              if (lastUserMessage.includes('this month')) {
                monthIndex = new Date().getMonth() + 1;
              }
            }
            
            // Check if a specific year was mentioned (simple 4-digit check)
            const yearMatch = lastUserMessage.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[1]);
            }
            
            return { 
              month: monthIndex || new Date().getMonth() + 1, // Default to current month
              year
            };
          }

          // Helper function to check if query is about a date range (like "last 3 months")
          function isDateRangeQuery(message: string): { isRange: boolean, months: number } {
            const lowerMessage = message.toLowerCase();
            
            // Check for patterns like "last 3 months", "past 2 months", etc.
            const rangeMatch = lowerMessage.match(/(?:last|past|previous)\s+(\d+)\s+months?/);
            
            if (rangeMatch && rangeMatch[1]) {
              return { isRange: true, months: parseInt(rangeMatch[1]) };
            }
            
            // Special cases
            if (lowerMessage.includes('this year')) {
              // Get current month number and use that as the range
              const currentMonth = new Date().getMonth() + 1;
              return { isRange: true, months: currentMonth };
            }
            
            return { isRange: false, months: 0 };
          }

          if (isAskingForMonthlyStats) {
            try {
              // Get the last user message
              const userMessages = messages.filter((msg: any) => msg.role === 'user');
              const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
              
              // Check if it's a date range query
              const { isRange, months } = isDateRangeQuery(lastUserMessage);
              
              if (isRange && months > 0) {
                // Handle date range query
                const endDate = new Date(); // Today
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - months); // Go back X months
                
                // Calculate total distances for the range
                const swimmingDistance = await getWorkoutDistanceForDateRange(
                  userId,
                  'swimming',
                  startDate,
                  endDate
                );
                
                // Calculate total durations for the range
                const swimmingDuration = await getWorkoutDurationForDateRange(
                  userId,
                  'swimming',
                  startDate,
                  endDate
                );
                
                // Get swimming notes for analysis
                const swimmingNotes = await getWorkoutNotesByType(
                  userId,
                  'swimming',
                  startDate,
                  endDate
                );
                
                // Calculate other stats
                const runningDistance = await getWorkoutDistanceForDateRange(
                  userId,
                  'running',
                  startDate,
                  endDate
                );
                
                const cyclingDistance = await getWorkoutDistanceForDateRange(
                  userId,
                  'cycling',
                  startDate,
                  endDate
                );
                
                const rangeDescription = months === 1 ? 'the past month' : 
                                        (months === 12 ? 'this year' : `the past ${months} months`);
                
                // Format swimming notes for context
                const formattedNotes = swimmingNotes.notes.length > 0 
                  ? swimmingNotes.notes.map((note, i) => `- Session ${i+1}: "${note}"`).join('\n')
                  : "No notes available for swimming sessions";
                
                systemPrompt += `
                  Workout statistics for ${rangeDescription}:
                  
                  Swimming Stats:
                  - Total Sessions: ${swimmingNotes.count}
                  - Total Distance: ${swimmingDistance.toFixed(2)} km
                  - Total Time in Water: ${swimmingDuration} minutes
                  - Average Distance per Session: ${swimmingNotes.count > 0 ? (swimmingDistance / swimmingNotes.count).toFixed(2) : 0} km
                  - Average Duration per Session: ${swimmingNotes.count > 0 ? (swimmingDuration / swimmingNotes.count).toFixed(0) : 0} minutes
                  
                  Swimming Session Notes:
                  ${formattedNotes}
                  
                  Other Workout Stats:
                  - Running: ${runningDistance.toFixed(2)} km
                  - Cycling: ${cyclingDistance.toFixed(2)} km
                  
                  The user is asking about these statistics, particularly about their swimming performance. 
                  Analyze the swimming notes for patterns, progress, or issues mentioned. 
                  Provide insights and encouragement about their swimming performance.
                `;
              } else {
                // Handle single month query (existing code)
                const { month, year } = extractMonthAndYear(messages);
                
                // Get monthly swimming distance
                const swimmingDistance = await getMonthlyWorkoutDistanceByType(
                  userId, 
                  'swimming',
                  year,
                  month
                );
                
                // Get monthly swimming duration
                const swimmingDuration = await getMonthlyWorkoutDurationByType(
                  userId, 
                  'swimming',
                  year,
                  month
                );
                
                // Create date range for the month for note retrieval
                const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in JS Date
                const endDate = new Date(year, month, 0); // Last day of the month
                
                // Get swimming notes for analysis
                const swimmingNotes = await getWorkoutNotesByType(
                  userId,
                  'swimming',
                  startDate,
                  endDate
                );
                
                // Get other workout stats
                const runningDistance = await getMonthlyWorkoutDistanceByType(
                  userId, 
                  'running',
                  year,
                  month
                );
                
                const cyclingDistance = await getMonthlyWorkoutDistanceByType(
                  userId, 
                  'cycling',
                  year,
                  month
                );
                
                const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
                
                // Format swimming notes for context
                const formattedNotes = swimmingNotes.notes.length > 0 
                  ? swimmingNotes.notes.map((note, i) => `- Session ${i+1}: "${note}"`).join('\n')
                  : "No notes available for swimming sessions";
                
                systemPrompt += `
                  Workout statistics for ${monthName} ${year}:
                  
                  Swimming Stats:
                  - Total Sessions: ${swimmingNotes.count}
                  - Total Distance: ${swimmingDistance.toFixed(2)} km
                  - Total Time in Water: ${swimmingDuration} minutes
                  - Average Distance per Session: ${swimmingNotes.count > 0 ? (swimmingDistance / swimmingNotes.count).toFixed(2) : 0} km
                  - Average Duration per Session: ${swimmingNotes.count > 0 ? (swimmingDuration / swimmingNotes.count).toFixed(0) : 0} minutes
                  
                  Swimming Session Notes:
                  ${formattedNotes}
                  
                  Other Workout Stats:
                  - Running: ${runningDistance.toFixed(2)} km
                  - Cycling: ${cyclingDistance.toFixed(2)} km
                  
                  The user is asking about these statistics, particularly about their swimming performance. 
                  Analyze the swimming notes for patterns, progress, or issues mentioned. 
                  Provide insights and encouragement about their swimming performance.
                `;
              }
            } catch (error) {
              console.error("Error calculating workout statistics:", error);
            }
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

    // Add query context to system prompt
    if (queryContext) {
      systemPrompt += `
        Specific query analysis:
        ${queryContext}
        
        Use this information to directly answer the user's question.
        Be specific and precise with numbers, but maintain a conversational tone.
      `
    }

    const result = streamText({
      model: openai("gpt-4o"),
      messages,
      system: systemPrompt,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Error processing request:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}

