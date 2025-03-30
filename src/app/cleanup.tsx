"use client"

// This is a standalone component to break the login loop
// It doesn't depend on any other components or libraries except React

import { useEffect } from 'react'

export default function ForceCleanup() {
  // TEMPORARILY DISABLED - This component is contributing to the redirect issues
  // The actual cleanup function is completely disabled for now
  
  useEffect(() => {
    // Just log that this component is disabled
    console.log('ForceCleanup: Component is disabled to prevent redirect issues')
    
    // Original cleanup code is completely removed
  }, [])
  
  // This component doesn't render anything
  return null
} 