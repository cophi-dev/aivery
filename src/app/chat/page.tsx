"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LucideSend, LucideUser, LucideLoader, LucideRefreshCw } from "lucide-react"
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
      // **Enhanced prompt for keyword explanation**
      let finalQuery = messageContent;
      const keywordMatch = messageContent.match(/^What is (.*)\?$/i);
      if (keywordMatch && keywordMatch[1]) {
         const keyword = keywordMatch[1];
         // Use a more detailed prompt for keywords
         finalQuery = `Explain the fitness concept "${keyword}" clearly and concisely. What are its main benefits and potential drawbacks or considerations? Briefly mention how someone might incorporate it into their routine. Ask if the user has follow-up questions.`;
      }

      const response = await fetch('/api/ai/coach', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery, // Use potentially enhanced query
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
  // OR handle workoutId query
  useEffect(() => {
     const keyword = searchParams?.get('keyword');
     const dataQuery = searchParams?.get('dataQuery');
     const workoutId = searchParams?.get('workoutId'); // Get workoutId

     // Define async function inside useEffect to handle async operations
     const handleInitialLoad = async () => {
       if (workoutId && !initialMessageSentRef.current) {
         // Priority 1: Handle Workout ID Query
         initialMessageSentRef.current = true;
         setMessages([]); // Start fresh
         setIsLoading(true); // Show loading indicator
         try {
           console.log(`[ChatPage] Workout ID detected: '${workoutId}'. Fetching summary...`);
           const summary = await fetchWorkoutSummary(workoutId);
           if (summary) {
             setWorkoutContext(summary); // Store summary if needed later
             const workoutName = summary.name || summary.type || 'workout'; // Fallback name
             const workoutDate = summary.date ? ` from ${summary.date}` : '';
             // Construct a more detailed initial prompt for analysis
             const initialPrompt = `
Please analyze my ${workoutName} workout from ${summary.date || 'this date'} (ID: ${workoutId}). Specifically, provide:

*   Feedback on exercise selection and balance
*   Volume and intensity assessment
*   Progress tracking compared to previous workouts
*   Suggestions for improvement
*   Recovery recommendations
`;
             console.log(`[ChatPage] Workout summary found. Sending detailed analysis request for ID: ${workoutId}`);
             // Pass the fetched summary as context
             sendMessage(initialPrompt, { workoutSummary: summary });
           } else {
             console.log(`[ChatPage] Workout summary not found for ID: ${workoutId}. Sending generic welcome.`);
             // Workout not found or not owned, send generic welcome
             setMessages([{
               id: "welcome-error-" + Date.now(),
               role: "assistant",
               content: getRandomWelcomeMessage(userDisplayName)
             }]);
             setIsLoading(false);
           }
         } catch (error) {
           console.error(`[ChatPage] Error fetching workout summary for ID ${workoutId}:`, error);
           // Handle fetch error, send generic welcome
           setMessages([{
             id: "welcome-fetch-error-" + Date.now(),
             role: "assistant",
             content: `Sorry, I couldn't load the details for that workout. ${getRandomWelcomeMessage(userDisplayName)}`
           }]);
           setIsLoading(false);
         }
       } else if (dataQuery && !initialMessageSentRef.current) {
       // Priority 2: Handle Data Query
       initialMessageSentRef.current = true; 
       setMessages([]); 
       console.log(`[ChatPage] Data query detected: '${dataQuery}'. Sending initial message.`);
       sendMessage(dataQuery); // No context needed here
     } else if (keyword && !initialMessageSentRef.current) {
       // Priority 3: Handle Keyword Query
       initialMessageSentRef.current = true; // Mark as sent
       setMessages([]); // Start fresh
       const initialQuery = `What is ${keyword}?`;
       console.log(`[ChatPage] Keyword detected: '${keyword}'. Sending initial message.`);
       sendMessage(initialQuery); // No context needed here
     } else if (!workoutId && !keyword && !dataQuery && messages.length === 0 && !isLoading && !initialMessageSentRef.current) {
       // Priority 4: Display Welcome Message (if no query and chat is empty)
        setMessages([{
          id: "welcome-message-" + Date.now(),
          role: "assistant",
          content: getRandomWelcomeMessage(userDisplayName)
        }]);
        initialMessageSentRef.current = true; // Mark welcome as sent too
     }
     }

     handleInitialLoad(); // Call the async function

     // Dependencies include searchParams to react to URL changes and the sendMessage callback
   }, [searchParams, userDisplayName, isLoading, sendMessage]); // Add sendMessage to dependencies

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
    // Scroll to bottom when messages change
    // Use setTimeout to ensure scroll happens after DOM update
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 0); // Delay of 0ms is usually enough
  }, [messages]);

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

  // --- Render JSX ---
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] md:h-screen container mx-auto px-0 md:py-0">
      <div className="flex items-center justify-between px-4 py-2 border-b">
         <h1 className="text-lg font-semibold">AI Chat</h1>
         <Button variant="ghost" size="icon" onClick={resetChat} title="Reset Chat">
             <LucideRefreshCw className="h-4 w-4" />
         </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none rounded-none">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {/* Render messages using the simplified ChatMessage component */}
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {/* Loading state is handled within ChatMessage now */}
            </div>
          </ScrollArea>
          
          <CardContent className="py-3 px-4 border-t bg-background">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input 
                ref={inputRef}
                placeholder="Ask your fitness AI..." 
                value={input} 
                onChange={handleInputChange} 
                disabled={isLoading}
                className="flex-1"
                autoComplete="off"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                {isLoading ? <InlineSpinner size={16} /> : <LucideSend className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
      </Card>
    </div>
  );
}

