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

// --- Rate Limit Message Variations ---
const rateLimitVariations = [
  { title: "AI Coach Needs a Cooldown!", body: 'You\'ve maxed out your AI chat reps for today! Time for the coach to recover. Hit up <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a> to discuss upgrading your training plan.' },
  { title: "Coach's Taking a Rest Day!", body: 'You\'ve hit your daily limit for AI coaching insights. Even AIs need rest! Need more session time? Email us at <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "Quick Water Break!", body: 'The AI coach needs a quick hydration break! You\'ve used your AI chat credits for the day. Reach out to <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a> for a refill.' },
  { title: "Max Effort Reached!", body: 'Wow, you crushed your daily AI interaction limit! That\'s max effort! For unlimited coaching power, drop a line to <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "Spotter Tapped Out!", body: 'Your AI coach needs a spot – you\'ve hit the daily rep limit! To add more weight (or chats!), contact <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "End of Set!", body: 'That\'s all the AI coaching sets we can handle today! Ready for the next round tomorrow, or email <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a> to unlock more.' },
  { title: "Coach's Fuel Low!", body: 'The AI needs refueling! You\'ve hit today\'s chat limit. Get a bigger energy tank by emailing <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "Today's AI Workout Complete!", body: 'You\'ve finished your AI coach reps for the day. Awesome job! Want to train longer? Contact <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "Time to Go Pro?", body: 'You\'ve hit the daily limit for free coaching tips. Ready to upgrade your fitness game? Email <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
  { title: "Towel Time!", body: 'Whew! The AI coach is toweling off after a great session! Daily chat limit reached. For unlimited training access, email <a href="mailto:hi@aivery.com" class="underline">hi@aivery.com</a>.' },
];
// --- End Rate Limit Message Variations ---

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false); // State for rate limit status
  const [rateLimitMessage, setRateLimitMessage] = useState<{ title: string; body: JSX.Element | null }>({ title: '', body: null }); // State for the displayed rate limit message
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
    
    if (input.trim() === "" || isRateLimited) return // Prevent submission if rate limited
    
    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, content: input }
    const currentInput = input; // Store input before clearing
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/ai/coach', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: currentInput }), // Send the stored input
      })

      // --- Check for Rate Limit --- 
      if (response.status === 429) {
          const errorData = await response.json();
          console.warn("[Chat] Rate limit hit:", errorData.error);

          // Select a random variation
          const randomIndex = Math.floor(Math.random() * rateLimitVariations.length);
          const selectedVariation = rateLimitVariations[randomIndex];

          // Create JSX for the body with the link
          const bodyParts = selectedVariation.body.split(/<a.*?<\/a>/);
          const linkMatch = selectedVariation.body.match(/<a href="(.*?)" class="(.*?)">(.*?)<\/a>/);

          let bodyJsx: JSX.Element | null = null;
          if (linkMatch) {
              bodyJsx = (
                  <p>
                      {bodyParts[0]}
                      <a href={linkMatch[1]} className={linkMatch[2]}>{linkMatch[3]}</a>
                      {bodyParts[1]}
                  </p>
              );
          } else {
              // Fallback if link parsing fails (shouldn't happen with current variations)
              bodyJsx = <p>{selectedVariation.body}</p>;
          }

          setRateLimitMessage({ title: selectedVariation.title, body: bodyJsx });
          setIsRateLimited(true); // Set rate limited state
          setInput(currentInput); // Restore input field content
          setIsLoading(false); // Stop loading indicator
          return; // Stop further processing
      }
      // --- End Rate Limit Check ---

      if (!response.ok) {
        let errorDetails = 'Failed to get response';
        try {
            const errorData = await response.json();
            errorDetails = errorData.error || `Server responded with status ${response.status}`;
        } catch (parseError) {
             errorDetails = `Server responded with status ${response.status}`;
        }
        throw new Error(errorDetails);
      }
      
      // If response is OK, reset rate limit state (in case it was set previously)
      setIsRateLimited(false);

      const result = await response.json(); 
      const aiContent = result.response;

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: aiContent || "I seem to be speechless! Please try asking differently."
      }])
    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`
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
              {isRateLimited && rateLimitMessage.body && ( // Check if rateLimitMessage.body exists
                <div className="p-3 my-2 rounded-md border border-destructive bg-destructive/10 text-sm text-destructive text-center">
                   <p className="font-medium">{rateLimitMessage.title}</p>
                   {/* Render the JSX body directly */}
                   {rateLimitMessage.body} 
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
              placeholder={isRateLimited ? "Daily limit reached" : "Type your message..."}
              className="flex-1"
              disabled={isLoading || isRateLimited} // Disable input when loading or rate limited
            />
            <Button type="submit" size="icon" disabled={isLoading || input.trim() === "" || isRateLimited}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
} 