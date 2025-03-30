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

    // Check if we've refreshed in the last 10 seconds - prevents refresh loops
    // Reduced from 60 seconds to 10 seconds for more aggressive refreshing
    const lastRefreshTime = localStorage.getItem('last-refresh-time');
    const currentTime = Date.now();
    if (lastRefreshTime && (currentTime - parseInt(lastRefreshTime)) < 10000) {
      console.log('🛑 Skipping refresh - cooled down for 10 seconds');
      return;
    }
    
    // Check URL for version query param - if present, we've already refreshed
    const urlParams = new URLSearchParams(window.location.search);
    const urlVersion = urlParams.get('v');
    
    // Always force a reload for /workouts page to ensure the latest version is shown
    const isWorkoutsPage = window.location.pathname.includes('/workouts');
    
    // If URL already has our version, don't refresh again (unless it's the workouts page)
    if (urlVersion && !isWorkoutsPage) {
      console.log('✅ URL already has version parameter:', urlVersion);
      localStorage.setItem('app-version', VERSION);
      localStorage.setItem('last-refresh-time', currentTime.toString());
      return;
    }

    const storedVersion = localStorage.getItem('app-version');
    const currentVersion = VERSION;

    // If no stored version, version mismatch, or workouts page, update and reload
    if (!storedVersion || storedVersion !== currentVersion || isWorkoutsPage) {
      console.log('🔄 Version changed or workouts page, refreshing cache and app...');
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
        if (isWorkoutsPage) {
          // For workouts page, use a hard reload with cache clearing
          window.location.reload();
          // Additionally, set cache-control header in meta tag
          document.head.innerHTML += `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`;
        } else {
          window.location.href = window.location.href + 
            (window.location.href.includes('?') ? '&' : '?') + 
            'v=' + currentVersion;
        }
      }, 300);
    } else {
      console.log(`✅ App version up-to-date: ${currentVersion}`);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

export default CacheBuster; 