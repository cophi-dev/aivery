'use client';

import React, { useEffect, useState } from 'react';
import { LucideMoon, LucideMonitor, LucideSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const THEME_KEY = 'aivery-theme';

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>('system');
  const [mounted, setMounted] = useState(false);

  // Update state when component mounts
  useEffect(() => {
    setMounted(true);
    
    // Get stored theme
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme) {
        setTheme(storedTheme);
      }
    } catch (e) {
      console.error('Failed to read theme from localStorage:', e);
    }
  }, []);

  // Function to change theme
  const changeTheme = (newTheme: 'light' | 'dark' | 'system') => {
    try {
      // Store the theme preference
      localStorage.setItem(THEME_KEY, newTheme);
      
      // Update state
      setTheme(newTheme);
      
      // Update DOM
      const htmlEl = document.documentElement;
      
      if (newTheme === 'dark') {
        htmlEl.classList.add('dark');
        console.log('[ThemeSwitcher] Applied dark theme');
      } else if (newTheme === 'light') {
        htmlEl.classList.remove('dark');
        console.log('[ThemeSwitcher] Applied light theme');
      } else if (newTheme === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        htmlEl.classList.toggle('dark', prefersDark);
        console.log(`[ThemeSwitcher] Applied system theme (${prefersDark ? 'dark' : 'light'})`);
      }
      
      // Set data attribute for CSS selectors
      htmlEl.setAttribute('data-theme', newTheme);
      
      // Trigger storage event to notify other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: THEME_KEY,
        newValue: newTheme
      }));
    } catch (e) {
      console.error('Failed to set theme:', e);
    }
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {theme === 'light' && <LucideSun className="h-[1.2rem] w-[1.2rem]" />}
          {theme === 'dark' && <LucideMoon className="h-[1.2rem] w-[1.2rem]" />}
          {theme === 'system' && <LucideMonitor className="h-[1.2rem] w-[1.2rem]" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeTheme('light')}>
          <LucideSun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('dark')}>
          <LucideMoon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('system')}>
          <LucideMonitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 