"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LucideCheck, LucideX, LucideLoader, LucideDatabase, LucideRefreshCw, LucideAlertTriangle } from "lucide-react"
import { Header } from "@/components/header"

export default function CheckDbPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean
    message: string
    error?: string
    details?: string
    timestamp?: string
    environmentCheck?: {
      nodeEnv: string
      mongodbUri: string
    }
  } | null>(null)

  const checkDbConnection = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/check-db")
      const data = await response.json()
      setDbStatus(data)
    } catch (error) {
      console.error("Error checking database connection:", error)
      setDbStatus({
        connected: false,
        message: "Failed to check database connection",
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkDbConnection()
  }, [])

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Database Connection</h1>
            <p className="text-muted-foreground mt-2">Check if the MongoDB connection is working</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LucideDatabase className="h-5 w-5 text-primary" />
                <CardTitle>MongoDB Connection Status</CardTitle>
              </div>
              <Button onClick={checkDbConnection} variant="outline" size="sm" disabled={isLoading}>
                {isLoading ? (
                  <LucideLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LucideRefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
            <CardDescription>Shows the current status of the MongoDB connection</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LucideLoader className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : dbStatus ? (
              <div className="space-y-4">
                <Alert className={dbStatus.connected ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                  {dbStatus.connected ? (
                    <LucideCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <LucideX className="h-4 w-4 text-red-600" />
                  )}
                  <AlertTitle>{dbStatus.connected ? "Connected" : "Connection Failed"}</AlertTitle>
                  <AlertDescription>{dbStatus.message}</AlertDescription>
                </Alert>

                {dbStatus.details && (
                  <div className="p-4 border rounded-md bg-muted/50">
                    <h3 className="text-sm font-medium mb-2">Details</h3>
                    <p className="text-sm text-muted-foreground">{dbStatus.details}</p>
                  </div>
                )}

                {dbStatus.environmentCheck && (
                  <div className="p-4 border rounded-md bg-muted/50">
                    <h3 className="text-sm font-medium mb-2">Environment Check</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="font-medium">NODE_ENV:</div>
                      <div>{dbStatus.environmentCheck.nodeEnv}</div>

                      <div className="font-medium">MONGODB_URI:</div>
                      <div className="flex items-center gap-1">
                        {dbStatus.environmentCheck.mongodbUri === "not set" ? (
                          <>
                            <LucideAlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-amber-700">Not set</span>
                          </>
                        ) : (
                          <>
                            <LucideCheck className="h-4 w-4 text-green-500" />
                            <span className="text-green-700">Set</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {dbStatus.error && (
                  <div className="p-4 border border-red-200 rounded-md bg-red-50">
                    <h3 className="text-sm font-medium text-red-800">Error Details</h3>
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-red-700 overflow-auto max-h-[200px]">
                      {dbStatus.error}
                    </pre>
                  </div>
                )}

                {dbStatus.timestamp && (
                  <div className="text-xs text-muted-foreground mt-4">
                    Last checked: {new Date(dbStatus.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Unable to check database connection status.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MongoDB Connection Information</CardTitle>
            <CardDescription>Environment configuration for MongoDB</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Environment Variables</h3>
                <div className="p-4 border rounded-md bg-muted">
                  <p className="text-sm mb-2">
                    <strong>MONGODB_URI:</strong> {process.env.MONGODB_URI ? "Set ✓" : "Not set ✗"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The MONGODB_URI should be in the format:
                    mongodb+srv://username:password@cluster.mongodb.net/database
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Troubleshooting</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Make sure the MongoDB URI is correctly set in the environment variables</li>
                  <li>Check if the MongoDB Atlas cluster is running and accessible</li>
                  <li>Verify that the IP address of your application is whitelisted in MongoDB Atlas</li>
                  <li>Ensure the database user has the correct permissions</li>
                  <li>For Vercel preview environments, make sure environment variables are properly configured</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Setting Up MongoDB</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>
                    Create a MongoDB Atlas account at{" "}
                    <a
                      href="https://www.mongodb.com/cloud/atlas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      mongodb.com/cloud/atlas
                    </a>
                  </li>
                  <li>Create a new cluster (the free tier is sufficient for development)</li>
                  <li>Create a database user with read/write permissions</li>
                  <li>Add your IP address to the IP whitelist (or use 0.0.0.0/0 for development)</li>
                  <li>Get your connection string from the "Connect" button</li>
                  <li>Add the connection string as MONGODB_URI in your environment variables</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

