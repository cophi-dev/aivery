"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { 
  LucideSend, 
  Search, 
  Mic, 
  ArrowUp, 
  Plus, 
  FileText, 
  Code, 
  BookOpen, 
  PenTool, 
  BrainCircuit, 
  Sparkles, 
  RefreshCw, 
  CalendarPlus, 
  ClipboardCheck 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "next-auth/react";
import { UserAvatar } from "@/components/user-avatar";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { InlineSpinner } from "@/components/ui/inline-spinner";

// Define Message type
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp?: number;
  isLoading?: boolean;
  isError?: boolean;
  isInitialMessage?: boolean;
};

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
      'justify-end': isUserMessage
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
      <div className={cn('px-4 py-2.5 rounded-xl max-w-[75%] break-words shadow-sm', {
        'order-1 bg-primary/90 text-primary-foreground': isUserMessage,
        'order-2 bg-muted/80 dark:bg-secondary/90 border border-border/5': !isUserMessage,
        'hover:bg-primary/95': isUserMessage,
        'hover:bg-muted/90 dark:hover:bg-secondary/95': !isUserMessage
      })}>
        {showLoading ? (
          <div className="flex items-center space-x-1.5 py-1">
            <span className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s] opacity-70"></span>
            <span className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s] opacity-80"></span>
            <span className="h-2 w-2 bg-current rounded-full animate-bounce opacity-90"></span>
          </div>
        ) : (
          <>
            <ReactMarkdown className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-secondary/50">
              {typeof message.content === 'string' ? message.content : ''}
            </ReactMarkdown>
            {/* Conditionally render data if it exists */}
            {message.role === 'assistant' && message.data?.workouts && message.data.workouts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/10">
                <div className="text-sm text-muted-foreground">
                  {message.data.workouts.length} workout(s) found
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface CommandButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function CommandButton({ icon, label, isActive, onClick }: CommandButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
        isActive
          ? "bg-primary/10 border-primary/20 shadow-sm"
          : "bg-background border-border hover:border-input"
      }`}
    >
      <div className={`${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <span
        className={`text-sm font-medium ${
          isActive ? "text-primary" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}

export function AIAssistantInterface() {
  const { data: session } = useSession();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [reasonEnabled, setReasonEnabled] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showUploadAnimation, setShowUploadAnimation] = useState(false);
  const [activeCommandCategory, setActiveCommandCategory] = useState<string | null>(null);
  const [detectedWorkoutType, setDetectedWorkoutType] = useState<string | null>(null);
  const [queryMode, setQueryMode] = useState<string | null>(null);

  // Use a ref to reliably get the latest messages for the API call
  const messagesRef = useRef<Message[]>(messages);

  const userDisplayName = (session?.user as any)?.nickname || session?.user?.name || "there";

  // Command suggestions categories
  const commandSuggestions = {
    learn: [
      "Explain how to build muscle effectively",
      "What's the best way to improve my cardio?",
      "How does progressive overload work?",
      "What's the ideal protein intake for muscle growth?",
      "How important is recovery between workouts?",
    ],
    plan: [
      "Create a 4-day strength training program for me",
      "Design a running plan to improve my 5k time",
      "Build me a home workout routine with minimal equipment",
      "Create a bodyweight workout plan I can do anywhere",
      "Design a balanced workout plan with both strength and cardio",
    ],
    track: [
      "Analyze my workout progress over the last month",
      "Compare my current lifts to my previous bests",
      "Track my running improvement over time",
      "Show me which muscle groups I've been neglecting",
      "Calculate my overall training volume by week",
    ],
  };

  // Function to handle file uploads
  const handleUploadFile = () => {
    setShowUploadAnimation(true);

    // Simulate file upload with timeout
    setTimeout(() => {
      const newFile = `Workout-Data.pdf`;
      setUploadedFiles((prev) => [...prev, newFile]);
      setShowUploadAnimation(false);
    }, 1500);
  };

  // Function to toggle command categories with clear context
  const toggleCommandCategory = (category: string) => {
    // Clear any existing context when switching categories
    if (inputRef.current) {
      inputRef.current.dataset.workoutType = "";
      inputRef.current.dataset.queryType = "";
    }
    
    // Toggle the category
    if (activeCommandCategory === category) {
      setActiveCommandCategory(null);
    } else {
      setActiveCommandCategory(category);
      
      // Set queryType based on category
      if (inputRef.current && category === "learn") {
        inputRef.current.dataset.queryType = "educational";
      }
    }
  };

  // Handle command selection
  const handleCommandSelect = (command: string) => {
    setInputValue(command);
    setActiveCommandCategory(null);

    if (inputRef.current) {
      // Check for specific workout types in the command text
      if (command.toLowerCase().includes("strength") || 
          command.toLowerCase().includes("weight")) {
        // Set a hidden context that this is about strength training
        inputRef.current.dataset.workoutType = "strength";
        setDetectedWorkoutType("strength");
        setQueryMode(null);
      } else if (command.toLowerCase().includes("cardio") || 
                command.toLowerCase().includes("run") || 
                command.toLowerCase().includes("swimming")) {
        // Set a hidden context that this is about cardio
        inputRef.current.dataset.workoutType = "cardio";
        setDetectedWorkoutType("cardio");
        setQueryMode(null);
      } else if (command.toLowerCase().includes("home") || 
                command.toLowerCase().includes("bodyweight") ||
                command.toLowerCase().includes("minimal equipment")) {
        // Set a hidden context that this is about home workouts
        inputRef.current.dataset.workoutType = "bodyweight";
        setDetectedWorkoutType("bodyweight");
        setQueryMode(null);
      } else if (activeCommandCategory === "learn") {
        // Set educational query type for learn suggestions
        inputRef.current.dataset.queryType = "educational";
        setDetectedWorkoutType(null);
        setQueryMode("educational");
      }
      
      inputRef.current.focus();
    }
  };

  // Function to send a message
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
          query: messageContent,
          userName: userDisplayName,
          history: previousMessages,
          context: context,
          features: {
            search: searchEnabled,
            deepResearch: deepResearchEnabled,
            reasoning: reasonEnabled
          }
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
      const structuredData = result.data;

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: text || "Sorry, I couldn't get a proper response.",
        data: structuredData
      };
      
      // Replace the loading message with the actual response
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg.id === loadingAssistantMessage.id ? aiMessage : msg
        );
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
      inputRef.current?.focus(); 
    }
  }, [isLoading, userDisplayName, searchEnabled, deepResearchEnabled, reasonEnabled]);

  // Update the handleSubmit function to handle educational queries properly
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    const currentMessageContent = inputValue;
    setInputValue(""); // Clear input immediately

    // Check if we have context about workout type or query type
    let workoutType = inputRef.current?.dataset.workoutType || "";
    let queryType = inputRef.current?.dataset.queryType || "";
    let context: any = undefined;

    // Detect if this is a plan request
    const isPlanRequest = 
      currentMessageContent.toLowerCase().includes("plan") ||
      currentMessageContent.toLowerCase().includes("workout") ||
      currentMessageContent.toLowerCase().includes("routine") ||
      currentMessageContent.toLowerCase().includes("program") ||
      currentMessageContent.toLowerCase().includes("schedule") ||
      currentMessageContent.toLowerCase().includes("exercise");

    // Detect if this is an educational query
    const isEducationalQuery = 
      queryType === "educational" ||
      currentMessageContent.toLowerCase().includes("how does") || 
      currentMessageContent.toLowerCase().includes("what is") ||
      currentMessageContent.toLowerCase().includes("explain") ||
      currentMessageContent.toLowerCase().includes("tell me about") ||
      currentMessageContent.toLowerCase().startsWith("why") ||
      currentMessageContent.toLowerCase().includes("difference between");

    // Handle educational queries
    if (isEducationalQuery) {
      // Create a system prompt for educational content
      const educationalPrompt = `
You are Aivery, an AI fitness coach. You are answering an educational question about fitness: "${currentMessageContent}"

Respond with a clear, concise, and accurate explanation. Include:
1. A direct answer to the question
2. A brief explanation of the concept
3. Practical examples or applications
4. If relevant, how this applies to different fitness levels

Keep your answer factual, evidence-based, and avoid unnecessary jargon. Format using markdown for readability.
`;

      context = {
        queryType: 'educational',
        systemPrompt: educationalPrompt,
        overrideDefaultPrompt: true
      };

      // Clear dataset
      if (inputRef.current) {
        inputRef.current.dataset.queryType = "";
      }
    }
    // Handle weekly review analysis queries
    else if (currentMessageContent.toLowerCase().includes("tell me more about my") && 
             currentMessageContent.toLowerCase().includes("workout")) {
      // Check if we already have context from sessionStorage
      if (typeof window !== 'undefined') {
        try {
          const reviewDataString = sessionStorage.getItem('aivery_weekly_review');
          if (reviewDataString) {
            const reviewData = JSON.parse(reviewDataString);
            
            context = {
              requestType: 'analyze_workout_review',
              reviewData: reviewData,
              reviewPeriod: reviewData.period,
              systemPrompt: `
You are Aivery, an AI fitness coach. The user is asking about their ${reviewData.period} workouts.

Based on the weekly review data I'm providing, answer the user's question about their workout performance.

Weekly Review Data:
- Period: ${reviewData.period}
- Title: ${reviewData.title}
${reviewData.sections ? 
  reviewData.sections.map((s: {title: string, content: string}) => `- ${s.title}: ${s.content.substring(0, 100)}...`).join('\n') 
  : ''}

IMPORTANT: Use the above context to give a personalized response to the user's query: "${currentMessageContent}".
Format using markdown for readability, and be specific in your analysis of their performance.
`
            };
            
            // Clear sessionStorage after using it
            sessionStorage.removeItem('aivery_weekly_review');
          }
        } catch (error) {
          console.error("[Chat] Error processing review data:", error);
        }
      }
    }
    // Handle workout plan requests
    else if (!workoutType && isPlanRequest) {
      // Detect workout type from the input text
      const input = currentMessageContent.toLowerCase();
      if (input.includes("strength") || input.includes("weight") || 
          input.includes("gym") || input.includes("lift") || input.includes("muscle")) {
        workoutType = "strength";
      } else if (input.includes("run") || input.includes("cardio") || 
                input.includes("aerobic") || input.includes("swimming") || 
                input.includes("jog") || input.includes("sprint")) {
        workoutType = "cardio";
      } else if (input.includes("home") || input.includes("bodyweight") || 
                input.includes("minimal equipment") || input.includes("calisthenics") ||
                input.includes("no equipment") || input.includes("body weight")) {
        workoutType = "bodyweight";
      } else if (isPlanRequest) {
        // If it seems like a plan request but no specific type detected, assume mixed
        workoutType = "mixed";
      }
    }

    // Update the detected workout type for display
    setDetectedWorkoutType(workoutType || null);

    // If this seems like a plan request and we know the workout type
    if (isPlanRequest && workoutType && !context) {
      context = {
        requestType: 'generate_plan',
        workoutType: workoutType
      };

      // Add custom system prompts based on workout type for more explicit instructions
      if (workoutType === 'strength') {
        context.systemPrompt = `
You are Aivery, an AI fitness coach specializing in strength training. Create a strength training plan focusing on the user's specific request: "${currentMessageContent}"

IMPORTANT: This is a STRENGTH TRAINING plan, NOT a running plan. Do NOT include running workouts or running metrics.

Create a plan with the following structure:
1. Brief introduction to the plan
2. Weekly schedule overview showing which muscle groups will be trained on which days
3. For each training day, provide:
   - Specific exercises (3-6 per workout)
   - Sets and reps for each exercise
   - Rest periods
   - Difficulty progression options
4. Include at least 2 rest/recovery days

The user has the following equipment available:
- Body weight
- Resistance bands
- A pair of dumbbells
- A pull-up bar (optional)

The user's recent PRs:
- Push-ups: 20 reps
- Sit-ups: 50 reps
- Dips: 3 reps

Format the response using markdown with clear headings and bullet points.
`;
        context.overrideDefaultPrompt = true;
      } else if (workoutType === 'bodyweight') {
        context.systemPrompt = `
You are Aivery, an AI fitness coach specializing in home workouts. Create a home workout plan based on the user's specific request: "${currentMessageContent}"

IMPORTANT: This is a HOME WORKOUT plan, NOT a running plan. Do NOT include running workouts or running metrics.

Create a plan with the following structure:
1. Brief introduction to the home workout plan
2. Weekly schedule overview showing which muscle groups will be trained on which days
3. For each training day, provide:
   - Specific exercises (3-6 per workout)
   - Sets and reps for each exercise
   - Difficulty options for beginners and advanced
   - Estimated workout duration
4. Include at least 2 rest/recovery days

The user has NO special equipment beyond:
- Their own body weight
- A yoga mat
- Perhaps a chair or stable surface

The user's recent PRs:
- Push-ups: 20 reps
- Sit-ups: 50 reps
- Dips: 3 reps

Format the response using markdown with clear headings and bullet points.
`;
        context.overrideDefaultPrompt = true;
      } else if (workoutType === 'mixed') {
        context.systemPrompt = `
You are Aivery, an AI fitness coach specializing in balanced workout plans. Create a workout plan based on the user's specific request: "${currentMessageContent}"

IMPORTANT: This should be a BALANCED fitness plan that includes BOTH strength and cardio, with appropriate rest days.

Create a plan with the following structure:
1. Brief introduction to the balanced plan
2. Weekly schedule overview showing what type of workout will be done each day:
   - Strength days (2-3 days)
   - Cardio days (2-3 days)
   - Recovery/Rest days (1-2 days)
3. For each training day, provide:
   - Workout type (strength or cardio)
   - Specific exercises (for strength) or activity (for cardio)
   - Sets and reps (for strength) or duration/intensity (for cardio)
   - Equipment needed
4. Include recovery recommendations

Consider the user's recent performance metrics:
- Recent strength PRs: Push-ups (20 reps), Sit-ups (50 reps), Dips (3 reps)
- Recent cardio: Running about 12km per week, longest run 6.9km

Format the response using markdown with clear headings and bullet points.
`;
        context.overrideDefaultPrompt = true;
      }
      
      // Clear the dataset after using it
      if (inputRef.current) inputRef.current.dataset.workoutType = "";
    }
    
    await sendMessage(currentMessageContent, context);
  };

  // Update messagesRef when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [messages]);

  // Set up initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      // Check for weekly review context in sessionStorage
      if (typeof window !== 'undefined') {
        try {
          const chatContext = sessionStorage.getItem('aivery_chat_context');
          if (chatContext === 'weekly_review') {
            const reviewDataString = sessionStorage.getItem('aivery_weekly_review');
            if (reviewDataString) {
              const reviewData = JSON.parse(reviewDataString);
              
              // Create a welcome message that acknowledges the review
              const customWelcome = `I see you want to discuss your ${reviewData.period} workouts. What would you like to know about them?`;
              setMessages([{ id: `ai-welcome-${Date.now()}`, role: "assistant", content: customWelcome }]);
              
              // Clear the sessionStorage to prevent duplicate handling
              sessionStorage.removeItem('aivery_chat_context');
              sessionStorage.removeItem('aivery_weekly_review');
              
              // Set input value to trigger the user's first question
              setTimeout(() => {
                setInputValue(`Tell me more about my ${reviewData.period} workout performance`);
              }, 500);
              
              return; // Skip the standard welcome message
            }
          }
        } catch (error) {
          console.error("[Chat] Error processing session storage data:", error);
          // Continue with normal welcome message if there's an error
        }
      }
      
      // Default welcome message if no review context found
      const welcomeMessage = getRandomWelcomeMessage(userDisplayName);
      setMessages([{ id: `ai-welcome-${Date.now()}`, role: "assistant", content: welcomeMessage }]);
    }
  }, [messages.length, userDisplayName]);

  // Handle case when user submits query about weekly review
  useEffect(() => {
    // This effect watches for the special query set by the first effect
    const isReviewQuery = inputValue.toLowerCase().includes("tell me more about my") && 
                         inputValue.toLowerCase().includes("workout performance");
    
    if (isReviewQuery && !isLoading && typeof window !== 'undefined') {
      try {
        const reviewDataString = sessionStorage.getItem('aivery_weekly_review');
        if (reviewDataString) {
          const reviewData = JSON.parse(reviewDataString);
          
          // Automatically submit this query with the review data as context
          const context = {
            requestType: 'analyze_workout_review',
            reviewData: reviewData,
            reviewPeriod: reviewData.period
          };
          
          // Copy the input before clearing it
          const query = inputValue;
          setInputValue('');
          
          // Send the message with the context
          sendMessage(query, context);
          
          // Clear sessionStorage after using it
          sessionStorage.removeItem('aivery_weekly_review');
        }
      } catch (error) {
        console.error("[Chat] Error processing review data:", error);
      }
    }
  }, [inputValue, isLoading, sendMessage]);

  function getRandomWelcomeMessage(name: string): string {
    const welcomeMessages = [
      `Hi ${name}! I'm your AI fitness coach. How can I help you today?`,
      `Welcome back, ${name}! Ready to work on your fitness goals?`,
      `Hey ${name}! Let's make some progress on your fitness journey today.`,
      `Hello ${name}! I'm here to help with your training and fitness needs.`
    ];
    return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  }

  // Reset chat function
  const resetChat = () => {
    setInputValue("");
    setIsLoading(false);
    setDetectedWorkoutType(null);
    if (inputRef.current) {
      inputRef.current.dataset.workoutType = "";
    }
    setMessages([{
      id: "welcome-reset-" + Date.now(),
      role: "assistant",
      content: getRandomWelcomeMessage(userDisplayName)
    }]);
    inputRef.current?.focus();
  };

  // Plan request handlers
  const handlePlanRequest = useCallback(() => {
    if (isLoading) return;
    
    // Create a more explicit system prompt for a balanced workout plan
    const balancedPlanPrompt = `
You are Aivery, an AI fitness coach specializing in balanced workout plans. Create a 7-day workout plan that includes a mix of strength training, cardio, and recovery.

IMPORTANT: This should be a BALANCED fitness plan that includes BOTH strength and cardio, with appropriate rest days.

Create a plan with the following structure:
1. Brief introduction to the balanced plan
2. Weekly schedule overview showing what type of workout will be done each day:
   - Strength days (2-3 days)
   - Cardio days (2-3 days)
   - Recovery/Rest days (1-2 days)
3. For each training day, provide:
   - Workout type (strength or cardio)
   - Specific exercises (for strength) or activity (for cardio)
   - Sets and reps (for strength) or duration/intensity (for cardio)
   - Equipment needed
4. Include recovery recommendations

Consider the user's recent performance metrics:
- Recent strength PRs: Push-ups (20 reps), Sit-ups (50 reps), Dips (3 reps)
- Recent cardio: Running about 12km per week, longest run 6.9km

Format the response using markdown with clear headings and bullet points.
`;

    const userQuery = "Please create my next weeks workout plan";
    setDetectedWorkoutType("mixed");
    sendMessage(userQuery, { 
      requestType: 'generate_plan',
      workoutType: 'mixed',
      systemPrompt: balancedPlanPrompt,
      overrideDefaultPrompt: true
    });
  }, [isLoading, sendMessage]);

  const handleStrengthPlanRequest = useCallback(() => {
    if (isLoading) return;
    
    // Create a more explicit system prompt for strength training
    const strengthSystemPrompt = `
You are Aivery, an AI fitness coach specializing in strength training. Create a 7-day strength training plan focusing on bodyweight and minimal equipment exercises.

IMPORTANT: This is a STRENGTH TRAINING plan, NOT a running plan. Do NOT include running workouts or running metrics.

Create a plan with the following structure:
1. Brief introduction to the plan
2. Weekly schedule overview showing which muscle groups will be trained on which days
3. For each training day, provide:
   - Specific exercises (3-6 per workout)
   - Sets and reps for each exercise
   - Rest periods
   - Difficulty progression options
4. Include at least 2 rest/recovery days

The user has the following equipment available:
- Body weight
- Resistance bands
- A pair of dumbbells
- A pull-up bar (optional)

The user's recent PRs:
- Push-ups: 20 reps
- Sit-ups: 50 reps
- Dips: 3 reps

Format the response using markdown with clear headings and bullet points.
`;

    const userQuery = "Create a strength training plan for next week with minimal equipment";
    setDetectedWorkoutType("strength");
    sendMessage(userQuery, { 
      requestType: 'generate_plan',
      workoutType: 'strength',
      systemPrompt: strengthSystemPrompt, // Add custom system prompt
      overrideDefaultPrompt: true // Signal to backend to use our prompt instead
    });
  }, [isLoading, sendMessage]);

  const handleCardioRequest = useCallback(() => {
    if (isLoading) return;
    const userQuery = "Create a cardio workout plan for next week";
    setDetectedWorkoutType("cardio");
    sendMessage(userQuery, { 
      requestType: 'generate_plan',
      workoutType: 'cardio'
      // No custom prompt needed for cardio since the backend already focuses on running
    });
  }, [isLoading, sendMessage]);

  const handleHomeWorkoutRequest = useCallback(() => {
    if (isLoading) return;
    
    // Create a more explicit system prompt for home workouts
    const homeWorkoutSystemPrompt = `
You are Aivery, an AI fitness coach specializing in home workouts. Create a 7-day home workout plan focusing on bodyweight exercises that can be done without special equipment.

IMPORTANT: This is a HOME WORKOUT plan, NOT a running plan. Do NOT include running workouts or running metrics.

Create a plan with the following structure:
1. Brief introduction to the home workout plan
2. Weekly schedule overview showing which muscle groups will be trained on which days
3. For each training day, provide:
   - Specific exercises (3-6 per workout)
   - Sets and reps for each exercise
   - Difficulty options for beginners and advanced
   - Estimated workout duration
4. Include at least 2 rest/recovery days

The user has NO special equipment beyond:
- Their own body weight
- A yoga mat
- Perhaps a chair or stable surface

The user's recent PRs:
- Push-ups: 20 reps
- Sit-ups: 50 reps
- Dips: 3 reps

Format the response using markdown with clear headings and bullet points.
`;

    const userQuery = "Create a home workout routine with bodyweight exercises";
    setDetectedWorkoutType("bodyweight");
    sendMessage(userQuery, { 
      requestType: 'generate_plan',
      workoutType: 'bodyweight',
      systemPrompt: homeWorkoutSystemPrompt, // Add custom system prompt
      overrideDefaultPrompt: true // Signal to backend to use our prompt instead
    });
  }, [isLoading, sendMessage]);

  const handleReviewRequest = useCallback(() => {
    if (isLoading) return;
    const userQuery = "Can you review my last week's performance and progress?";
    setDetectedWorkoutType(null);
    sendMessage(userQuery, { 
      requestType: 'generate_weekly_review'
    });
  }, [isLoading, sendMessage]);

  // Function to get workout type icon
  const getWorkoutTypeIcon = (type: string | null) => {
    switch (type) {
      case 'strength':
        return <span className="font-bold">💪</span>;
      case 'cardio':
        return <span className="font-bold">🏃‍♂️</span>;
      case 'bodyweight':
        return <span className="font-bold">🏠</span>;
      case 'mixed':
        return <span className="font-bold">🔄</span>;
      default:
        return null;
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-65px)] md:h-screen container mx-auto px-0 md:py-0">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h1 className="text-lg font-semibold">Chat with Aivery</h1>
        <Button variant="ghost" size="icon" onClick={resetChat} title="Reset Chat">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Card contains the scrollable area */}
      <Card className="flex-1 flex flex-col border-0 shadow-none rounded-none">
        <ScrollArea className="flex-1 p-4 pb-40" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Floating Input Area */}
      <div className="fixed bottom-4 left-4 right-4 z-10 max-w-3xl mx-auto bg-background border border-border rounded-3xl shadow-lg px-4 py-3">
        {/* Command categories */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <CommandButton
            icon={<BookOpen className="w-4 h-4" />}
            label="Learn"
            isActive={activeCommandCategory === "learn"}
            onClick={() => toggleCommandCategory("learn")}
          />
          <CommandButton
            icon={<CalendarPlus className="w-4 h-4" />}
            label="Plan"
            isActive={activeCommandCategory === "plan"}
            onClick={() => toggleCommandCategory("plan")}
          />
          <CommandButton
            icon={<ClipboardCheck className="w-4 h-4" />}
            label="Track"
            isActive={activeCommandCategory === "track"}
            onClick={() => toggleCommandCategory("track")}
          />
        </div>

        {/* Command suggestions */}
        <AnimatePresence>
          {activeCommandCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-2 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">
                    {activeCommandCategory === "learn"
                      ? "Learning suggestions"
                      : activeCommandCategory === "plan"
                      ? "Workout planning"
                      : "Progress tracking"}
                  </h3>
                </div>
                <ul className="divide-y divide-border">
                  {commandSuggestions[
                    activeCommandCategory as keyof typeof commandSuggestions
                  ].map((suggestion, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleCommandSelect(suggestion)}
                      className="p-2.5 hover:bg-muted cursor-pointer transition-colors duration-75"
                    >
                      <div className="flex items-center gap-2">
                        {activeCommandCategory === "learn" ? (
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                        ) : activeCommandCategory === "plan" ? (
                          <CalendarPlus className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ClipboardCheck className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span className="text-sm text-foreground">
                          {suggestion}
                        </span>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-muted py-1 px-2 rounded-md border border-border"
                >
                  <FileText className="w-3 h-3 text-primary" />
                  <span className="text-xs text-muted-foreground">{file}</span>
                  <button
                    onClick={() =>
                      setUploadedFiles((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative w-full flex items-center">
          <Input
            ref={inputRef}
            placeholder="Ask anything about fitness..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="flex-1 h-12 rounded-full pl-4 pr-12 border-border shadow-sm bg-background"
            autoComplete="off"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            title="Send message"
          >
            {isLoading ? (
              <InlineSpinner size={16} className="text-current" />
            ) : (
              <LucideSend className="h-4 w-4 text-current" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}