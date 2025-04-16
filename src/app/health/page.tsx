"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LucideCheck, LucideLoader, LucideRefreshCw } from "lucide-react"
import { Header } from "@/components/header"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

export default function HealthCheckPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState<{
    status: string
    timestamp: string
    environment: string
  } | null>(null)

  const checkHealth = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/health")
      const data = await response.json()
      setHealthStatus(data)
    } catch (error) {
      console.error("Error checking health:", error)
      setHealthStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Health Check</h1>
            <p className="text-muted-foreground mt-2">Verify that the application is running correctly</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Application Status</CardTitle>
              <Button onClick={checkHealth} variant="outline" size="sm" disabled={isLoading}>
                {isLoading ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LucideRefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
            <CardDescription>Shows the current status of the application</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingIndicator />
            ) : healthStatus ? (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <LucideCheck className="h-4 w-4 text-green-600" />
                  <AlertTitle>Application is Running</AlertTitle>
                  <AlertDescription>The application is running in {healthStatus.environment} mode.</AlertDescription>
                </Alert>

                <div className="p-4 border rounded-md bg-muted/50">
                  <h3 className="text-sm font-medium mb-2">Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Status:</div>
                    <div>{healthStatus.status}</div>

                    <div className="font-medium">Environment:</div>
                    <div>{healthStatus.environment}</div>

                    <div className="font-medium">Timestamp:</div>
                    <div>{new Date(healthStatus.timestamp).toLocaleString()}</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    The application is functioning correctly. Even if the database connection fails, the app will
                    continue to work with mock data.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Unable to check application status.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

