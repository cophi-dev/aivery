"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Info, ArrowRight, Check, Calendar, Activity, Bike, Dumbbell, RefreshCw, ArrowLeftRight, FileUp, ArrowDownToLine, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { getStravaIntegrationAction, syncStravaWorkoutsAction, getSupportedActivityTypes, updateStravaSyncPreferencesAction, getStravaWebhookStatusAction, setupStravaWebhookAction, removeStravaWebhookAction } from "@/lib/strava-actions"
import { useRouter, useSearchParams } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { disconnectStravaAction } from "@/lib/integration-actions"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ImportStats {
  count: number;
  types: Record<string, number>;
  earliestDate: string;
  latestDate: string;
  totalDistance: number;
  totalDuration: number;
}

export function StravaImport() {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importStats, setImportStats] = useState<ImportStats | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [selectedWorkoutTypes, setSelectedWorkoutTypes] = useState<string[]>([
    "running", "cycling", "swimming", "strength", "walking", "hiking", "flexibility", "hiit", "other"
  ])
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Strava live connection states
  const [stravaIntegration, setStravaIntegration] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Strava sync preferences state
  const [syncPreferences, setSyncPreferences] = useState<{ id: string, label: string, enabled: boolean, disabled?: boolean }[]>([])
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)

  // Add these state variables to the component
  const [webhookStatus, setWebhookStatus] = useState<any>(null)
  const [isWebhookLoading, setIsWebhookLoading] = useState(false)
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

  // Load Strava integration and activity types on component mount
  useEffect(() => {
    const loadStravaData = async () => {
      try {
        setIsLoading(true)
        setIsLoadingPreferences(true)
        
        // Load Strava integration status
        const { success, integration } = await getStravaIntegrationAction()
        if (success && integration) {
          setStravaIntegration(integration)
        }
        
        // Load available activity types
        const typesResult = await getSupportedActivityTypes()
        if (typesResult.success && typesResult.activityTypes) {
          setSyncPreferences(typesResult.activityTypes)
        }
      } catch (error) {
        console.error("Error loading Strava data:", error)
      } finally {
        setIsLoading(false)
        setIsLoadingPreferences(false)
      }
    }
    
    loadStravaData()
  }, [])

  // Handle URL parameters for OAuth flow
  useEffect(() => {
    if (searchParams) {
      const success = searchParams.get('success')
      const error = searchParams.get('error')
      const details = searchParams.get('details')
      
      if (success === 'strava_connected') {
        toast({
          title: "Connected to Strava",
          description: "Your Strava account is now connected. You can now sync your activities.",
          variant: "default"
        });
        
        // Refresh the integration status
        const loadStravaIntegration = async () => {
          try {
            const { success, integration } = await getStravaIntegrationAction();
            if (success && integration) {
              setStravaIntegration(integration);
            }
          } catch (error) {
            console.error("Error refreshing Strava integration:", error);
          }
        };
        loadStravaIntegration();
        
        // Clear the URL parameters to avoid showing the message again on refresh
        router.replace('/integrations', { scroll: false })
      } else if (error) {
        let errorMessage = "Failed to connect to Strava";
        let errorDescription = "Please try again or contact support if the issue persists.";
        
        // Handle specific error cases
        switch (error) {
          case 'strava_auth_failed':
            errorMessage = "Strava authentication failed";
            errorDescription = "Please check your Strava API credentials (Client ID and Client Secret) are correctly configured.";
            break;
          case 'strava_config_error':
            errorMessage = "Strava configuration error";
            errorDescription = details ? 
              `Configuration issues detected: ${details}` : 
              "Your Strava integration is not properly configured. Check environment variables.";
            break;
          case 'strava_invalid_code':
            errorMessage = "Invalid authorization code";
            errorDescription = "The authorization code may have expired or already been used. Please try connecting again.";
            break;
          case 'strava_network_error':
            errorMessage = "Network connection error";
            errorDescription = "Could not connect to Strava API. Please check your internet connection and try again.";
            break;
          case 'no_code':
            errorMessage = "No authorization code received";
            errorDescription = "The authorization process was interrupted. Please try again.";
            break;
          case 'strava_callback_failed':
            errorMessage = "Error processing Strava callback";
            errorDescription = "There was an error while connecting to Strava. Please try again later.";
            break;
          case 'failed_to_exchange_code_for_token':
            errorMessage = "Failed to get Strava access token";
            errorDescription = "Check that your Strava account is active and try again.";
            break;
          default:
            if (error.includes('token') || error.includes('auth')) {
              errorMessage = "Strava authorization error";
              errorDescription = "There was an issue authorizing with Strava. Please ensure your Strava account is active.";
            }
        }
        
        toast({
          title: errorMessage,
          description: errorDescription,
          variant: "destructive"
        });
        
        // Clear the URL parameters to avoid showing the message again on refresh
        router.replace('/integrations', { scroll: false })
      }
    }
  }, [searchParams, router, toast])

  // Handle connect to Strava
  const handleConnectStrava = () => {
    setIsConnecting(true)
    
    try {
      // Use direct redirect to Strava OAuth page
      window.location.href = `/api/strava/authorize`
    } catch (error) {
      console.error("Error connecting to Strava:", error)
      toast({
        title: "Error",
        description: "Failed to connect to Strava. Check console for details.",
        variant: "destructive"
      })
      setIsConnecting(false)
    }
  }

  // Handle sync Strava workouts
  const handleSyncStrava = async () => {
    setIsSyncing(true)
    
    try {
      const { success, count, types, error } = await syncStravaWorkoutsAction()
      
      if (success) {
        // Format activity types for display
        const typeDetails = []
        if (types?.run) typeDetails.push(`${types.run} runs`)
        if (types?.swim) typeDetails.push(`${types.swim} swims`)
        
        const typeMessage = typeDetails.length > 0 
          ? ` (${typeDetails.join(", ")})`
          : ""
        
        toast({
          title: "Success",
          description: `Successfully synced ${count} activities from Strava${typeMessage}`
        })
        
        // Refresh Strava integration
        const result = await getStravaIntegrationAction()
        if (result.success && result.integration) {
          setStravaIntegration(result.integration)
        }
      } else {
        toast({
          title: "Error",
          description: error || "Failed to sync Strava workouts",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error syncing Strava workouts:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const allWorkoutTypes = [
    { id: "running", label: "Running" },
    { id: "cycling", label: "Cycling" },
    { id: "swimming", label: "Swimming" },
    { id: "strength", label: "Strength" },
    { id: "walking", label: "Walking" },
    { id: "hiking", label: "Hiking" },
    { id: "flexibility", label: "Flexibility" },
    { id: "hiit", label: "HIIT" },
    { id: "other", label: "Other" }
  ]

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check if it's a ZIP file
    if (file.type !== "application/zip" && !file.name.endsWith('.zip')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a ZIP file from your Strava archive",
        variant: "destructive"
      })
      return
    }

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    setSelectedFile(file)
    setImportStats(null) // Reset import stats when selecting a new file
    // Show type selector after selecting a file
    setShowTypeSelector(true)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a Strava archive file to import",
        variant: "destructive"
      })
      return
    }

    if (selectedWorkoutTypes.length === 0) {
      toast({
        title: "No workout types selected",
        description: "Please select at least one workout type to import",
        variant: "destructive"
      })
      return
    }

    try {
      setIsUploading(true)
      console.log('Starting upload of file:', selectedFile.name, 'with workout types:', selectedWorkoutTypes)

      const formData = new FormData()
      formData.append('file', selectedFile)
      // Add selected workout types to the form data
      selectedWorkoutTypes.forEach(type => {
        formData.append('workoutTypes', type)
      })

      console.log('Sending request to /api/strava/import')
      const response = await fetch('/api/strava/import', {
        method: 'POST',
        body: formData,
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok || !data.success) {
        const errorMessage = data.details || data.error || 'Failed to import data'
        const errorDetails = data.file ? `File: ${data.file}\n${errorMessage}` : errorMessage
        throw new Error(errorDetails)
      }

      if (data.count === 0) {
        toast({
          title: "No activities imported",
          description: data.message || "No activities were successfully imported from the Strava archive.",
          variant: "destructive"
        })
        return
      }

      // Process and set import stats
      if (data.stats) {
        setImportStats(data.stats)
      } else {
        // Create basic stats if detailed stats aren't provided by the API
        setImportStats({
          count: data.count || 0,
          types: data.activityTypes || {},
          earliestDate: data.earliestDate || '',
          latestDate: data.latestDate || '',
          totalDistance: data.totalDistance || 0,
          totalDuration: data.totalDuration || 0
        })
      }

      toast({
        title: "Import successful",
        description: `Successfully imported ${data.count} workouts from your Strava archive`,
      })

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // Don't reset the selected file so we can show what was imported
    } catch (error) {
      console.error('Import error:', error)
      // Log the full error details
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "There was an error importing your Strava data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Format date for display
  const formatDate = (date: string | Date | undefined | null) => {
    if (!date) return "Never";
    try {
      return new Date(date).toLocaleString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  }

  const getSportIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'running':
        return <Activity className="h-4 w-4" />;
      case 'cycling':
      case 'biking':
        return <Bike className="h-4 w-4" />;
      case 'strength':
      case 'weight_training':
        return <Dumbbell className="h-4 w-4" />;
      default:
        return null;
    }
  }

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} km`;
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  }

  const renderImportSummary = () => {
    if (!importStats) return null;

    // Sort activity types by count in descending order
    const sortedTypes = Object.entries(importStats.types || {})
      .sort(([, countA], [, countB]) => countB - countA);

    return (
      <Card className="mt-6 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
            <Check className="h-5 w-5" />
            Import Successful
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            {importStats.count} activities were successfully imported from your Strava archive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {importStats.earliestDate && importStats.latestDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-green-700 dark:text-green-500" />
                <span className="text-green-800 dark:text-green-300">
                  {formatDate(importStats.earliestDate)} - {formatDate(importStats.latestDate)}
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-500">Total Distance</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-300">
                  {formatDistance(importStats.totalDistance)}
                </div>
              </div>
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-500">Total Duration</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-300">
                  {formatDuration(importStats.totalDuration)}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-400">Activity Types</h4>
              <div className="space-y-2">
                {sortedTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-8 flex justify-center">
                      {getSportIcon(type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm capitalize text-green-800 dark:text-green-300">{type}</span>
                        <span className="text-xs text-green-700 dark:text-green-400">{count}</span>
                      </div>
                      <Progress value={(count / importStats.count) * 100} className="h-1.5 bg-green-200 dark:bg-green-900">
                        <div className="bg-green-600 dark:bg-green-500 h-full w-full" />
                      </Progress>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/50"
            onClick={() => {
              setSelectedFile(null);
              setImportStats(null);
            }}
          >
            Import Another Archive
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // Toggle a sync preference
  const toggleSyncPreference = (id: string) => {
    setSyncPreferences(prev => 
      prev.map(item => 
        item.id === id && !item.disabled 
          ? { ...item, enabled: !item.enabled } 
          : item
      )
    )
  }
  
  // Save sync preferences
  const saveSyncPreferences = async () => {
    try {
      setIsSavingPreferences(true)
      
      // Get enabled activity type IDs
      const enabledTypes = syncPreferences
        .filter(item => item.enabled)
        .map(item => item.id)
      
      // Update preferences
      const result = await updateStravaSyncPreferencesAction(enabledTypes)
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Sync preferences updated"
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update preferences",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error saving preferences:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSavingPreferences(false)
    }
  }

  // Add this useEffect to load webhook status
  useEffect(() => {
    const loadWebhookStatus = async () => {
      if (stravaIntegration) {
        try {
          setIsWebhookLoading(true)
          const result = await getStravaWebhookStatusAction()
          if (result.success) {
            setWebhookStatus(result)
          }
        } catch (error) {
          console.error("Error loading webhook status:", error)
        } finally {
          setIsWebhookLoading(false)
        }
      }
    }
    
    loadWebhookStatus()
  }, [stravaIntegration])

  // Add these functions to handle webhook subscription
  const handleSetupWebhook = async () => {
    try {
      setIsSettingUpWebhook(true)
      const result = await setupStravaWebhookAction()
      
      if (result.success) {
        setWebhookStatus({
          success: true,
          subscribed: true,
          subscription: result.subscription
        })
        
        toast({
          title: "Auto-sync enabled",
          description: "New Strava activities will now be automatically synced"
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to set up auto-sync",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error setting up webhook:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSettingUpWebhook(false)
    }
  }

  const handleRemoveWebhook = async () => {
    if (!webhookStatus?.subscription?.id) return
    
    try {
      setIsSettingUpWebhook(true)
      const result = await removeStravaWebhookAction(webhookStatus.subscription.id)
      
      if (result.success) {
        setWebhookStatus({
          success: true,
          subscribed: false,
          subscription: null
        })
        
        toast({
          title: "Auto-sync disabled",
          description: "New Strava activities will no longer be automatically synced"
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to disable auto-sync",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error removing webhook:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsSettingUpWebhook(false)
    }
  }

  // Handle disconnect from Strava
  const handleDisconnectStrava = async () => {
    try {
      setIsDisconnecting(true)
      const result = await disconnectStravaAction()
      
      if (result.success) {
        setStravaIntegration(null)
        setWebhookStatus(null)
        
        toast({
          title: "Disconnected from Strava",
          description: "Your Strava account has been disconnected successfully."
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to disconnect from Strava",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error disconnecting from Strava:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import Your Workouts</CardTitle>
          <CardDescription>Choose how you want to import your workout data</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Strava Connection Section */}
          <div className="space-y-4">
            {stravaIntegration ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50">
                      <Check className="w-4 h-4 mr-1" />
                      Connected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Athlete: {stravaIntegration.athleteId}
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => handleDisconnectStrava()} disabled={isDisconnecting}>
                    Disconnect
                  </Button>
                </div>

                {/* One-time Import Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">One-time Import</h3>
                  <p className="text-sm text-muted-foreground">Import your existing Strava activities from the past 30 days.</p>
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleSyncStrava}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4 mr-2" />
                        Sync Existing Activities
                      </>
                    )}
                  </Button>
                </div>

                {/* Collapsible Sync Preferences */}
                <Collapsible open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full flex justify-between">
                      <span>Sync Preferences</span>
                      {isPreferencesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    <p className="text-sm text-muted-foreground">Select which activity types to import from Strava.</p>
                    <div className="space-y-2">
                      {syncPreferences.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.id}
                            checked={type.enabled}
                            onCheckedChange={() => toggleSyncPreference(type.id)}
                            disabled={type.disabled || isSavingPreferences}
                          />
                          <label htmlFor={type.id} className="text-sm font-medium">
                            {type.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveSyncPreferences}
                      disabled={isSavingPreferences}
                      className="mt-2"
                    >
                      {isSavingPreferences ? "Saving..." : "Save Preferences"}
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                {/* Simplified Automatic Sync Section */}
                <div className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Automatic Syncing</h3>
                      <p className="text-sm text-muted-foreground">
                        New activities from Strava will be automatically synced.
                      </p>
                    </div>
                    <Switch
                      checked={webhookStatus?.active}
                      onCheckedChange={webhookStatus?.active ? handleRemoveWebhook : handleSetupWebhook}
                      disabled={isSettingUpWebhook || isWebhookLoading}
                    />
                  </div>
                  {webhookStatus?.active && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(webhookStatus.lastUpdated).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Button
                onClick={handleConnectStrava}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Connect with Strava
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 