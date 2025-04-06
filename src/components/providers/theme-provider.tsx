'use client'

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

// When Next.js router changes routes, this prevents flashing
const DARK_MODE_CLASS = 'dark';
const DARK_BG_COLOR = '#1e293b';

// Force dark mode on all pages
const forceDarkMode = () => {
  if (typeof window !== 'undefined') {
    // Add dark class and set background color
    document.documentElement.classList.add(DARK_MODE_CLASS);
    document.documentElement.style.backgroundColor = DARK_BG_COLOR;
  }
};

// Function to create MutationObserver to monitor class changes
const createDarkModeObserver = () => {
  if (typeof window === 'undefined') return null;
  
  const observer = new MutationObserver(() => {
    const html = document.documentElement;
    const hasDarkClass = html.classList.contains(DARK_MODE_CLASS);
    
    // If dark class is removed, add it back
    if (!hasDarkClass) {
      html.classList.add(DARK_MODE_CLASS);
      html.style.backgroundColor = DARK_BG_COLOR;
    }
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  return observer;
};

export function ThemeProvider({ 
  children, 
  ...props 
}: ThemeProviderProps & { children: React.ReactNode }) {
  
  React.useEffect(() => {
    // Force dark mode
    forceDarkMode();
    
    // Create observer to restore dark mode if lost
    const observer = createDarkModeObserver();
    
    // Set up event listeners for page transitions
    window.addEventListener('beforeunload', forceDarkMode);
    
    // Apply dark mode after each navigation/page transition
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      // Call original function first
      const result = originalPushState.apply(this, args);
      
      // Then force dark mode
      forceDarkMode();
      
      return result;
    };
    
    return () => {
      // Clean up
      window.removeEventListener('beforeunload', forceDarkMode);
      observer?.disconnect();
      history.pushState = originalPushState;
    };
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark" 
      enableSystem={false}
      forcedTheme="dark"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
} 