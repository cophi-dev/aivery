"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DebugImage } from '@/components/debug-image'
import { getSession } from 'next-auth/react'

export default function DebugImagesPage() {
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<{ image?: string, name?: string, email?: string } | null>(null)
  
  const fetchUserData = async () => {
    try {
      setLoading(true)
      const session = await getSession()
      
      if (!session?.user) {
        console.error('No user session found')
        setLoading(false)
        return
      }
      
      const response = await fetch('/api/user')
      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }
      
      const data = await response.json()
      console.log('Fetched user data:', data.user)
      setUserData(data.user)
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()
  }, [])
  
  const handleRefresh = () => {
    console.log('Manually refreshing user data')
    fetchUserData()
  }
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Image Debug Page</h1>
        <Button onClick={handleRefresh} disabled={loading}>
          {loading ? (
            <>
              <span className="mr-2">Refreshing...</span>
              <div className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full"></div>
            </>
          ) : (
            'Refresh Data'
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Session Data</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-40 text-xs">
                {JSON.stringify({ session: { user: userData } }, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Profile Image</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center relative">
                    {userData.image ? (
                      <img 
                        src={userData.image} 
                        alt={userData.name || 'User'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{userData.name || 'No name'}</p>
                    <p className="text-sm text-muted-foreground">{userData.email || 'No email'}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Image Data:</p>
                  {userData.image ? (
                    <>
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground overflow-hidden text-ellipsis">
                          <span className="font-medium">Preview:</span> {userData.image.substring(0, 30)}...
                          <span className="ml-2 text-primary-foreground bg-primary px-2 py-1 rounded text-xs">
                            {Math.round(userData.image.length / 1024)}KB
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs"><span className="font-medium">Format:</span> {userData.image.startsWith('data:image/png') ? 'PNG' : userData.image.startsWith('data:image/jpeg') ? 'JPEG' : 'Unknown'}</p>
                        <p className="text-xs"><span className="font-medium">Size:</span> {Math.round(userData.image.length / 1024)}KB ({userData.image.length} characters)</p>
                        <p className="text-xs"><span className="font-medium">Session:</span> {userData.image === userData.image ? 'Matches session' : 'Different from session'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No image data</p>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/settings'}
                >
                  Go to Settings
                </Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No user data found</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Image Debug Tool</CardTitle>
          </CardHeader>
          <CardContent>
            {userData?.image ? (
              <DebugImage src={userData.image} />
            ) : (
              <p className="text-center text-muted-foreground p-8">No image to debug</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 