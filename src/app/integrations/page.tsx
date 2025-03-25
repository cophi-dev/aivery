"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LucideCheck, LucideLoader, LucideRefreshCw, LucideAlertCircle } from "lucide-react"
import { Header } from "@/components/header"
import { connectStravaAction, syncStravaWorkoutsAction, getStravaIntegrationAction } from "@/lib/strava-actions"

export default function IntegrationsPage() {
  const router = useRouter()
  const [stravaIntegration, setStravaIntegration] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Load Strava integration on page load
  useEffect(() => {
    const loadStrava = async () => {
      try {
        setIsLoading(true)
        const { success, integration, error } = await getStravaIntegrationAction()

        if (success && integration) {
          setStravaIntegration(integration)
        } else if (error) {
          console.warn("Failed to load Strava integration:", error)
        }
      } catch (error) {
        console.error("Error loading Strava integration:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStrava()
  }, [])

  // Handle connect to Strava
  const handleConnectStrava = async () => {
    setIsConnecting(true)
    setAlert(null)

    try {
      // In a real app, we would redirect to Strava OAuth page
      // For demo, we'll simulate with a mock auth code
      const authCode = "mock_auth_code"
      const { success, data, error } = await connectStravaAction(authCode)

      if (success && data) {
        setStravaIntegration({
          id: data.id,
          provider: "strava",
          lastSynced: null,
        })
        setAlert({ type: "success", message: "Successfully connected to Strava" })
      } else {
        setAlert({ type: "error", message: error || "Failed to connect to Strava" })
      }
    } catch (error) {
      console.error("Error connecting to Strava:", error)
      setAlert({ type: "error", message: "An unexpected error occurred" })
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle sync Strava workouts
  const handleSyncStrava = async () => {
    setIsSyncing(true)
    setAlert(null)

    try {
      const { success, count, error } = await syncStravaWorkoutsAction()

      if (success) {
        setAlert({ type: "success", message: `Successfully synced ${count} workouts from Strava` })
        // Refresh Strava integration to update lastSynced
        const result = await getStravaIntegrationAction()
        if (result.success && result.integration) {
          setStravaIntegration(result.integration)
        }
      } else {
        setAlert({ type: "error", message: error || "Failed to sync Strava workouts" })
      }
    } catch (error) {
      console.error("Error syncing Strava workouts:", error)
      setAlert({ type: "error", message: "An unexpected error occurred" })
    } finally {
      setIsSyncing(false)
    }
  }

  // Format date for display
  const formatDate = (date: string | Date | undefined | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleString()
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground mt-2">Connect your fitness trackers and apps</p>
          </div>
        </div>

        {alert && (
          <Alert
            className={`mb-6 ${alert.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
          >
            <LucideAlertCircle className={`h-4 w-4 ${alert.type === "success" ? "text-green-600" : "text-red-600"}`} />
            <AlertTitle>{alert.type === "success" ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Strava */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-muted rounded-full p-2">
                  <img src="/placeholder.svg?height=40&width=40" alt="Strava" className="h-10 w-10" />
                </div>
                <div>
                  <CardTitle>Strava</CardTitle>
                  <CardDescription>Sync your Strava workouts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <LucideLoader className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : stravaIntegration ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LucideCheck className="h-4 w-4 text-green-600" />
                    <span>Connected</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last synced: {formatDate(stravaIntegration.lastSynced)}
                  </div>
                  <Button onClick={handleSyncStrava} disabled={isSyncing} className="w-full">
                    {isSyncing ? (
                      <>
                        <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <LucideRefreshCw className="h-4 w-4 mr-2" />
                        Sync Workouts
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button onClick={handleConnectStrava} disabled={isConnecting} className="w-full">
                  {isConnecting ? (
                    <>
                      <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect to Strava"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Placeholder for additional services */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-muted rounded-full p-2">
                  <img src="/placeholder.svg?height=40&width=40" alt="Garmin Connect" className="h-10 w-10" />
                </div>
                <div>
                  <CardTitle>Garmin Connect</CardTitle>
                  <CardDescription>Sync your Garmin workouts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Placeholder for additional services */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-muted rounded-full p-2">
                  <img src="/placeholder.svg?height=40&width=40" alt="COROS" className="h-10 w-10" />
                </div>
                <div>
                  <CardTitle>COROS</CardTitle>
                  <CardDescription>Sync your COROS workouts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Data Import</h2>
          <Card>
            <CardHeader>
              <CardTitle>Manual Import</CardTitle>
              <CardDescription>Import your workout data from files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You can import your workout data from various file formats, including GPX, TCX, and FIT files.
                </p>
                <Button>Import Files</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

