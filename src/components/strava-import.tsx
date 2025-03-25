"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LucideUpload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function StravaImport() {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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
        headers: {
          'Accept': 'application/json',
        }
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import data')
      }

      if (data.count === 0) {
        toast({
          title: "No activities found",
          description: "No activities were found in the Strava archive. Make sure you're uploading the correct file.",
          variant: "destructive"
        })
        return
      }

      toast({
        title: "Import successful",
        description: `Imported ${data.count} workouts from your Strava archive`,
      })

      // Reset the file input and selected file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFile(null)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Strava Archive</CardTitle>
        <CardDescription>
          Upload your Strava archive to import all your historical workouts.
          You can download your archive from your Strava Settings page.
          The file should be a ZIP file containing activities.json.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="max-w-sm"
          />
          <Button 
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Importing...
              </>
            ) : (
              <>
                <LucideUpload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 