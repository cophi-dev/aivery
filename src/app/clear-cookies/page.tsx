"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearCookiesPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Clear all cookies
    const clearAllCookies = () => {
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=')
        if (name) {
          // Set expiration in the past to remove cookie
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
      })
      console.log('All cookies have been cleared')
    }
    
    // Clear localStorage
    const clearLocalStorage = () => {
      try {
        // Look for any keys related to Next.js auth
        Object.keys(localStorage).forEach(key => {
          if (key.includes('next-auth') || key.includes('session') || key.includes('token')) {
            localStorage.removeItem(key)
          }
        })
        
        // Also clear any chat messages that might be large
        localStorage.removeItem('aivery-chat-messages')
        
        console.log('LocalStorage cleared of auth and large data')
      } catch (e) {
        console.error('Error clearing localStorage:', e)
      }
    }
    
    // Clear all browser data
    clearAllCookies()
    clearLocalStorage()
    
    // Briefly show message, then redirect
    setTimeout(() => {
      router.push('/login')
    }, 1500)
  }, [router])
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center p-8 bg-background rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Clearing Cookies</h1>
        <p className="mb-4">Fixing session errors...</p>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-sm text-muted-foreground">You will be redirected in a moment.</p>
      </div>
    </div>
  )
} 