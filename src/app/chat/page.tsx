"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LucideSend, LucideUser, LucideBot, LucideLoader } from "lucide-react"
import { Header } from "@/components/header"
import { fetchWorkout } from "@/lib/workout-actions"
import type { WorkoutData } from "@/types/db"

export default function ChatPage() {
  const [workoutToAnalyze, setWorkoutToAnalyze] = useState<WorkoutData | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false)
  const [workoutId, setWorkoutId] = useState<string | null>(null)

  // Initialize chat with AI SDK
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    body: {
      workoutId: workoutId,
    },
    initialMessages: [
      {
        id: "welcome-message",
        role: "assistant",
        content:
          "Hi there! I'm Aivery, your AI fitness coach. I can help you with workout advice, track your progress, or answer any fitness-related questions. How can I help you today?",
      },
    ],
  })

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

            // Automatically send a message to analyze the workout
            const message = `Please analyze my ${workout.name} workout from ${new Date(workout.date).toLocaleDateString()} and provide feedback on my performance and suggestions for improvement.`

            // Add user message
            setMessages([
              ...messages,
              {
                id: Date.now().toString(),
                role: "user",
                content: message,
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

  return (
    <>
      <Header />
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
          <CardHeader>
            <CardTitle>Chat with your AI Fitness Coach</CardTitle>
            <CardDescription>Ask questions about workouts, nutrition, or get personalized advice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col h-[60vh]">
              <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                <div className="space-y-4 mb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="flex items-start gap-3 max-w-[80%]">
                        {message.role !== "user" && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10">
                              <LucideBot className="h-4 w-4 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === "user" && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10">
                              <LucideUser className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  ))}
                  {(isLoading || isLoadingWorkout) && (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-3 max-w-[80%]">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10">
                            <LucideBot className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-4 py-2 bg-muted">
                          <div className="flex space-x-2">
                            <div
                              className="h-2 w-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            ></div>
                            <div
                              className="h-2 w-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            ></div>
                            <div
                              className="h-2 w-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: "600ms" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about your workouts, nutrition, or fitness goals..."
                  className="flex-1"
                  disabled={isLoading || isLoadingWorkout}
                />
                <Button type="submit" disabled={isLoading || isLoadingWorkout || !input.trim()}>
                  {isLoading ? <LucideLoader className="h-4 w-4 animate-spin" /> : <LucideSend className="h-4 w-4" />}
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested Questions</CardTitle>
            <CardDescription>Not sure what to ask? Try one of these questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4 text-left"
                onClick={() => {
                  handleInputChange({ target: { value: "What's a good workout for building muscle?" } } as any)
                  handleSubmit(new Event("submit") as any)
                }}
                disabled={isLoading || isLoadingWorkout}
              >
                What's a good workout for building muscle?
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4 text-left"
                onClick={() => {
                  handleInputChange({ target: { value: "How can I improve my bench press?" } } as any)
                  handleSubmit(new Event("submit") as any)
                }}
                disabled={isLoading || isLoadingWorkout}
              >
                How can I improve my bench press?
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4 text-left"
                onClick={() => {
                  handleInputChange({ target: { value: "What should I eat before a workout?" } } as any)
                  handleSubmit(new Event("submit") as any)
                }}
                disabled={isLoading || isLoadingWorkout}
              >
                What should I eat before a workout?
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4 text-left"
                onClick={() => {
                  handleInputChange({ target: { value: "How many rest days should I take per week?" } } as any)
                  handleSubmit(new Event("submit") as any)
                }}
                disabled={isLoading || isLoadingWorkout}
              >
                How many rest days should I take per week?
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

