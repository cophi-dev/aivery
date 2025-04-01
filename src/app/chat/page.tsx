"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LucideSend, LucideUser, LucideLoader, LucideRefreshCw } from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import ReactMarkdown from "react-markdown"

// Simple chat page with manually managed messages
export default function ChatPage() {
  const { data: session } = useSession()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatId] = useState(`chat-${Date.now()}`)
  
  // Get user name for personalized welcome
  const userDisplayName = (session?.user as any)?.nickname || session?.user?.name || "there"
  
  // Initialize message state (we'll replace this with AI greeting after initialization)
  const [messages, setMessages] = useState([
    {
      id: "welcome-message",
      role: "assistant",
      content: "Loading your personalized greeting...",
    },
  ])

  // Fetch personalized greeting on initial load
  useEffect(() => {
    const fetchGreeting = async () => {
      if (!session?.user) return; // Don't fetch if not logged in
      
      try {
        setIsLoading(true);
        // Call the chat API with a special message to request a greeting
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "__GREETING__" }],
            chatId
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to get greeting');
        }
        
        // Get the response text (personalized greeting)
        const greeting = await response.text();
        
        // Replace the initial message with the personalized greeting
        setMessages([{
          id: "welcome-message",
          role: "assistant",
          content: greeting || getRandomWelcomeMessage(userDisplayName)
        }]);
      } catch (error) {
        // Fall back to random greeting if the API call fails
        setMessages([{
          id: "welcome-message",
          role: "assistant",
          content: getRandomWelcomeMessage(userDisplayName)
        }]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGreeting();
  }, [session, chatId, userDisplayName]);

  // Get a random welcome message for variety
  function getRandomWelcomeMessage(name: string): string {
    const welcomeMessages = [
      `Hey ${name}! 👋 I'm your fitness coach. What can I help you with today?`,
      `Hi ${name}! Ready to crush some fitness goals today? I'm here to help!`,
      `Welcome ${name}! I'm your AI fitness buddy. How's your training going?`,
      `Hey there ${name}! 💪 What aspect of your fitness journey can I support you with today?`,
      `Hi ${name}! I'm your personal fitness assistant. What's on your workout agenda?`
    ]
    return welcomeMessages[Math.floor(Date.now() % welcomeMessages.length)]
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!input.trim()) return
    
    // Add user message to state
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    
    try {
      // Call the chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId: chatId
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to get response')
      }
      
      // Check if response body exists
      if (!response.body) {
        throw new Error('Response body is null')
      }
      
      // Create a new element for the AI response
      const aiMessageId = `ai-${Date.now()}`
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: "assistant",
        content: ""
      }])
      
      try {
        // Get the text response
        const text = await response.text()
        
        // Extract actual content from the formatted response
        let cleanContent = ""
        
        // Parse the response by removing the special formatting if present
        if (text.includes('0:"')) {
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              // Check if it contains actual text content (typically after 0:")
              const contentMatch = line.match(/0:"([^"]*)"/)
              if (contentMatch && contentMatch[1]) {
                cleanContent += contentMatch[1]
              } else if (!line.includes('f:') && !line.includes('e:') && !line.includes('d:')) {
                // If no special formatting, just add the raw line
                cleanContent += line
              }
            }
          }
        } else {
          // If no special formatting, use the raw text
          cleanContent = text
        }
        
        // If we couldn't extract anything sensible, use a fallback
        if (!cleanContent) {
          cleanContent = "I'm here to help with your fitness journey. What would you like to know?"
        }
        
        // Update the message with the cleaned content
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? {...msg, content: cleanContent} : msg
        ))
      } catch (error) {
        // Use a fallback message
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? {...msg, content: "I'm here to help with your fitness journey. What would you like to know?"} 
            : msg
        ))
      }
      
      setIsLoading(false)
    } catch (error) {
      // Add an error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }])
      
      setIsLoading(false)
    }
  }

  // Force reset the chat to initial state
  const resetChat = () => {
    // Start with a loading state
    setMessages([
      {
        id: "welcome-message",
        role: "assistant",
        content: "Loading your personalized greeting...",
      },
    ])
    
    // Fetch a new personalized greeting
    const fetchGreeting = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "__GREETING__" }],
            chatId: `chat-${Date.now()}` // Generate a new chat ID for fresh context
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to get greeting');
        }
        
        const greeting = await response.text();
        
        setMessages([{
          id: "welcome-message",
          role: "assistant",
          content: greeting || getRandomWelcomeMessage(userDisplayName)
        }]);
      } catch (error) {
        setMessages([{
          id: "welcome-message",
          role: "assistant",
          content: getRandomWelcomeMessage(userDisplayName)
        }]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGreeting();
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Main chat UI
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">AI Fitness Coach</h1>
          <p className="text-muted-foreground mt-2">Get personalized advice and track your fitness journey</p>
        </div>
        <div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetChat}
            className="mt-4 md:mt-0 flex items-center gap-2"
          >
            <LucideRefreshCw className="h-4 w-4" />
            Reset Chat
          </Button>
          {/* Temporary debug button - remove in production */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Copy ID to clipboard
              if (session?.user?.id) {
                navigator.clipboard.writeText(session.user.id)
                  .then(() => alert(`User ID copied to clipboard: ${session.user.id}`))
                  .catch(() => alert(`Your user ID is: ${session.user.id}`));
              } else {
                alert("Not logged in or no user ID available");
              }
            }}
            className="mt-4 md:mt-0 ml-2 flex items-center gap-2"
          >
            Debug: Copy User ID
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="p-4">
          <ScrollArea className="h-[500px] pr-4" ref={scrollAreaRef}>
            <div className="flex flex-col space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id} 
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  } gap-3 mb-4`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-9 w-9 mt-1">
                      <AvatarFallback className="bg-blue-600 text-white">AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg p-4 max-w-[85%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert">
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert">
                        {message.content}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-9 w-9 mt-1">
                      {session?.user?.image ? (
                        <Image 
                          src={session.user.image} 
                          alt={(session.user as any).nickname || session.user.name || "User"} 
                          width={36} 
                          height={36} 
                          className="rounded-full"
                        />
                      ) : (
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {(session?.user as any)?.nickname 
                            ? (session?.user as any).nickname.charAt(0).toUpperCase() 
                            : session?.user?.name 
                              ? session?.user?.name.charAt(0).toUpperCase() 
                              : <LucideUser className="h-4 w-4" />}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start gap-3">
                  <Avatar className="h-9 w-9 mt-1">
                    <AvatarFallback className="bg-blue-600 text-white">AI</AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-muted">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                    </div>
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
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
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

