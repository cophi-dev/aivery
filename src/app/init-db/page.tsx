"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LucideCheck, LucideX, LucideLoader, LucideDatabase } from "lucide-react"
import { Header } from "@/components/header"

export default function InitDbPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    error?: string
    details?: {
      collections: string[]
      userCreated: boolean
      workoutsCreated: boolean
    }
  } | null>(null)

  const initializeDatabase = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/init-db")
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("Error initializing database:", error)
      setResult({
        success: false,
        message: "Failed to initialize database",
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Initialize Database</h1>
            <p className="text-muted-foreground mt-2">Set up the database with sample data</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LucideDatabase className="h-5 w-5 text-primary" />
                <CardTitle>Database Initialization</CardTitle>
              </div>
            </div>
            <CardDescription>Creates necessary collections and sample data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This will create the following in your MongoDB database:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Users collection with a sample user</li>
                <li>Workouts collection with sample workouts</li>
              </ul>

              <div className="flex justify-center mt-6">
                <Button onClick={initializeDatabase} disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <LucideDatabase className="h-4 w-4 mr-2" />
                      Initialize Database
                    </>
                  )}
                </Button>
              </div>

              {result && (
                <Alert
                  className={result.success ? "bg-green-50 border-green-200 mt-6" : "bg-red-50 border-red-200 mt-6"}
                >
                  {result.success ? (
                    <LucideCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <LucideX className="h-4 w-4 text-red-600" />
                  )}
                  <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}

              {result?.details && (
                <div className="p-4 border rounded-md bg-muted/50 mt-4">
                  <h3 className="text-sm font-medium mb-2">Details</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Collections:</strong> {result.details.collections.join(", ")}
                    </p>
                    <p>
                      <strong>User Created:</strong> {result.details.userCreated ? "Yes" : "No (already exists)"}
                    </p>
                    <p>
                      <strong>Workouts Created:</strong> {result.details.workoutsCreated ? "Yes" : "No (already exist)"}
                    </p>
                  </div>
                </div>
              )}

              {result?.error && (
                <div className="p-4 border border-red-200 rounded-md bg-red-50 mt-4">
                  <h3 className="text-sm font-medium text-red-800">Error Details</h3>
                  <pre className="mt-2 text-xs whitespace-pre-wrap text-red-700">{result.error}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>What to do after initializing the database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">After initializing the database, you can:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  Check the database connection on the{" "}
                  <a href="/check-db" className="text-primary hover:underline">
                    Check DB Connection
                  </a>{" "}
                  page
                </li>
                <li>
                  View the sample workouts on the{" "}
                  <a href="/planner" className="text-primary hover:underline">
                    Workout Planner
                  </a>{" "}
                  page
                </li>
                <li>Create new workouts and activities</li>
                <li>Chat with the AI coach about your workouts</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

