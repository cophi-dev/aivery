"use client"

import { useRef, useEffect, useState } from "react"
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

// Define Message type clearly
interface Message {
  id: string;
  role: 'user' | 'assistant'; // Use literal types
  content: string;
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
       <div className={cn('px-3 py-1.5 rounded-lg max-w-[75%] break-words', {
         'order-1 bg-primary text-primary-foreground': isUserMessage,
         'order-2 bg-muted': !isUserMessage,
       })}>
         {showLoading ? (
            <div className="flex items-center space-x-1">
                <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce"></span>
            </div>
         ) : (
            <ReactMarkdown 
              className="prose prose-sm dark:prose-invert prose-p:m-0"
              components={{
                p: ({node, ...props}) => <span {...props} /> 
              }}
             >
               {message.content}
             </ReactMarkdown>
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
  const [messages, setMessages] = useState<Message[]>([]); // Initialize as empty

  const userDisplayName = (session?.user as any)?.nickname || session?.user?.name || "there";

  // Focus input on initial mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch initial greeting (simplified)
  useEffect(() => {
     // Directly set a random welcome message on load, removing initial API call
     setMessages([{
          id: "welcome-message-" + Date.now(),
          role: "assistant", // Correct role type
          content: getRandomWelcomeMessage(userDisplayName)
        }]);
    // No dependency array needed if it only runs once
  }, []); // Removed dependencies to run only once

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentMessageContent = input;
    setInput(""); 

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user", // Correct role type
      content: currentMessageContent
    };

    // Add user message and a temporary empty assistant message for loading state
    const loadingAssistantMessage: Message = {
        id: `ai-loading-${Date.now()}`,
        role: "assistant", // Correct role type
        content: "" // Empty content signifies loading in ChatMessage component
    };
    const currentMessages = [...messages, userMessage];
    setMessages([...currentMessages, loadingAssistantMessage]);
    setIsLoading(true);
    
    try {
      // const history = currentMessages; // History not needed for the new endpoint

      // Call the NEW AI coach endpoint
      const response = await fetch('/api/ai/coach', { // <--- UPDATED ENDPOINT
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentMessageContent, // <--- UPDATED BODY: Send only query
          userName: userDisplayName // <-- ADD user's display name
          // history: history 
        }),
      });

      if (!response.ok) {
         let errorBody = "Failed to get response from server.";
         try {
            // Attempt to parse error JSON from the new endpoint
            const errorData = await response.json(); 
            errorBody = errorData.error || errorBody;
        } catch (_) {
            // Fallback if JSON parsing fails or no error field
            try { errorBody = await response.text(); } catch { /* ignore */ }
        }
         console.error("API Error Response:", errorBody);
         throw new Error(`API request failed: ${errorBody}`);
      }
      
      // Get the JSON response from the new endpoint
      const result = await response.json(); // <--- GET JSON RESPONSE
      const text = result.response; // <--- Extract the 'response' field

      console.log("AI Coach API Response Data:", result.data); // Log data for debugging
      console.log("AI Coach Analysis:", result.analysis); // Log analysis for debugging

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant", // Correct role type
        content: text || "Sorry, I couldn't get a proper response."
      };
      
      // Replace the loading message with the actual response
      setMessages(prev => prev.map(msg => 
         msg.id === loadingAssistantMessage.id ? aiMessage : msg
      ));
      // Refocus input after successful response
      inputRef.current?.focus(); 

    } catch (error: any) {
      console.error("Chat Submission Error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant", // Correct role type
        content: error.message || "Sorry, I encountered an error. Please try again."
      };
      // Replace the loading message with the error message
       setMessages(prev => prev.map(msg => 
         msg.id === loadingAssistantMessage.id ? errorMessage : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const resetChat = () => {
     setInput("");
     setIsLoading(false);
     setMessages([{
        id: "welcome-reset-" + Date.now(),
        role: "assistant", // Correct role type
        content: getRandomWelcomeMessage(userDisplayName)
     }]);
     inputRef.current?.focus(); // Focus after reset
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
                {isLoading ? <LucideLoader className="h-4 w-4 animate-spin" /> : <LucideSend className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
      </Card>
    </div>
  );
}

