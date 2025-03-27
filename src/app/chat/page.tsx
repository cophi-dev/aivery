"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LucideSend, LucideUser, LucideBot, LucideLoader, LucideBarChart, LucideActivity, LucideCalendar, LucideArrowRight, Flame as LucideFire, LucideTimer, LucideDumbbell } from "lucide-react"
import { fetchWorkout, fetchWorkouts } from "@/lib/workout-actions"
import type { WorkoutData } from "@/types/db"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { useSession } from "next-auth/react"

// Helper function to fetch workout data for the AI
async function fetchWorkoutData(query: any) {
  try {
    const response = await fetch('/api/workout-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch workout data')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching workout data:', error)
    return { error: 'Failed to fetch data' }
  }
}

function ChatMessage({ message, onRemoveThinkingMessage }: { message: any, onRemoveThinkingMessage?: (id: string) => void }) {
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedContent, setProcessedContent] = useState(message.content);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataReady, setIsDataReady] = useState(false);
  
  // Loading animation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isProcessing) {
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          // Progress to 90% during processing, the final jump happens when data arrives
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 400);
    } else if (loadingProgress > 0) {
      // Jump to 100% when processing is complete
      setLoadingProgress(100);
      
      // Reset the progress after animation completes
      interval = setTimeout(() => {
        setLoadingProgress(0);
      }, 500) as unknown as NodeJS.Timeout;
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);
  
  // Process any data fetch requests on mount and when content changes
  useEffect(() => {
    const processFetchRequests = async () => {
      // Check if the message contains a fetch request
      const fetchPattern = /\[FETCH_WORKOUT_DATA: ({.*?})\]/;
      
      if (fetchPattern.test(message.content)) {
        // Set to processing state - delay starting animation slightly
        setTimeout(() => {
          setIsProcessing(true);
          setLoadingProgress(5);
        }, 200);
        
        try {
          // Parse for API fetch requests in the format [FETCH_WORKOUT_DATA: {...}]
          const fetchPatternG = /\[FETCH_WORKOUT_DATA: ({.*?})\]/g;
          let match;
          let updatedContent = message.content;
          
          // For each fetch request found in the AI's response
          while ((match = fetchPatternG.exec(message.content)) !== null) {
            try {
              // Parse the query parameters
              const queryParams = JSON.parse(match[1]);
              
              // Artificial delay for better UX
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Fetch the workout data
              const data = await fetchWorkoutData(queryParams);
              setWorkoutData(data);
              
              // Replace the fetch placeholder with the actual data
              const placeholder = match[0];
              
              // Instead of showing the raw data, process it into a user-friendly summary
              // For AI's phrasing, keep everything before the fetch command
              const textBeforeFetch = updatedContent.substring(0, match.index).trim();
              
              // Set proper AI introduction based on data type
              let introText = textBeforeFetch || "Based on my analysis of your workout data:";
              
              // Ensure we're not getting any artifacts in the final text
              if (introText.includes("[FETCH_WORKOUT_DATA:")) {
                introText = "Based on my analysis of your workout data:";
              }
              
              updatedContent = introText;
            } catch (error) {
              console.error("Error processing workout data fetch:", error);
              // Replace with error message
              updatedContent = "Sorry, I encountered an error analyzing your workout data. Please try again.";
            }
          }
          
          // Update the processed content
          setProcessedContent(updatedContent);
        } catch (error) {
          console.error('Error processing data in message:', error);
        } finally {
          // Allow a moment for the progress to get to 100%
          setTimeout(() => {
            setIsProcessing(false);
          }, 300);
        }
      } else if (message.content.includes("Let me analyze your workouts") || 
                 message.content.includes("check your workout data") || 
                 message.content.includes("pull up your workout statistics")) {
        // This is a message that needs workout data
        setIsProcessing(true);
        setLoadingProgress(25);
        
        try {
          // Fetch the workout data based on the content of the message
          let queryType = 'stats';
          
          if (message.content.toLowerCase().includes('running')) {
            queryType = 'running';
          } else if (message.content.toLowerCase().includes('strength')) {
            queryType = 'strength';
          }
          
          // Artificial delay for better UX
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Fetch the workout data
          const data = await fetchWorkoutData({
            type: queryType,
            limit: 10
          });
          
          setWorkoutData(data);
          setIsDataReady(true);
        } catch (error) {
          console.error('Error fetching workout data:', error);
        } finally {
          setTimeout(() => {
            setIsProcessing(false);
          }, 300);
        }
      }
    };
    
    processFetchRequests();
  }, [message.content]);
  
  // Process any [DATA:...] occurrences that might already be in the message
  useEffect(() => {
    // Only process if not already processing fetch requests
    if (!isProcessing && processedContent.includes('[DATA:')) {
      try {
        // Extract the data portion
        const dataMatch = processedContent.match(/\[DATA: ({.*?})\]/);
        if (dataMatch && dataMatch[1]) {
          // Parse the data
          const data = JSON.parse(dataMatch[1]);
          setWorkoutData(data);
          
          // Replace the content with formatted data
          let formattedContent = processedContent.replace(/\[DATA: ({.*?})\]/, '');
          
          setProcessedContent(formattedContent);
        }
      } catch (error) {
        console.error('Error processing data in message:', error);
      }
    }
  }, [isProcessing, processedContent]);

  // Helper function to determine if data should be displayed as cards
  const shouldShowDataCards = () => {
    return message.role === 'assistant' && workoutData && !isProcessing;
  };
  
  // Add a mock data function for direct testing
  const getMockWorkoutData = (type: string) => {
    if (type === 'running') {
      return {
        insights: {
          totalDistance: 547.20,
          avgPace: 6.58,
          longestRun: 12.5
        },
        workouts: Array(10).fill(0).map((_, i) => ({
          date: new Date(Date.now() - i * 86400000).toISOString(),
          distance: 5 + Math.random() * 7,
          duration: 30 + Math.random() * 30
        }))
      };
    } else if (type === 'strength') {
      return {
        insights: {
          totalVolume: 12500,
          mostFrequentExercises: [
            { name: 'Squat', count: 12 },
            { name: 'Bench Press', count: 10 },
            { name: 'Deadlift', count: 8 },
            { name: 'Shoulder Press', count: 6 }
          ]
        },
        workouts: Array(8).fill(0).map((_, i) => ({
          date: new Date(Date.now() - i * 86400000).toISOString(),
          exercises: 4 + Math.round(Math.random() * 3)
        }))
      };
    } else {
      return {
        stats: {
          totalWorkouts: 86,
          totalDuration: 4320,
          statsByType: [
            { type: 'Running', count: 42 },
            { type: 'Strength', count: 26 },
            { type: 'Cycling', count: 12 },
            { type: 'Swimming', count: 6 }
          ]
        }
      };
    }
  };

  // Process data based on message content
  useEffect(() => {
    if (message.role === 'assistant' && !isProcessing && !workoutData) {
      const content = message.content.toLowerCase();
      
      // Check for workout data triggers
      if (content.includes('let me analyze your workouts') && content.includes('running')) {
        // Set to processing state
        setIsProcessing(true);
        setLoadingProgress(10);
        
        // Simulate data fetch with a timeout
        setTimeout(() => {
          setWorkoutData(getMockWorkoutData('running'));
          setLoadingProgress(100);
          
          setTimeout(() => {
            setIsProcessing(false);
          }, 400);
        }, 1500);
      } 
      else if (content.includes('let me check your strength workout data')) {
        setIsProcessing(true);
        setLoadingProgress(10);
        
        setTimeout(() => {
          setWorkoutData(getMockWorkoutData('strength'));
          setLoadingProgress(100);
          
          setTimeout(() => {
            setIsProcessing(false);
          }, 400);
        }, 1500);
      }
      else if (content.includes('let me pull up your workout statistics')) {
        setIsProcessing(true);
        setLoadingProgress(10);
        
        setTimeout(() => {
          setWorkoutData(getMockWorkoutData('stats'));
          setLoadingProgress(100);
          
          setTimeout(() => {
            setIsProcessing(false);
          }, 400);
        }, 1500);
      }
    }
  }, [message.content, message.role, isProcessing, workoutData]);
  
  // Render workout data visualization
  const renderWorkoutDataCards = () => {
    if (!workoutData) return null;
    
    // For running workouts
    if (workoutData.insights && workoutData.insights.totalDistance) {
      return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideActivity className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Distance</div>
            </div>
            <div className="text-2xl font-bold">{workoutData.insights.totalDistance.toFixed(2)} km</div>
            <div className="text-xs text-muted-foreground mt-1">
              From {workoutData.workouts.length} running workouts
            </div>
          </div>
          
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideTimer className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Average Pace</div>
            </div>
            <div className="text-2xl font-bold">{workoutData.insights.avgPace.toFixed(2)} min/km</div>
            <div className="text-xs text-muted-foreground mt-1">
              Your average pace across all runs
            </div>
          </div>
          
          {workoutData.workouts.length > 0 && (
            <div className="col-span-1 md:col-span-2 bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <LucideBarChart className="h-4 w-4 text-primary" />
                <div className="font-medium text-sm">Activity Overview</div>
              </div>
              <div className="flex items-end h-20 gap-1 mt-3">
                {workoutData.workouts.slice(0, 10).map((workout: any, i: number) => (
                  <div key={i} className="relative flex-1">
                    <div 
                      className="bg-primary hover:bg-primary/80 rounded-sm transition-all duration-200"
                      style={{ 
                        height: `${Math.max(20, (workout.distance || 0) / (workoutData.insights.longestRun || 1) * 100)}%`,
                      }}
                      title={`${new Date(workout.date).toLocaleDateString()}: ${workout.distance?.toFixed(2) || 0} km`}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">Your 10 most recent runs</div>
            </div>
          )}
        </div>
      );
    }
    
    // For strength workouts
    else if (workoutData.insights && workoutData.insights.totalVolume) {
      return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideDumbbell className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Total Volume</div>
            </div>
            <div className="text-2xl font-bold">{workoutData.insights.totalVolume.toFixed(0)} kg</div>
            <div className="text-xs text-muted-foreground mt-1">
              From {workoutData.workouts.length} strength workouts
            </div>
          </div>
          
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideFire className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Average Per Workout</div>
            </div>
            <div className="text-2xl font-bold">{(workoutData.insights.totalVolume / workoutData.workouts.length).toFixed(0)} kg</div>
            <div className="text-xs text-muted-foreground mt-1">
              Your average volume lifted
            </div>
          </div>
          
          {workoutData.insights.mostFrequentExercises && workoutData.insights.mostFrequentExercises.length > 0 && (
            <div className="col-span-1 md:col-span-2 bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <LucideBarChart className="h-4 w-4 text-primary" />
                <div className="font-medium text-sm">Most Frequent Exercises</div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {workoutData.insights.mostFrequentExercises.map((ex: any, i: number) => (
                  <Badge key={i} variant="outline" className="bg-primary/10">
                    {ex.name} ({ex.count}x)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // For general stats
    else if (workoutData.stats) {
      return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideActivity className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Total Workouts</div>
            </div>
            <div className="text-2xl font-bold">{workoutData.stats.totalWorkouts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              All your recorded workouts
            </div>
          </div>
          
          <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <LucideTimer className="h-4 w-4 text-primary" />
              <div className="font-medium text-sm">Total Duration</div>
            </div>
            <div className="text-2xl font-bold">{workoutData.stats.totalDuration} min</div>
            <div className="text-xs text-muted-foreground mt-1">
              Time spent exercising
            </div>
          </div>
          
          {workoutData.stats.statsByType && workoutData.stats.statsByType.length > 0 && (
            <div className="col-span-1 md:col-span-2 bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/10">
              <div className="flex items-center gap-2 mb-3">
                <LucideBarChart className="h-4 w-4 text-primary" />
                <div className="font-medium text-sm">Workout Type Distribution</div>
              </div>
              <div className="flex items-end h-24 gap-2">
                {workoutData.stats.statsByType.map((typeStat: any, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div 
                      className="bg-primary w-full rounded-sm" 
                      style={{ 
                        height: `${Math.max(15, (typeStat.count / workoutData.stats.totalWorkouts) * 100)}%` 
                      }}
                    ></div>
                    <div className="text-xs truncate w-full text-center">
                      {typeStat.type}
                    </div>
                    <div className="text-xs font-medium">
                      {typeStat.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  // Render content based on state
  const renderMessageContent = () => {
    // Show loading state
    if (isProcessing || loadingProgress > 0) {
      return (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <LucideLoader className="h-4 w-4 animate-spin text-primary" />
            <span>{message.content.includes("Let me") ? message.content : "Analyzing your workout data..."}</span>
          </div>
          <div className="space-y-3">
            <div className="w-full h-1 bg-muted-foreground/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="bg-background/40 rounded-md p-3">
              <div className="h-2 bg-muted-foreground/20 rounded animate-pulse mb-2 w-3/4"></div>
              <div className="h-2 bg-muted-foreground/20 rounded animate-pulse mb-2"></div>
              <div className="h-2 bg-muted-foreground/20 rounded animate-pulse mb-2 w-5/6"></div>
              <div className="h-2 bg-muted-foreground/20 rounded animate-pulse w-2/3"></div>
            </div>
          </div>
        </div>
      );
    }
    
    // Normal content with potential data cards
    return (
      <div className="space-y-4">
        <div className="prose prose-sm dark:prose-invert">
          {processedContent.split('\n').map((line: string, i: number) => (
            <p key={i} className={i === 0 ? 'mt-0' : ''}>{line}</p>
          ))}
        </div>
        
        {(shouldShowDataCards() || (message.role === 'assistant' && workoutData && !isProcessing)) && renderWorkoutDataCards()}
      </div>
    );
  };
  
  // Don't show any loading UI for thinking messages as we'll replace them
  const isThinkingMessage = message.id?.startsWith('thinking-') || false;
  
  // Return basic content for thinking messages
  if (isThinkingMessage) {
    // Use the timeout to automatically remove thinking messages after a while
    useEffect(() => {
      // Auto-remove thinking messages after 10 seconds to prevent stuck UI
      const timeout = setTimeout(() => {
        if (onRemoveThinkingMessage && message.id) {
          onRemoveThinkingMessage(message.id);
        }
      }, 10000);
      
      return () => clearTimeout(timeout);
    }, [message.id, onRemoveThinkingMessage]);
    
    return (
      <div className={`flex justify-start gap-3 mb-4`}>
        <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/20" data-testid="ai-avatar">
          <AvatarFallback className="bg-blue-600 text-white overflow-hidden flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              <svg 
                width="30" 
                height="30" 
                viewBox="0 0 30 30" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="30" height="30" fill="#4F46E5" />
                <rect x="5" y="5" width="20" height="14" rx="3" fill="#FFFFFF" />
              </svg>
              <LucideLoader className="h-4 w-4 animate-spin absolute" />
            </div>
          </AvatarFallback>
        </Avatar>
        <div className="rounded-lg p-3 bg-muted">
          <div className="flex flex-col gap-2">
            <div className="h-2 bg-muted-foreground/20 rounded animate-pulse w-24"></div>
            <div className="h-2 bg-muted-foreground/20 rounded animate-pulse w-16"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex justify-${message.role === "user" ? "end" : "start"} gap-3 mb-4`}>
      {message.role === "assistant" && (
        <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/20" data-testid="ai-avatar">
          <AvatarFallback className="bg-blue-600 text-white overflow-hidden flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              <svg 
                width="30" 
                height="30" 
                viewBox="0 0 30 30" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="30" height="30" fill="#4F46E5" />
                <rect x="5" y="5" width="20" height="14" rx="3" fill="#FFFFFF" />
                <circle cx="11" cy="12" r="2" fill="#4F46E5" />
                <circle cx="19" cy="12" r="2" fill="#4F46E5" />
                <path d="M12 16C14 18 16 18 18 16" stroke="#4F46E5" strokeWidth="2" />
              </svg>
            </div>
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`rounded-lg p-4 ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        } max-w-[85%]`}
      >
        {renderMessageContent()}
      </div>
      {message.role === "user" && (
        <Avatar className="h-9 w-9 mt-1 ring-2 ring-secondary/20" data-testid="user-avatar">
          {session?.user?.image ? (
            <Image 
              src={session.user.image} 
              alt={session.user.name || "User"} 
              width={36} 
              height={36} 
              className="rounded-full"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <LucideUser className="h-4 w-4" />}
            </AvatarFallback>
          )}
        </Avatar>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [workoutToAnalyze, setWorkoutToAnalyze] = useState<WorkoutData | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null)
  
  // Initialize with default welcome message
  const initialMessages = [
    {
      id: "welcome-message",
      role: "assistant" as const,
      content: "Hi there! I'm Aivery, your AI fitness coach. I can help you with workout advice, track your progress, or answer any fitness-related questions. How can I help you today?",
    },
  ]

  // Configure the AI chat with access to workout data
  const { messages, input, handleInputChange, handleSubmit: originalHandleSubmit, isLoading, setMessages, append } = useChat({
    api: "/api/chat",
    initialMessages,
    body: {
      workoutId
    },
    // The onFinish handler now handles completion of messages
    onFinish: async (message) => {
      // The ChatMessage component handles fetch requests directly
      setIsThinking(false);
      console.log("Message completed:", message.id);
    }
  })
  
  // Wrap handleSubmit to show the thinking state first
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Only send if there's input
    if (!input.trim()) return;
    
    // Show thinking state first
    setIsThinking(true);
    
    // Add a temporary "thinking" message with a random response
    const thinkingResponses = [
      "Let me check your workout data, I'll be right back...",
      "Analyzing your fitness information, one moment please...",
      "I'm processing that request for you now...",
      "Checking your workout history, just a second...",
      "Looking into that for you, I'll have an answer shortly..."
    ];
    
    const thinkingResponse = thinkingResponses[Math.floor(Math.random() * thinkingResponses.length)];
    
    // Add the thinking message with a special ID to identify it later
    const newThinkingId = `thinking-${Date.now()}`;
    setThinkingMessageId(newThinkingId);
    
    append({
      id: newThinkingId,
      role: "assistant",
      content: thinkingResponse
    });
    
    // Then submit the actual message
    originalHandleSubmit(e);
  }
  
  // Update the onFinish handler
  useEffect(() => {
    if (!isLoading && thinkingMessageId) {
      // When the AI message completes, remove any thinking messages
      setMessages(prev => prev.filter(m => !m.id?.startsWith('thinking-')));
      setThinkingMessageId(null);
    }
  }, [isLoading, thinkingMessageId, setMessages]);
  
  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('aivery-chat-messages', JSON.stringify(messages))
    }
  }, [messages])
  
  // Load messages from localStorage on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('aivery-chat-messages')
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages)
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            setMessages(parsedMessages)
          }
        } catch (e) {
          console.error('Error parsing saved messages:', e)
        }
      }
    }
  }, [])

  // Check for workout analysis request in URL
  useEffect(() => {
    const checkForAnalysisRequest = async () => {
      // Check if there's a workout ID in the URL to analyze
      const params = new URLSearchParams(window.location.search)
      const analyzeId = params.get("analyze")

      if (analyzeId) {
        setIsLoadingWorkout(true)
        setWorkoutId(analyzeId)

        try {
          // Fetch the workout data
          const workout = await fetchWorkout(analyzeId)
          if (workout) {
            setWorkoutToAnalyze(workout)

            // Create a more specific message based on workout type for better AI analysis
            let analysisMessage = ""
            
            if (workout.type === "running") {
              analysisMessage = `Please analyze my ${workout.name} running workout from ${new Date(workout.date).toLocaleDateString()}. I'm interested in my pace, heart rate zones, effort level, and how this compares to my previous runs. What specific improvements should I focus on?`
            } else if (workout.type === "cycling") {
              analysisMessage = `Please analyze my ${workout.name} cycling workout from ${new Date(workout.date).toLocaleDateString()}. I'd like to understand my performance in terms of speed, heart rate, and endurance. How does this compare to my previous rides and what can I improve?`
            } else if (workout.type === "swimming") {
              analysisMessage = `Please analyze my ${workout.name} swimming workout from ${new Date(workout.date).toLocaleDateString()}. I'd like feedback on my pace, overall performance, and how this compares to my previous swims. What should I focus on to improve?`
            } else if (workout.type === "strength") {
              analysisMessage = `Please analyze my ${workout.name} strength workout from ${new Date(workout.date).toLocaleDateString()}. I'd like feedback on my exercise selection, volume, and intensity. How effective was this workout and what improvements would you suggest?`
            } else {
              // Generic message for other workout types
              analysisMessage = `Please analyze my ${workout.name} workout from ${new Date(workout.date).toLocaleDateString()} and provide feedback on my performance and suggestions for improvement.`
            }

            // Add user message
            setMessages([
              ...messages,
              {
                id: Date.now().toString(),
                role: "user",
                content: analysisMessage,
              },
            ])

            // Clear URL parameter after processing
            const newUrl = window.location.pathname
            window.history.replaceState({}, "", newUrl)
          }
        } catch (error) {
          console.error("Error fetching workout for analysis:", error)
        } finally {
          setIsLoadingWorkout(false)
        }
      }
    }

    checkForAnalysisRequest()
  }, [])

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current
      scrollArea.scrollTop = scrollArea.scrollHeight
    }
  }, [messages])

  // Helper function to remove thinking message
  const removeThinkingMessage = (id: string) => {
    setMessages(messages.filter(m => m.id !== id));
    setThinkingMessageId(null);
  }

  // Main chat container
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">AI Fitness Coach</h1>
          <p className="text-muted-foreground mt-2">Get personalized advice and track your fitness journey</p>
        </div>
      </div>

      {workoutToAnalyze && (
        <Card className="mb-6 border-primary/50">
          <CardHeader>
            <CardTitle>Analyzing Workout: {workoutToAnalyze.name}</CardTitle>
            <CardDescription>
              Date: {new Date(workoutToAnalyze.date).toLocaleDateString()} | Duration: {workoutToAnalyze.duration} min
              | Intensity: {workoutToAnalyze.intensity}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <p>Aivery is analyzing this workout to provide personalized feedback and suggestions.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardContent className="p-4">
          <ScrollArea className="h-[500px] pr-4" ref={scrollAreaRef}>
            <div className="flex flex-col space-y-4">
              {messages.filter(message => message.role !== "system").map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  onRemoveThinkingMessage={removeThinkingMessage}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start gap-3">
                  <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/20" data-testid="loading-avatar">
                    <AvatarFallback className="bg-blue-600 text-white overflow-hidden flex items-center justify-center">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <svg 
                          width="30" 
                          height="30" 
                          viewBox="0 0 30 30" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect width="30" height="30" fill="#4F46E5" />
                          <rect x="5" y="5" width="20" height="14" rx="3" fill="#FFFFFF" />
                        </svg>
                        <LucideLoader className="h-4 w-4 animate-spin absolute" />
                      </div>
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-muted">
                    <div className="h-2 bg-muted-foreground/20 rounded animate-pulse w-24 mb-2"></div>
                    <div className="h-2 bg-muted-foreground/20 rounded animate-pulse w-16"></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask your AI fitness coach..."
                value={input}
                onChange={handleInputChange}
                disabled={isLoading || isLoadingWorkout || isThinking}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim() || isLoadingWorkout || isThinking}>
                <LucideSend className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

