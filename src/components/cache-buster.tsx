'use client';

import { useEffect } from 'react';
import { VERSION } from '@/app/version';

/**
 * Client-side cache buster component
 * Forces a refresh if the version is different from what's stored in localStorage
 */
export function CacheBuster() {
  useEffect(() => {
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // Check if we've refreshed in the last 60 seconds - prevents refresh loops
    const lastRefreshTime = localStorage.getItem('last-refresh-time');
    const currentTime = Date.now();
    if (lastRefreshTime && (currentTime - parseInt(lastRefreshTime)) < 60000) {
      console.log('🛑 Skipping refresh - cooled down for 60 seconds');
      return;
    }
    
    // Check URL for version query param - if present, we've already refreshed
    const urlParams = new URLSearchParams(window.location.search);
    const urlVersion = urlParams.get('v');
    
    // If URL already has our version, don't refresh again
    if (urlVersion) {
      console.log('✅ URL already has version parameter:', urlVersion);
      localStorage.setItem('app-version', VERSION);
      localStorage.setItem('last-refresh-time', currentTime.toString());
      return;
    }

    const storedVersion = localStorage.getItem('app-version');
    const currentVersion = VERSION;

    // If no stored version or version mismatch, update and reload
    if (!storedVersion || storedVersion !== currentVersion) {
      console.log('🔄 Version changed, refreshing cache and app...');
      console.log(`Previous: ${storedVersion || 'none'} → Current: ${currentVersion}`);
      
      // Clear any caches if Cache API is available
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
            console.log(`🧹 Cache '${cacheName}' cleared`);
          });
        });
      }
      
      // Store the new version and refresh time
      localStorage.setItem('app-version', currentVersion);
      localStorage.setItem('last-refresh-time', currentTime.toString());
      
      // Force reload the page after a small delay to allow localStorage to update
      setTimeout(() => {
        // Forcefully reload the page, bypassing cache
        window.location.href = window.location.href + 
          (window.location.href.includes('?') ? '&' : '?') + 
          'v=' + currentVersion;
      }, 300);
    } else {
      console.log(`✅ App version up-to-date: ${currentVersion}`);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

export default CacheBuster; 