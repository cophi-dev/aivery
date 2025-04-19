"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LucideSend, LucideUser, LucideLoader, LucideRefreshCw, LucidePaperclip, LucideSearch, LucideLightbulb, LucideCalendarPlus, LucideClipboardCheck } from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { WorkoutListDisplay } from "@/components/workout-list-display"
import { fetchWorkoutSummary } from "@/lib/workout-actions"
import { InlineSpinner } from "@/components/ui/inline-spinner"

// Define Message type clearly
interface Message {
  id: string;
  role: 'user' | 'assistant'; // Use literal types
  content: string;
  data?: any; // Add optional data field to hold structured data like workouts
}

// Simplified ChatMessage component
interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
   const isUserMessage = message.role === 'user';
   const { data: session } = useSession(); // Get session for user avatar
   const userDisplayName = (session?.user as any)?.nickname || session?.user?.name || 'U';

   // Define loading state appearance directly if content is empty and role is assistant
   const showLoading = message.role === 'assistant' && message.content === "";

   return (
     <div className={cn('flex items-end gap-2', {
        'justify-end': isUserMessage,
     })}>
       {/* Avatar */}
       <div className={cn('flex-shrink-0', { 'order-2': isUserMessage, 'order-1': !isUserMessage })}>
         {isUserMessage ? (
           <UserAvatar name={userDisplayName} imageUrl={session?.user?.image} size="sm" />
         ) : (
           <Avatar className="h-8 w-8 bg-primary/10 text-primary flex items-center justify-center">
              <AvatarImage src="/icon.svg" alt="AI" />
              <AvatarFallback>AI</AvatarFallback>
           </Avatar>
         )}
       </div>
       {/* Bubble */}
       <div className={cn('px-3 py-1.5 rounded-xl max-w-[75%] break-words', {
         'order-1 bg-primary text-primary-foreground': isUserMessage,
         'order-2 bg-secondary': !isUserMessage,
       })}>
         {showLoading ? (
            <div className="flex items-center space-x-1">
                <span className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-current rounded-full animate-bounce"></span>
            </div>
         ) : (
            <>
              <ReactMarkdown 
                className="prose prose-sm dark:prose-invert"
                >
                  {message.content} 
                </ReactMarkdown>
              {/* Conditionally render WorkoutListDisplay if workouts data exists */}
              {message.role === 'assistant' && message.data?.workouts && message.data.workouts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-current/20">
                  <WorkoutListDisplay workouts={message.data.workouts} />
                </div>
              )}
            </>
         )}
       </div>
     </div>
   );
}; 

// Main Chat Page Component
export default function ChatPage() {
  const { data: session } = useSession();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const searchParams = useSearchParams(); // Get search params
  const initialMessageSentRef = useRef(false); // Ref to track initial message

  // Use a ref to reliably get the latest messages for the API call
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const userDisplayName = (session?.user as any)?.nickname || session?.user?.name || "there";

  // State to hold fetched workout summary for context
  const [workoutContext, setWorkoutContext] = useState<{ name: string | null; type: string | null; date: string | null } | null>(null);

  // Focus input on initial mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Function to send a message (refactored from handleSubmit)
  const sendMessage = useCallback(async (messageContent: string, context?: any) => {
    // Capture the history *before* adding the new user message
    const previousMessages = messagesRef.current;

    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent
    };

    const loadingAssistantMessage: Message = {
      id: `ai-loading-${Date.now()}`,
      role: "assistant",
      content: "" 
    };
    
    // Add user message and loading placeholder immediately
    setMessages(prev => [...prev, userMessage, loadingAssistantMessage]);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai/coach', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: messageContent, // Send the original messageContent directly
          userName: userDisplayName,
          history: previousMessages, // Send the history *before* this turn
          context: context // Send the optional context object
        }),
      });

      if (!response.ok) {
         let errorBody = "Failed to get response from server.";
         try {
            const errorData = await response.json(); 
            errorBody = errorData.error || errorBody;
        } catch (_) {
            try { errorBody = await response.text(); } catch { /* ignore */ }
        }
         console.error("API Error Response:", errorBody);
         throw new Error(`API request failed: ${errorBody}`);
      }
      
      const result = await response.json();
      const text = result.response; 
      const structuredData = result.data; // Capture the data object
      console.log("[ChatPage] Received result from backend:", result); // Log 1
      console.log("[ChatPage] Extracted text:", text); // Log 2
      console.log("[ChatPage] Extracted data:", structuredData); // Log for data

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: text || "Sorry, I couldn't get a proper response.",
        data: structuredData // Store the data object in the message state
      };
      console.log("[ChatPage] Created aiMessage object:", aiMessage); // Log 3
      
      // Replace the loading message with the actual response
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg.id === loadingAssistantMessage.id ? aiMessage : msg
        );
        console.log("[ChatPage] Messages state AFTER update:", updatedMessages); // Log 4
        return updatedMessages;
      });
      inputRef.current?.focus(); 

    } catch (error: any) {
      console.error("[ChatPage] Chat Submission Error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error.message || "Sorry, I encountered an error. Please try again."
      };
       setMessages(prev => prev.map(msg => 
         msg.id === loadingAssistantMessage.id ? errorMessage : msg
      ));
    } finally {
      setIsLoading(false);
      // Refocus input AFTER loading state is false and message processing is done
      inputRef.current?.focus(); 
    }
  }, [isLoading, userDisplayName]); // Dependencies for sendMessage

  // Fetch initial message OR handle keyword query OR data query
  // OR handle workoutId query OR handle dashboard quick action
  useEffect(() => {
     const keyword = searchParams?.get('keyword');
     const dataQuery = searchParams?.get('dataQuery');
     const workoutId = searchParams?.get('workoutId'); // Get workoutId
     const initialQuery = searchParams?.get('initialQuery'); // Get from dashboard
     const requestType = searchParams?.get('requestType'); // Get requestType from dashboard

     // Define async function inside useEffect to handle async operations
     const handleInitialLoad = async () => {

       // Priority 1: Handle Dashboard Quick Action Redirect
       if (initialQuery && requestType && !initialMessageSentRef.current) {
         console.log(`[ChatPage] Initial dashboard action detected. Query: "${initialQuery}", Type: "${requestType}"`);
         initialMessageSentRef.current = true;
         // Construct context object for the API call
         const context = { requestType: requestType }; 
         // Call sendMessage, which will add user message, show loading, call API, and add response
         await sendMessage(initialQuery, context);
         // Optional: Clear the query params from URL without reload
         // window.history.replaceState(null, '', '/chat');
         return; // Processed, exit early
       }

       // Priority 2: Handle Workout ID Query
       if (workoutId && !initialMessageSentRef.current) {
         console.log(`[ChatPage] Workout ID detected: '${workoutId}'. Fetching summary...`);
         initialMessageSentRef.current = true;
         setMessages([]); // Start fresh
         setIsLoading(true); // Show loading indicator
         try {
           const summary = await fetchWorkoutSummary(workoutId);
           if (summary) {
             setWorkoutContext(summary); // Store summary if needed later
             const workoutName = summary.name || summary.type || 'workout'; // Fallback name
             const workoutDate = summary.date || 'this date'; // Use 'this date' as fallback
             const userDisplayName = session?.user?.name || 'User'; // Get user name

             const userMessage = `Please analyze my ${workoutName} workout from ${workoutDate} (ID: ${workoutId}). Specifically, provide:

*   Feedback on exercise selection and balance
*   Volume and intensity assessment
*   Progress tracking compared to previous workouts
*   Suggestions for improvement
*   Recovery recommendations
`;
             console.log(`[ChatPage] Workout summary found. Sending detailed analysis request for ID: ${workoutId}`);
             await sendMessage(userMessage, { workoutSummary: summary }); // Pass user message and summary
           } else {
             setMessages([{id: `error-initial-${Date.now()}`, role: 'assistant', content: `Sorry, I couldn't find details for workout ID: ${workoutId}` }]);
           }
         } catch (error) {
             console.error("Error fetching workout summary:", error);
             setMessages([{id: `error-initial-${Date.now()}`, role: 'assistant', content: "Sorry, an error occurred while fetching workout details."}]);
         } finally {
             setIsLoading(false);
         }
         return; // Processed, exit early
       }

       // Priority 3: Handle Keyword Query
       if (keyword && !initialMessageSentRef.current) {
         console.log(`[ChatPage] Keyword detected: '${keyword}'. Sending query...`);
         initialMessageSentRef.current = true;
         const query = `What is ${keyword}?`; // Construct query
         setInput(query); // Optional: Set input field
         await sendMessage(query); // Use existing send function
         return; // Processed, exit early
       }

       // Priority 4: Handle Data Insight Query
       if (dataQuery && !initialMessageSentRef.current) {
         console.log(`[ChatPage] Data query detected: '${dataQuery}'. Sending query...`);
         initialMessageSentRef.current = true;
         setInput(dataQuery); // Set input field
         await sendMessage(dataQuery);
         return; // Processed, exit early
       }
       
       // Priority 5: Send Initial Welcome Message (if no other params and no messages yet)
       if (!isLoading && messagesRef.current.length === 0 && !initialMessageSentRef.current) {
          console.log("[ChatPage] Sending initial welcome message.");
          initialMessageSentRef.current = true; // Mark as sent
          const welcome = getRandomWelcomeMessage(userDisplayName);
          setMessages([{ id: `ai-welcome-${Date.now()}`, role: "assistant", content: welcome }]);
       }
     };

     handleInitialLoad();

  }, [searchParams, sendMessage, userDisplayName, session?.user?.name, isLoading]); // Added deps

  function getRandomWelcomeMessage(name: string): string {
    const welcomeMessages = [
      `Hey ${name}! 👋 I'm your fitness coach. What can I help you with today?`,
      `Hi ${name}! Ready to crush some fitness goals today? I'm here to help!`,
      `Welcome ${name}! I'm your AI fitness buddy. How's your training going?`,
      `Hey there ${name}! 💪 What aspect of your fitness journey can I support you with today?`,
      `Hi ${name}! I'm your personal fitness assistant. What's on your workout agenda?`
    ];
    return welcomeMessages[Math.floor(Date.now() % welcomeMessages.length)];
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Updated handleSubmit to use sendMessage
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const currentMessageContent = input;
    setInput(""); // Clear input immediately
    await sendMessage(currentMessageContent);
  };

  useEffect(() => {
    // Scroll ScrollArea viewport to bottom when messages change using requestAnimationFrame
    const rafId = requestAnimationFrame(() => { // Use requestAnimationFrame
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    // Cleanup function to cancel the frame if component unmounts or messages change again quickly
    return () => cancelAnimationFrame(rafId);
  }, [messages]); // Rerun when messages change

  const resetChat = () => {
     setInput("");
     setIsLoading(false);
     // Reset also clears keyword context and shows welcome message
     setMessages([{
        id: "welcome-reset-" + Date.now(),
        role: "assistant",
        content: getRandomWelcomeMessage(userDisplayName)
     }]);
     inputRef.current?.focus(); 
     // Optional: Navigate back to /chat without params on reset?
     // window.history.pushState({}, '', '/chat');
  };

  // Callback for the new plan request button
  const handlePlanRequest = useCallback(() => {
    if (isLoading) return; // Don't send if already loading

    const userQuery = "Please create my next weeks workout plan";
    const userName = session?.user?.name || 'User'; // Reuse userDisplayName logic

    // Define the specific system prompt for this request
    const systemPrompt = `\nYou are Aivery, a friendly, expert AI fitness coach who's encouraging and practical. The user's name is ${userName}. Create a personalized, 4-day workout plan for next week (Monday to Sunday, starting April 21, 2025 - ***Note: Use the actual upcoming week's dates relative to the current date***) based on the user's workout history, ensuring balance, progression, and alignment with their fitness goals.\n\nDATABASE SCHEMA OVERVIEW (Key Fields):\n\nUserData: _id, email, name, aiPreferences { location, fitnessGoals, trainingPreferences, ... }, height, weight, age, gender, ...\nWorkoutData: _id, userId, type (strength, run, cycle, swim, ...), name, date, duration, distance, calories, notes, intensity, workoutExercises[], cardioDetails { pace, speed, heartRate, laps, ... }, source, records[] { timestamp, heart_rate, speed, ... }, calculatedVolume, ...\nExerciseData: _id, name, description, muscleGroups, category (strength, cardio, flexibility), equipment, instructions\nWorkoutExerciseData: _id, workoutId, exerciseId { _id, name, category }, sets[], notes, order, duration, distance\nSet: _id, weight, reps, duration, distance, notes\n\nCONTEXT: \${dataContext} // E.g., fetched workout history, "No specific data provided...", or error messages\n\nRESPONSE GUIDELINES:\n\nPersonalized & Encouraging: Address ${userName} directly with a positive, motivating tone. Use emojis sparingly (e.g., 💪, 🏃‍♀️).\nData-Driven Plan:\nUse CONTEXT Data: If workout history (e.g., types, exercises, volume, distance) is provided in CONTEXT, analyze it to identify patterns (e.g., frequent strength or cardio) and tailor the plan to build on strengths or address gaps.\nHandle Missing Data: If CONTEXT says "No specific data provided..." or indicates an error, acknowledge it (e.g., "I don't have your workout history, so I'll create a balanced plan based on general fitness goals.") and design a versatile plan for a moderately active user.\nSchema Awareness: Leverage schema to infer trackable data (e.g., muscle groups, intensity). If relevant data isn't in CONTEXT, note it's trackable but not provided (e.g., "I don't see your preferred weights, but we can adjust based on feedback.").\nPlan Structure (Markdown):\nOverview: Briefly explain the plan's focus (e.g., strength, cardio, balance) and how it aligns with inferred or stated goals (from aiPreferences if available).\nSchedule: Assign workouts to 4 specific days (e.g., Mon, Wed, Fri, Sat) with rest or active recovery days between. Specify dates (for the *actual* upcoming week relative to today).\nDaily Breakdown: For each day:\nWorkout Type: Strength, cardio, or mixed.\nExercises: List 3-6 exercises with sets, reps, weight (for strength), or duration/distance (for cardio). Base on history or common exercises if data is missing.\nIntensity: Suggest intensity (e.g., % of max effort, RPE scale, or pace).\nDuration: Estimate total time (e.g., 45-60 min).\nProgression: Incorporate slight increases (e.g., 5-10% more volume, distance, or intensity) compared to historical data (if available) to promote growth.\nRecovery: Recommend rest days, stretching, or light activity (e.g., walking, yoga) for non-workout days.\nBalanced & Practical:\nInclude both strength (e.g., push/pull, upper/lower body) and cardio (e.g., running, cycling) to reflect user's interest in both.\nEnsure variety in muscle groups and movement patterns (e.g., avoid back-to-back chest days).\nSuggest accessible equipment (e.g., dumbbells, bodyweight) unless user's history indicates gym access.\nGoal Alignment: If aiPreferences provide fitnessGoals (e.g., muscle gain, endurance), prioritize relevant exercises. Otherwise, assume a balanced goal (strength + cardio).\nConcise & Actionable: Keep descriptions brief (e.g., "3 sets of 10 squats at 50kg"). Avoid inventing specific historical data. Use general best practices if data is limited.\nHandle Ambiguity: If history is unclear, ask for clarification (e.g., "Could you share your fitness goals or recent workouts for a more tailored plan?") while providing a default balanced plan.\nMarkdown Formatting: Use bold headings, bullet points, and tables for clarity.\n\nExample Response (Assuming Limited Data):\n\n**4-Day Workout Plan for ${userName} (Next Week: Mon, Apr 21 - Sun, Apr 27)**\n\n*Overview*\nHey ${userName}! I don't have your workout history, so I've crafted a balanced plan mixing strength and cardio to boost fitness and track progress. Let me know your goals for a more tailored version! 
\n\n*Schedule*\nMon, Apr 21: Strength (Upper Body)\nWed, Apr 23: Cardio (Running)\nFri, Apr 25: Strength (Lower Body)\nSat, Apr 26: Cardio (Cycling)\nRest/Active Recovery: Tue, Thu, Sun (light walk or stretching)\n\n**Monday, Apr 21: Upper Body Strength (45 min)**\n*   Push-Ups: 3 sets of 12 (bodyweight, moderate intensity)\n*   Dumbbell Rows: 3 sets of 10 (10kg/side, RPE 7/10)\n*   Overhead Press: 3 sets of 8 (8kg, RPE 7/10)\n*   Plank: 3 sets of 30s\n\n**Wednesday, Apr 23: Cardio Run (40 min)**\n*   Run 5km at a steady pace (~6 min/km, RPE 6/10)\n*   Warm-up: 5 min light jog\n*   Cool-down: 5 min walk\n\n**Friday, Apr 25: Lower Body Strength (45 min)**\n*   Squats: 3 sets of 10 (20kg, RPE 7/10)\n*   Lunges: 3 sets of 12/leg (bodyweight)\n*   Deadlifts: 3 sets of 8 (25kg, RPE 7/10)\n*   Calf Raises: 3 sets of 15\n\n**Saturday, Apr 26: Cardio Cycle (45 min)**\n*   Cycle 15km at moderate pace (~20km/h, RPE 6/10)\n*   Warm-up: 5 min easy pedaling\n*   Cool-down: 5 min light stretch\n\n*Recovery*\n*   Rest or walk lightly on Tue, Thu, Sun.\n*   Stretch 10 min post-workout (focus on hamstrings, shoulders).\n*   Aim for 7-8 hours sleep and 1.2-1.6g protein/kg body weight daily.\n\nGo, Aivery! Craft a personalized, balanced, and actionable 4-day workout plan for ${userName}, using workout history from CONTEXT and aligning with their fitness interests! 🏃‍♀️💪\n`;

    // Send message with specific context for plan generation
    sendMessage(userQuery, { 
      requestType: 'generate_plan', 
      systemPrompt: systemPrompt 
    });

  }, [isLoading, sendMessage, session]); // Add dependencies

  // Placeholder for the new button's action
  const handleReviewRequest = useCallback(() => {
    if (isLoading) return; // Don't send if already loading
    console.log("Weeks Review button clicked");
    // TODO: Implement the actual logic for weekly review request
    // This might involve calling sendMessage with specific context, similar to handlePlanRequest
    // e.g., sendMessage("Can you review my last week's performance?", { requestType: 'generate_weekly_review' });
  }, [isLoading, sendMessage]);

  // --- Render JSX ---
  return (
    // The main container should allow the fixed element to anchor relative to the viewport height correctly
    <div className="relative flex flex-col h-[calc(100vh-65px)] md:h-screen container mx-auto px-0 md:py-0">
      <div className="flex items-center justify-between px-4 py-2 border-b">
         <h1 className="text-lg font-semibold">AI Chat</h1>
         <Button variant="ghost" size="icon" onClick={resetChat} title="Reset Chat">
             <LucideRefreshCw className="h-4 w-4" />
         </Button>
      </div>

      {/* Card contains the scrollable area ONLY */}
      <Card className="flex-1 flex flex-col border-0 shadow-none rounded-none">
          {/* Add bottom padding DIRECTLY to ScrollArea - Increased Significantly */}
          <ScrollArea className="flex-1 p-4 pb-40" ref={scrollAreaRef}> {/* Increased pb to 40 */} 
            <div className="space-y-4" ref={messageContainerRef}> 
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          </ScrollArea>
      </Card>

      {/* Floating Input Area Wrapper - Simplified */}
      {/* Increased rounding, adjusted padding */}
      <div className="fixed bottom-4 left-4 right-4 z-10 max-w-3xl mx-auto bg-white dark:bg-black border border-border rounded-3xl shadow-lg px-4 py-3">
        {/* Quick Action Button Row */}
        <div className="flex items-center justify-center space-x-2 mb-2">
           <Button 
              variant="outline" 
              size="sm" 
              className="rounded-lg text-xs font-normal text-muted-foreground"
              onClick={handlePlanRequest} // Attach handler
              disabled={isLoading} // Disable while loading
           >
             <LucideCalendarPlus className="h-3 w-3 mr-1.5" /> Create Next Week's Plan
           </Button>
           {/* New Weeks Review Button */}
           <Button 
              variant="outline" 
              size="sm" 
              className="rounded-lg text-xs font-normal text-muted-foreground"
              onClick={handleReviewRequest} // Attach new handler
              disabled={isLoading} // Disable while loading
           >
             <LucideClipboardCheck className="h-3 w-3 mr-1.5" /> Weeks Review
           </Button>
           {/* Add more quick action buttons here if needed */}
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative w-full flex items-center">
          <Input 
            ref={inputRef}
            placeholder="Ask anything" 
            value={input} 
            onChange={handleInputChange} 
            disabled={isLoading}
            className="flex-1 h-12 rounded-full pl-4 pr-12 border-border shadow-sm bg-background" 
            autoComplete="off"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            size="icon" 
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200" 
            title="Send / Voice"
          >
            {isLoading ? <InlineSpinner size={16} className="text-current" /> : <LucideSend className="h-4 w-4 text-current" />}
          </Button>
        </form>

        {/* Removed Disclaimer Text */}
      </div>
    </div>
  );
}

