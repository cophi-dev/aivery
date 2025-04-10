"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Info, ArrowRight, Check, Calendar, Activity, Bike, Dumbbell, RefreshCw, ArrowLeftRight, FileUp, ArrowDownToLine, ChevronDown, ChevronUp, ArrowUpToLine, X, Loader2, Waves, Footprints, PersonStanding, Zap, Shapes } from "lucide-react"
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
import { v4 as uuidv4 } from 'uuid'

interface ImportStats {
  count: number;
  types: Record<string, number>;
  earliestDate: string;
  latestDate: string;
  totalDistance: number;
  totalDuration: number;
}

interface StravaImportProps {
  onImportComplete?: () => void;
}

export function StravaImport({ onImportComplete }: StravaImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [selectedWorkoutTypes, setSelectedWorkoutTypes] = useState<string[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [stravaIntegration, setStravaIntegration] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const [syncPreferences, setSyncPreferences] = useState<{ id: string, label: string, enabled: boolean, disabled?: boolean }[]>([])
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)

  const [webhookStatus, setWebhookStatus] = useState<any>(null)
  const [isWebhookLoading, setIsWebhookLoading] = useState(false)
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
  const [uploadStats, setUploadStats] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load Strava integration and activity types on component mount
  useEffect(() => {
    const loadStravaData = async () => {
      try {
        setIsLoadingPreferences(true)
        console.log('[StravaImport] Checking Strava integration status...');
        const { success: intSuccess, integration } = await getStravaIntegrationAction()
        console.log('[StravaImport] Integration status result:', { intSuccess, integration });
        if (intSuccess && integration) {
          setStravaIntegration(integration)
          setError(null); // Clear previous errors before re-validating
          
          // Verify actual API connectivity
          try {
            console.log('[StravaImport] Fetching /api/strava-status...');
            const response = await fetch('/api/strava-status');
            const stravaStatus = await response.json();
            console.log('[StravaImport] /api/strava-status response:', stravaStatus);

            // Check if the API call was successful and if the connection is valid according to the backend
            if (!stravaStatus.success || !stravaStatus.connected) {
              console.log('[StravaImport] Strava connection reported as invalid by API status check.');
              // Construct a more informative error based on the response
              let errorMsg = stravaStatus.error || 'Your Strava connection appears to be invalid or expired.';
              if (stravaStatus.account?.tokenValid === false) {
                errorMsg = 'Your Strava token seems invalid or expired. Please try reconnecting.';
              } else if (stravaStatus.account?.apiCallSuccess === false) {
                errorMsg = 'Could not verify connection with Strava API. Please try reconnecting.';
              }
              setError(errorMsg + " You may need to disconnect and reconnect your account.");
              // Optionally, we could set stravaIntegration back to null to force reconnect UI,
              // but showing an error within the connected view might be better UX.
              // setStravaIntegration(null);
            } else {
              // Connection is valid, ensure no error is shown
              setError(null);
              
              // Check if auto-sync (webhook) is enabled, if not, enable it automatically
              // by calling loadWebhookStatus first, then setting it up if not already enabled
              const webhookResult = await getStravaWebhookStatusAction();
              console.log('[StravaImport] Auto-checking webhook status:', webhookResult);
              
              if (webhookResult.success && !webhookResult.subscribed) {
                console.log('[StravaImport] Auto-enabling webhook/auto-sync on connection');
                // Auto-enable webhook for the user
                await handleSetupWebhook();
              }
            }
          } catch (statusError) {
            console.error('[StravaImport] Error fetching Strava status:', statusError);
            setError('Could not verify Strava connection status. Please check your network or try again later.');
            // Don't set error state here - be lenient // <-- Keep this comment? Or set error as above?
            // Let's set an error here for clarity to the user.
          }
        } else {
          setStravaIntegration(null);
          setError(null); // Ensure no error if not integrated
        }
        
        console.log('[StravaImport] Fetching supported activity types...');
        const typesResult = await getSupportedActivityTypes()
        console.log('[StravaImport] Supported types result:', typesResult);
        if (typesResult.success && typesResult.activityTypes) {
           const modifiedTypes = typesResult.activityTypes.map(type => {
               // Check for strength, weight_training, OR workout ID
               if (type.id === 'strength' || type.id === 'weight_training' || type.id === 'workout') { 
                   console.log(`[StravaImport] Forcing type '${type.id}' (${type.label}) to be enabled in preferences list.`);
                   return { ...type, disabled: false }; // Force enable
               }
               return type;
           });
           console.log('[StravaImport] Setting modified sync preferences:', modifiedTypes);
           setSyncPreferences(modifiedTypes); // Set state with modified types
        } else {
          console.error('[StravaImport] Failed to load activity types:', typesResult.error);
           setSyncPreferences([]); // Ensure state is empty on failure
        }
      } catch (error) {
        console.error("[StravaImport] Error loading initial Strava data:", error)
        setStravaIntegration(null);
        setSyncPreferences([]);
      } finally {
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
          description: "Your Strava account is now connected with auto-sync enabled.",
          variant: "default"
        });
        
        // Refresh the integration status and then setup webhook (if not already done on server)
        const setupAutoSync = async () => {
          try {
            console.log('[StravaImport] Refreshing integration after connect...');
            const { success, integration } = await getStravaIntegrationAction();
            if (success && integration) {
              setStravaIntegration(integration);
              
              // Check webhook status first
              const webhookResult = await getStravaWebhookStatusAction();
              console.log('[StravaImport] Checking webhook status:', webhookResult);
              
              if (!webhookResult.subscribed) {
                console.log('[StravaImport] Auto-sync not enabled yet, setting up...');
                // Try to set up webhook if not already done on server
                const setupResult = await setupStravaWebhookAction();
                if (setupResult.success) {
                  setWebhookStatus({ 
                    subscribed: true, 
                    success: true, 
                    subscription: setupResult.subscription
                  });
                } else {
                  console.error('[StravaImport] Failed to set up webhook on client:', setupResult.error);
                  setWebhookStatus({ 
                    subscribed: false, 
                    success: false, 
                    error: setupResult.error
                  });
                }
              } else {
                // Webhook is already set up, just update UI
                setWebhookStatus(webhookResult);
                console.log('[StravaImport] Auto-sync already enabled');
              }
            }
          } catch (error) {
            console.error("Error during post-connection setup:", error);
          }
        };
        
        setupAutoSync(); // Call the async function
        
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

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      const selected = fileList[0];
      // Check file type first
      if (!selected.name.endsWith('.zip')) {
        toast({
          title: "Invalid file type",
          description: "Please select a ZIP file containing your Strava export.",
          variant: "destructive"
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      // Validate file size - allow up to 10MB to handle typical Strava exports
      const MAX_FILE_SIZE_MB = 10;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (selected.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Try selecting fewer activities when exporting from Strava.`,
          variant: "destructive"
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setFile(selected);
    } else {
      // If user cancels file selection
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [toast]);

  const handleUpload = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent standard form submission
    if (!file) {
      toast({ title: "No file selected", description: "Please select a ZIP file to upload.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);
    setUploadStats(null);
    setUploadStatus('Preparing upload...');

    console.log(`=== Starting presigned URL upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) ===`);

    try {
      // 1. Get presigned URL from our new API route
      setUploadStatus('Requesting secure upload link...');
      setProgress(10);
      const presignedResponse = await fetch('/api/strava/generate-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: file.name }),
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json().catch(() => ({ error: 'Failed to get upload link. Server response not readable.'}));
        throw new Error(errorData.error || `Failed to get upload link: Server responded with ${presignedResponse.status}`);
      }

      const { url: uploadUrl, pathname: blobPathname } = await presignedResponse.json();
      console.log('Received presigned URL:', uploadUrl);
      console.log('File will be stored at path:', blobPathname);
      setProgress(25);

      // 2. Upload the file directly to Vercel Blob using the presigned URL
      setUploadStatus(`Uploading file directly to storage...`);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip', // Match the content type specified during URL generation
          // Add x-vercel-blob-client header for analytics if desired
          // 'x-vercel-blob-client': 'aivery-app-frontend',
        },
        body: file,
        // Consider adding progress tracking using XMLHttpRequest if needed
      });

      if (!uploadResponse.ok) {
        // Attempt to get error details from Vercel Blob response if available
        const errorText = await uploadResponse.text().catch(() => 'Could not read storage upload error response.');
        console.error("Direct upload to storage failed:", { status: uploadResponse.status, body: errorText });
        throw new Error(`Direct file upload failed: Storage responded with status ${uploadResponse.status}`);
      }

      console.log('Direct upload to storage successful.');
      setProgress(60);

      // 3. Notify the backend API to process the file from Blob storage
      setUploadStatus('Requesting server to process uploaded file...');
      console.log('Sending POST request to /api/strava/import with blob pathname:', blobPathname);

      const processResponse = await fetch('/api/strava/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Sending JSON now, not FormData
        },
        body: JSON.stringify({ 
            blobPathname: blobPathname, 
            originalFilename: file.name 
            // Add selectedWorkoutTypes if needed by the backend
            // workoutTypes: selectedWorkoutTypes
        }), 
      });

      if (processResponse.ok) {
        setUploadStatus('Processing file on server...');
      } else {
        setUploadStatus('Error during processing request...');
      }

      setProgress(75);

      console.log('Processing Response received:', { status: processResponse.status, statusText: processResponse.statusText });

      const contentType = processResponse.headers.get("content-type");
      if (!processResponse.ok || !contentType || !contentType.includes("application/json")) {
        const responseText = await processResponse.text().catch(() => "Could not read error response body.");
        console.error("Server error or non-JSON response during processing:", { status: processResponse.status, contentType, body: responseText });
        let errorMsg = `Processing failed: Server responded with status ${processResponse.status}.`;
        if (contentType && !contentType.includes("application/json")) {
          errorMsg = `Server error: Expected JSON response, but received ${contentType}.`;
        } else if (processResponse.status >= 400 && processResponse.status < 500 && responseText) {
          errorMsg = `Processing failed: ${responseText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await processResponse.json();
      console.log('Processing API Response data:', data);

      if (data.success) {
        // --- Existing success handling logic --- 
        const processed = data.results?.processed ?? 0;
        const imported = data.results?.imported ?? 0;
        const errors = data.results?.errors ?? [];
        const errorCount = errors.length;
        
        const summaryStats: ImportStats = {
          count: imported, 
          types: data.results?.activityTypesCount ?? {},
          earliestDate: data.results?.earliestDate ?? '',
          latestDate: data.results?.latestDate ?? '',
          totalDistance: data.results?.totalDistance ?? 0,
          totalDuration: data.results?.totalDuration ?? 0,
        };
        setUploadStats(summaryStats);

        let description = `Processed ${processed} files, successfully imported ${imported} workouts.`;
        if (errorCount > 0) {
          description += ` ${errorCount} file(s) could not be imported. Check browser console for details.`;
          console.error('Import errors - Failed files:', errors);
        }

      toast({
          title: "Import Complete",
          description: description,
          duration: 8000,
        });
        
        setUploadStatus('Import completed successfully.');
        setProgress(100);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onImportComplete) onImportComplete();
        // --- End of existing success handling ---

      } else {
        throw new Error(data.error || data.details || 'Import failed: The API reported an issue during processing.');
      }
    } catch (error) {
      // --- Existing error handling --- 
      console.error('Upload process error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during the import process.';
        toast({
        title: "Import Error",
        description: errorMessage,
          variant: "destructive"
      });
      setError(errorMessage);
      setUploadStatus(`Error: ${errorMessage}`);
      setProgress(0);
      // --- End of existing error handling ---
    } finally {
      setIsLoading(false);
    }
  }, [file, toast, onImportComplete, selectedWorkoutTypes]);

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
      case 'ride':
      case 'bike':
        return <Bike className="h-4 w-4" />;
      case 'strength':
      case 'weight_training':
        return <Dumbbell className="h-4 w-4" />;
      case 'swimming':
      case 'swim':
        return <Waves className="h-4 w-4" />;
      case 'walking':
      case 'hike':
      case 'hiking':
        return <Footprints className="h-4 w-4" />;
      case 'flexibility':
      case 'yoga':
        return <PersonStanding className="h-4 w-4" />;
      case 'hiit':
        return <Zap className="h-4 w-4" />;
      case 'other':
      default:
        return <Shapes className="h-4 w-4" />;
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
    if (!uploadStats) return null;

    // Sort activity types by count in descending order
    const sortedTypes = Object.entries(uploadStats.types || {})
      .sort(([, countA], [, countB]) => countB - countA);

    return (
      <Card className="mt-6 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
            <Check className="h-5 w-5" />
            Import Successful
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            {uploadStats.count} activities were successfully imported from your Strava archive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {uploadStats.earliestDate && uploadStats.latestDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-green-700 dark:text-green-500" />
                <span className="text-green-800 dark:text-green-300">
                  {formatDate(uploadStats.earliestDate)} - {formatDate(uploadStats.latestDate)}
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-500">Total Distance</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-300">
                  {formatDistance(uploadStats.totalDistance)}
                </div>
              </div>
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-500">Total Duration</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-300">
                  {formatDuration(uploadStats.totalDuration)}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-400">Activity Types</h4>
              <div className="space-y-2">
                {sortedTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-8 flex justify-center text-green-700 dark:text-green-500">
                      {getSportIcon(type) ?? <Shapes className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm capitalize text-green-800 dark:text-green-300">{type}</span>
                        <span className="text-xs text-green-700 dark:text-green-400">{count}</span>
                      </div>
                      <Progress value={uploadStats.count > 0 ? (count / uploadStats.count) * 100 : 0} className="h-1.5 bg-green-200 dark:bg-green-900">
                        <div className="bg-green-600 dark:bg-green-500 h-full" style={{ width: `${uploadStats.count > 0 ? (count / uploadStats.count) * 100 : 0}%` }}/>
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
            onClick={resetFileInput}
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
        // Refresh the preferences from the server to ensure we have the latest state
        const typesResult = await getSupportedActivityTypes()
        if (typesResult.success && typesResult.activityTypes) {
          setSyncPreferences(typesResult.activityTypes)
        }
        
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
      // Close the preferences panel after successful save
      setIsPreferencesOpen(false)
    }
  }

  // Define loadWebhookStatus as a standalone async function callable from elsewhere
  const loadWebhookStatus = useCallback(async () => {
    // Only run if connected
    if (stravaIntegration?.id) { // Check for integration ID specifically
      console.log('[StravaImport] Strava connected, checking webhook status...');
        setIsWebhookLoading(true)
      setWebhookStatus(null); // Reset status before loading
      try {
        const result = await getStravaWebhookStatusAction()
        console.log('[StravaImport] Webhook status result:', result);
        if (result.success) {
          setWebhookStatus(result) // Includes { subscribed: boolean, ... }
        } else {
          console.error('[StravaImport] Failed to get webhook status:', result.error);
          // Explicitly set subscribed to false on failure
          setWebhookStatus({ subscribed: false, success: false, error: result.error || "Failed to get status" }); 
        }
      } catch (error) {
        console.error("[StravaImport] Error loading webhook status:", error)
        // Explicitly set subscribed to false on catch
        const errorMsg = error instanceof Error ? error.message : "Unknown error during status check";
        setWebhookStatus({ subscribed: false, success: false, error: errorMsg });
      } finally {
        console.log('[StravaImport] Finished checking webhook status.');
        setIsWebhookLoading(false)
      }
    } else {
      console.log('[StravaImport] Strava not connected, skipping webhook status check.');
      setWebhookStatus(null); // Clear status if disconnected
      setIsWebhookLoading(false); // Ensure loading is false if not connected
    }
  }, [stravaIntegration]); // Keep dependency on stravaIntegration

  // Use useEffect to call loadWebhookStatus when stravaIntegration changes
  useEffect(() => {
    loadWebhookStatus();
  }, [loadWebhookStatus]); // Dependency array includes the useCallback function

  // Add these functions to handle webhook subscription
  const handleSetupWebhook = async () => {
    try {
      setIsSettingUpWebhook(true)
      
      // First check if integration is truly valid
      const integrationCheck = await getStravaIntegrationAction()
      if (!integrationCheck.success || !integrationCheck.integration) {
        toast({
          title: "Connection Error",
          description: "Your Strava connection appears to be invalid. Please disconnect and reconnect your account.",
          variant: "destructive"
        })
        return
      }
      
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
        description: "An unexpected error occurred setting up auto-sync",
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

  // Define resetFileInput function early in the component
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setFile(null)
    setUploadStats(null) // Reset stats if using summary card
    setUploadStatus('')
    setProgress(0)
    setError(null)
  }

  // --- Component Return JSX --- 
  return (
    <div className="space-y-8">
      {/* === STEP 1: Import Existing Archive (ZIP) === */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</span>
            <div>
              <CardTitle className="font-semibold text-lg">Import Existing Archive</CardTitle>
              <CardDescription>Upload your full history from Strava (or other platforms).</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions for getting the Strava Archive */}
          <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/50 p-4 rounded-md border">
            <h4 className="font-medium">How to get your Strava Archive:</h4>
            <ol>
              <li>Go to <a href="https://www.strava.com/account" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Strava Settings</a> &gt; "My Account".</li>
              <li>Scroll down to "Download or Delete Your Account".</li>
              <li>Click "Request Your Archive" under Step 1.</li>
              <li>Strava will email you a link to download a .zip file (this may take a few hours).</li>
              <li>Download the .zip file and upload it below.</li>
            </ol>
          </div>
          
          {/* ZIP File Uploader Form */}
          <form onSubmit={handleUpload} className="space-y-4 pt-2">
            {!file ? (
              <label
                htmlFor="zip-file-input"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/50 transition-colors dark:hover:bg-muted/20"
              >
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                  id="zip-file-input"
                  aria-label="Select ZIP file"
                />
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <div className="mb-6">
                    <h3 className="text-lg font-medium">Upload Strava Export</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload your Strava export .zip file to import activities. For best results, choose a smaller date range when exporting from Strava.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum file size: 10MB. Your 8.19MB file should work fine.
                    </p>
                  </div>
                </div>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <FileUp className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {Math.round(file.size / 1024)} KB
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFileInput}
                    aria-label="Clear selected file"
                    className="h-7 w-7"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !file}
                  className="w-full relative py-2.5"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 h-4 mr-2" />
                      Import Archive File
                    </>
                  )}
                </Button>
              </div>
            )}

            {(isLoading || progress > 0) && (
              <div className="space-y-1 pt-2">
                <Progress value={progress} className="w-full h-2" aria-label={`Upload progress: ${progress}%`} />
                <p className="text-sm text-muted-foreground text-center h-4">{uploadStatus}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Import Summary Card (Renders after successful ZIP import) */} 
      {uploadStats && renderImportSummary()}

      {/* === STEP 2: Connect for Automatic Sync === */} 
      <Card className="border shadow-sm">
        <CardHeader>
           <div className="flex items-center space-x-3">
             <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</span>
             <div>
               <CardTitle className="font-semibold text-lg">Connect for Automatic Sync</CardTitle>
               <CardDescription>Connect your Strava account to automatically sync *new* activities.</CardDescription>
             </div>
           </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {stravaIntegration ? (
              // --- Connected State --- 
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                      <Check className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" />
                      Connected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Athlete ID: {stravaIntegration.athleteId}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnectStrava} disabled={isDisconnecting}>
                    {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                  </Button>
                </div>
                
                {/* Display error with reconnect option if needed */}
                {error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTitle className="flex items-center gap-2">
                      <X className="h-4 w-4" /> Connection Issue
                    </AlertTitle>
                    <AlertDescription className="mt-1">
                      <p className="mb-2">{error}</p>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setError(null);
                            handleDisconnectStrava().then(() => {
                              setTimeout(() => handleConnectStrava(), 1000);
                            });
                          }}
                          className="bg-white dark:bg-gray-800"
                        >
                          Reconnect Strava
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/strava/force-valid', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                }
                              });
                              
                              if (response.ok) {
                                setError(null);
                                toast({
                                  title: "Connection trusted",
                                  description: "Your Strava connection will now be considered valid.",
                                });
                                // Force a reload of the component/page
                                window.location.reload();
                              } else {
                                const data = await response.json();
                                toast({
                                  title: "Failed to trust connection",
                                  description: data.error || "An unexpected error occurred",
                                  variant: "destructive"
                                });
                              }
                            } catch (err) {
                              console.error("Error trusting connection:", err);
                              toast({
                                title: "Error",
                                description: "Failed to trust Strava connection",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="bg-white dark:bg-gray-800"
                        >
                          Trust Connection Anyway
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Automatic Syncing Toggle */}
                <div className="space-y-2 pt-4 border-t">
                   <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium">Automatic Syncing</h3>
                      <p className="text-sm text-muted-foreground">
                        Toggle to enable/disable syncing of new activities.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2"> 
                      {isWebhookLoading ? (
                        // Show loader when checking webhook status
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        // Always show a clickable toggle for connected accounts
                        stravaIntegration ? (
                          <Button
                            onClick={webhookStatus?.subscribed ? handleRemoveWebhook : handleSetupWebhook}
                            disabled={isSettingUpWebhook}
                            variant={webhookStatus?.subscribed ? "default" : "outline"}
                            className={`px-3 py-1 h-8 ${webhookStatus?.subscribed ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
                            size="sm"
                          >
                            {isSettingUpWebhook ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : webhookStatus?.subscribed ? (
                              "On"
                            ) : (
                              "Off"
                            )}
                          </Button>
                        ) : null
                      )}
                    </div>
                   </div>
                   
                   {/* Status text */}
                   {!isWebhookLoading && webhookStatus?.subscribed && (
                     <p className="text-xs text-muted-foreground">
                       Auto-sync active. Last update check: {webhookStatus.lastUpdated ? formatDate(webhookStatus.lastUpdated) : "N/A"}
                       
                       {/* Add test webhook button in development mode */}
                       {process.env.NODE_ENV === 'development' && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={async () => {
                             try {
                               const testData = {
                                 object_type: "activity",
                                 object_id: Math.floor(Math.random() * 10000000),
                                 aspect_type: "create",
                                 owner_id: webhookStatus?.subscription?.athlete_id || stravaIntegration?.athleteId,
                                 event_time: Math.floor(Date.now() / 1000)
                               };
                               
                               toast({
                                 title: "Testing webhook",
                                 description: "Sending test activity event..."
                               });
                               
                               const response = await fetch('/api/strava/test-webhook', {
                                 method: 'POST',
                                 headers: {
                                   'Content-Type': 'application/json'
                                 },
                                 body: JSON.stringify(testData)
                               });
                               
                               const result = await response.json();
                               
                               if (result.success) {
                                 toast({
                                   title: "Test successful",
                                   description: "Webhook test event was processed successfully"
                                 });
                                 
                                 // Reload webhook status to update lastUpdated
                                 setTimeout(loadWebhookStatus, 1000);
                               } else {
                                 throw new Error(result.error || "Unknown error processing test webhook");
                               }
                             } catch (error) {
                               console.error("Error testing webhook:", error);
                               toast({
                                 title: "Test failed",
                                 description: error instanceof Error ? error.message : "Failed to test webhook",
                                 variant: "destructive"
                               });
                             }
                           }}
                           className="ml-2 mt-1"
                         >
                           Test Auto-sync
                         </Button>
                       )}
                     </p>
                   )}
                   {!isWebhookLoading && webhookStatus !== null && !webhookStatus?.subscribed && !isSettingUpWebhook && (
                     <p className="text-xs text-muted-foreground">
                       Auto-sync is currently disabled. Click "Off" to enable it.
                     </p>
                   )}
                   {!isWebhookLoading && webhookStatus === null && stravaIntegration && (
                     <p className="text-xs text-muted-foreground">
                       Auto-sync status unknown. Click "Off" to enable it.
                     </p>
                   )}
                </div>

                {/* Sync Preferences */}
                <Collapsible open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
                  <CollapsibleTrigger asChild>
                     <Button variant="ghost" className="w-full flex justify-between px-1">
                       <span className="text-base font-medium">Sync Preferences</span>
                      {isPreferencesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 pl-2 border-l-2 ml-1">
                    <p className="text-sm text-muted-foreground">Select which activity types to automatically sync when new activities are detected on Strava.</p>
                     {isLoadingPreferences ? (
                       <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading preferences...</span>
                       </div>
                    ) : (
                    <div className="space-y-2">
                        {syncPreferences.map((type) => {
                           const isDisabled = type.disabled || isSavingPreferences;
                           return (
                             <div key={type.id}>
                               <div className="flex items-center space-x-2">
                          <Checkbox
                            id={type.id}
                            checked={type.enabled}
                            onCheckedChange={() => toggleSyncPreference(type.id)}
                                   disabled={isDisabled}
                          />
                          <label htmlFor={type.id} className="text-sm font-medium">
                            {type.label}
                          </label>
                        </div>
                               {(type.id === 'strength' || type.id === 'weight_training' || type.id === 'workout') && (
                                 <p className="text-xs text-muted-foreground pl-6 pt-1">
                                   We recommend logging strength workouts manually in Aivery for detailed exercise tracking. However, you can sync basic Strava strength sessions and add exercises later.
                                 </p>
                               )}
                    </div>
                           );
                         })}
                      </div>
                    )}
                    {!isLoadingPreferences && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveSyncPreferences}
                      disabled={isSavingPreferences}
                      className="mt-2"
                    >
                        {isSavingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Preferences"}
                    </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>

              </div>
            ) : (
              // --- Disconnected State --- 
              <Button
                onClick={handleConnectStrava}
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Connect Strava for Auto-Sync
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

            </div>
  );
} 