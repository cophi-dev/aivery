"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LucideUpload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function StravaImport() {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      setIsUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/strava/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to import data')
      }

      const data = await response.json()

      toast({
        title: "Import successful",
        description: `Imported ${data.count} workouts from your Strava archive`,
      })
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: "Import failed",
        description: "There was an error importing your Strava data. Please try again.",
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
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="max-w-sm"
          />
          <Button disabled={isUploading}>
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