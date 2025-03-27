"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Info, ArrowRight, Check, Calendar, Activity, Bike, Dumbbell } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

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

    try {
      setIsUploading(true)
      console.log('Starting upload of file:', selectedFile.name)

      const formData = new FormData()
      formData.append('file', selectedFile)

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

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
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

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-400">Recommended First Step</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          For the best experience, we recommend first importing your workout history by uploading your Strava archive. 
          This will give you immediate access to all your past training data.
        </AlertDescription>
      </Alert>
      
      {importStats ? renderImportSummary() : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  Import Strava Archive
                  <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                    Recommended
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-2">
                  Import your entire workout history in one step
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Download your archive from your <a href="https://www.strava.com/settings/profile" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Strava Settings page</a></li>
                  <li>Select "Request Your Archive" and wait for the email from Strava</li>
                  <li>Download the ZIP file from the email and upload it below</li>
                </ol>
              </div>
              
              <div className="mt-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <label 
                    htmlFor="strava-file-input"
                    className="cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-4 border-2 border-dashed rounded-md text-sm font-medium bg-background hover:bg-accent transition-colors"
                  >
                    <Upload className="h-5 w-5" />
                    <span>{selectedFile ? selectedFile.name : "Choose Strava Archive"}</span>
                    <input
                      id="strava-file-input"
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      className="sr-only"
                    />
                  </label>
                  
                  {selectedFile && (
                    <Button 
                      onClick={handleUpload}
                      size="lg"
                      disabled={isUploading}
                      className="w-full sm:w-auto"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Import Workouts
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {selectedFile && !importStats && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                    <Check className="h-4 w-4 mr-1" /> File selected: {selectedFile.name}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Live Strava Connection</CardTitle>
          <CardDescription>
            Connect your Strava account to automatically sync future workouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>Coming soon! This feature will allow you to automatically sync all your new Strava workouts to Aivery as they happen.</p>
          </div>
          <Button disabled className="flex items-center">
            <ArrowRight className="mr-2 h-4 w-4" />
            Connect with Strava
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
              Coming Soon
            </Badge>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 