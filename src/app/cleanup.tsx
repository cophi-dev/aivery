"use client"

// This is a standalone component to break the login loop
// It doesn't depend on any other components or libraries except React

import { useEffect } from 'react'

export default function ForceCleanup() {
  useEffect(() => {
    // Log that we're cleaning up
    console.log('ForceCleanup: Attempting to break login loop')
    
    // Function to clear all cookies
    const clearAllCookies = () => {
      try {
        const cookies = document.cookie.split(';')
        
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i]
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          
          // Set expiration in the past to clear cookie
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
          
          // Also try without domain
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=`
        }
        
        console.log('ForceCleanup: Cleared all cookies')
      } catch (e) {
        console.error('ForceCleanup: Error clearing cookies', e)
      }
    }
    
    // Function to clear all storage
    const clearAllStorage = () => {
      try {
        // Clear localStorage
        localStorage.clear()
        
        // Clear sessionStorage
        sessionStorage.clear()
        
        console.log('ForceCleanup: Cleared all storage')
      } catch (e) {
        console.error('ForceCleanup: Error clearing storage', e)
      }
    }
    
    // Detect if we're in a login loop by checking for repeated redirects
    const detectLoginLoop = () => {
      try {
        const navigations = sessionStorage.getItem('navigation-count') || '0'
        const count = parseInt(navigations, 10)
        
        // Count this navigation
        sessionStorage.setItem('navigation-count', (count + 1).toString())
        
        // If we've navigated too many times in a short period, likely a loop
        if (count > 5) {
          console.log('ForceCleanup: Login loop detected, clearing everything')
          clearAllCookies()
          clearAllStorage()
          
          // Reset the counter
          sessionStorage.setItem('navigation-count', '0')
          
          // Add a flag to prevent immediate redirect
          sessionStorage.setItem('loop-broken', 'true')
          
          return true
        }
      } catch (e) {
        console.error('ForceCleanup: Error detecting login loop', e)
      }
      
      return false
    }
    
    // Main cleanup logic
    const runCleanup = () => {
      // Check if we should force cleanup
      const forceClear = new URLSearchParams(window.location.search).get('forceClear') === 'true'
      
      if (forceClear) {
        console.log('ForceCleanup: Forced clearing by URL parameter')
        clearAllCookies()
        clearAllStorage()
        return
      }
      
      // Check for login loop
      const loopDetected = detectLoginLoop()
      
      // If we found a loop, prevent immediate further redirects
      if (loopDetected) {
        // Set a timeout to allow cookies to clear before allowing redirects
        setTimeout(() => {
          sessionStorage.removeItem('loop-broken')
          console.log('ForceCleanup: Loop break complete, allowing redirects')
        }, 2000)
      }
    }
    
    // Run the cleanup
    runCleanup()
    
    // Clean up the navigation counter periodically
    const interval = setInterval(() => {
      try {
        sessionStorage.setItem('navigation-count', '0')
      } catch (e) {
        // Ignore errors
      }
    }, 30000) // Reset counter every 30 seconds
    
    return () => {
      clearInterval(interval)
    }
  }, [])
  
  // This component doesn't render anything
  return null
} 