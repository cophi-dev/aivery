"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MessageSquare, Send, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Helper to get a random welcome message for variety
function getRandomWelcomeMessage(): string {
  const welcomeMessages = [
    `Hey there! 👋 I'm your fitness coach. How can I help you today?`,
    `Hi! Ready to crush some fitness goals? I'm here to help!`,
    `Welcome! I'm your AI fitness buddy. How's your training going?`,
    `Hey there! 💪 What aspect of your fitness journey can I support you with today?`,
    `Hi! I'm your personal fitness assistant. What's on your workout agenda?`
  ]
  // Simple random selection
  return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
}

export function PersistentChat() {
  const [isOpen, setIsOpen] = useState(false)
  // Initialize with a welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // const [chatId] = useState(`chat-${Date.now()}`) // No longer needed for the new endpoint
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession()
  
  // Get user info - safely handle potential objects
  const userName = (() => {
    const nickname = session?.user ? 
      (typeof (session.user as any)?.nickname === 'string' ? (session.user as any).nickname : null) : 
      null;
    const name = session?.user?.name && typeof session.user.name === 'string' ? session.user.name : null;
    return nickname || name || "there";
  })();

  // Set initial welcome message when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
       setMessages([{
         id: "welcome",
         role: "assistant",
         content: getRandomWelcomeMessage().replace('{userName}', userName) // Personalize if needed
       }]);
    }
  }, [isOpen, messages.length, userName]); // Add userName dependency

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (input.trim() === "") return
    
    // Add user message
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: input
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    
    try {
      // Call the NEW chat API endpoint
      const response = await fetch('/api/ai/coach', { // <--- UPDATED ENDPOINT
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input // <--- UPDATED BODY: Send only the query
          // messages: [...messages, userMessage], // No longer sending history
          // chatId // No longer needed
        }),
      })

      if (!response.ok) {
        // Attempt to get error details from response body
        let errorDetails = 'Failed to get response';
        try {
            const errorData = await response.json();
            errorDetails = errorData.error || errorDetails;
        } catch (parseError) {
            // Ignore if parsing fails, use default message
        }
        throw new Error(errorDetails);
      }

      // Get the JSON response
      const result = await response.json(); // <--- GET JSON RESPONSE
      const aiContent = result.response; // <--- Extract the 'response' field

      console.log("AI Coach API Response Data:", result.data); // Log data for debugging
      console.log("AI Coach Analysis:", result.analysis); // Log analysis for debugging

      // Add the AI response with parsed content
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: aiContent || "I seem to be speechless! Please try asking differently." // Use extracted content
      }])
    } catch (error) {
      console.error("Chat API Error:", error); // Log the actual error
      // Add an error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}` // Show error message
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button className="h-14 w-14 rounded-full shadow-lg" size="icon">
            <MessageSquare className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:max-w-md p-0 h-[80vh] flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>AI Coach Chat</SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback className="bg-blue-600 text-white">AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className={`${message.role === "assistant" ? "prose prose-sm dark:prose-invert" : ""}`}>
                      <p>{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback className="bg-blue-600 text-white">AI</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          <form
            onSubmit={handleSubmit}
            className="border-t p-4 flex items-center space-x-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || input.trim() === ""}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
} 