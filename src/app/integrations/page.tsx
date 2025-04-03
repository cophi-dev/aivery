"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LucideCheck, LucideLoader, LucideRefreshCw, LucideAlertCircle } from "lucide-react"
import { connectStravaAction, syncStravaWorkoutsAction, getStravaIntegrationAction } from "@/lib/strava-actions"
import { StravaImport } from "@/components/strava-import"
import { Separator } from "@/components/ui/separator"

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stravaIntegration, setStravaIntegration] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Handle URL parameters for OAuth flow
  useEffect(() => {
    if (searchParams) {
      const success = searchParams.get('success')
      const error = searchParams.get('error')
      
      if (success === 'strava_connected') {
        setAlert({ type: "success", message: "Successfully connected to Strava" })
        // Clear the URL parameters to avoid showing the message again on refresh
        router.replace('/integrations', { scroll: false })
      } else if (error) {
        let errorMessage = "Failed to connect to Strava"
        
        switch (error) {
          case 'strava_auth_failed':
            errorMessage = "Strava authentication failed. Please try again."
            break
          case 'no_code':
            errorMessage = "No authorization code received from Strava"
            break
          case 'strava_callback_failed':
            errorMessage = "Error processing Strava callback"
            break
        }
        
        setAlert({ type: "error", message: errorMessage })
        // Clear the URL parameters to avoid showing the message again on refresh
        router.replace('/integrations', { scroll: false })
      }
    }
  }, [searchParams, router])

  // Load Strava integration on page load
  useEffect(() => {
    const loadStrava = async () => {
      try {
        setIsLoading(true)
        const { success, integration, error } = await getStravaIntegrationAction()

        if (success && integration) {
          setStravaIntegration(integration)
          // Always show the success banner for connected services
          setAlert({ type: "success", message: "Successfully connected to Strava" })
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
  const handleConnectStrava = () => {
    setIsConnecting(true)
    setAlert(null)

    try {
      // Redirect to Strava OAuth page
      window.location.href = `/api/strava/authorize`
    } catch (error) {
      console.error("Error connecting to Strava:", error)
      setAlert({ type: "error", message: "An unexpected error occurred" })
      setIsConnecting(false)
    }
  }

  // Handle sync Strava workouts
  const handleSyncStrava = async () => {
    setIsSyncing(true)
    setAlert(null)

    try {
      const { success, count, types, error, message } = await syncStravaWorkoutsAction()

      if (success) {
        // Format activity types for display
        const typeDetails = [];
        
        // Properly handle the types array
        if (types && Array.isArray(types)) {
          // Count occurrences of each activity type
          const typeCounts: Record<string, number> = {};
          types.forEach(type => {
            if (type === 'running' || type === 'Run') typeCounts.run = (typeCounts.run || 0) + 1;
            if (type === 'swimming' || type === 'Swim') typeCounts.swim = (typeCounts.swim || 0) + 1;
          });
          
          if (typeCounts.run) typeDetails.push(`${typeCounts.run} runs`);
          if (typeCounts.swim) typeDetails.push(`${typeCounts.swim} swims`);
        }
        
        const typeMessage = typeDetails.length > 0 
          ? `(${typeDetails.join(", ")})`
          : "";
        
        setAlert({ 
          type: "success", 
          message: message || `Successfully synced ${count} activities from Strava ${typeMessage}` 
        });
        
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
        
        {/* Live Connections section moved to top */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-6">Live Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Strava */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="bg-muted rounded-full p-2">
                    <img src="/placeholder.svg" alt="Strava" className="h-10 w-10" />
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
                    <div className="text-xs bg-muted p-2 rounded-md">
                      <p>Only running and swimming activities will be synced. Strength training workouts are not imported.</p>
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
                          Sync Runs & Swims
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
        </div>
        
        <Separator className="my-8" />

        {/* Strava Import Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-6">Import Workout History</h2>
          <StravaImport />
        </div>
      </div>
    </>
  )
}

