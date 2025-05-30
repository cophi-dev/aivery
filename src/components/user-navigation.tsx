'use client';

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import { 
  LucideBell, 
  LucideLogOut, 
  LucideMoon, 
  LucideSun, 
  LucideSettings, 
  LucideUser,
  LucideHelpCircle,
  LucideFileText,
  LucideShare2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./user-avatar";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/client-utils";
import { cn } from "@/lib/utils";

// Inner component that only renders when session is valid
function UserNavigationInner({ session }: { session: any }) {
  const { setTheme } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const pathname = usePathname();
  
  // Ensure we have safe defaults and type checking for user info
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    nickname: '',
  });

  // Safety check for pathname to fix deployment error
  const isPath = (path: string) => {
    return pathname ? pathname.startsWith(path) : false;
  };

  // Fetch user avatar and info
  useEffect(() => {
    // Get safe string values from session
    setUserInfo({
      name: typeof session.user.name === 'string' ? session.user.name : '',
      email: typeof session.user.email === 'string' ? session.user.email : '',
      nickname: typeof (session.user as any)?.nickname === 'string' ? (session.user as any).nickname : '',
    });
    
    async function fetchUserData() {
      try {
        // Fetch avatar using auth utility
        const avatarResponse = await fetchWithAuth('/api/user/avatar');
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          if (avatarData.image && typeof avatarData.image === 'string') {
            setImageUrl(avatarData.image);
          }
        }
        
        // Fetch user info with nickname using auth utility
        const userResponse = await fetchWithAuth('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.user) {
            setUserInfo({
              name: typeof userData.user.name === 'string' ? userData.user.name : 
                    (typeof session.user.name === 'string' ? session.user.name : ''),
              email: typeof userData.user.email === 'string' ? userData.user.email : 
                     (typeof session.user.email === 'string' ? session.user.email : ''),
              nickname: typeof userData.user.nickname === 'string' ? userData.user.nickname : 
                        (typeof (session.user as any)?.nickname === 'string' ? (session.user as any).nickname : ''),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
    
    fetchUserData();
  }, [session]);

  // Combine robust client-side clearing with non-blocking server-side attempt
  const handleLogout = () => {
    console.log('[handleLogout] Clicked!');
    try {
      // Rely on next-auth for sign out and redirect
      signOut({ callbackUrl: '/' }); 
      console.log('[handleLogout] Initiated NextAuth signOut with callbackUrl: /');
    } catch (error) {
      console.error('[handleLogout] Error initiating signOut:', error);
      // Fallback redirect in case signOut itself throws an unexpected error
      window.location.href = '/login'; 
    }
  };

  // Create safe display values
  const safeNickname = typeof userInfo.nickname === 'string' ? userInfo.nickname : '';
  const safeName = typeof userInfo.name === 'string' ? userInfo.name : '';
  const safeEmail = typeof userInfo.email === 'string' ? userInfo.email : '';
  const safeSessionEmail = typeof session.user.email === 'string' ? session.user.email : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 p-0 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2"
        >
          <UserAvatar 
            name={safeNickname || safeName || safeSessionEmail || 'U'} 
            imageUrl={typeof imageUrl === 'string' ? imageUrl : null}
            size="md"
          />
          {/* Online status indicator */}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-64 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg rounded-lg" 
        align="end" 
        forceMount
        sideOffset={8}
      >
        {/* User Info Header */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center space-x-3">
            <UserAvatar 
              name={safeNickname || safeName || safeSessionEmail || 'U'} 
              imageUrl={typeof imageUrl === 'string' ? imageUrl : null}
              size="sm"
              className="ring-2 ring-primary/20"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {safeNickname || safeName || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{safeEmail}</p>
              <div className="flex items-center mt-1">
                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Account Management */}
        <div className="py-2">
          <div className="px-3 py-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </p>
          </div>
          <DropdownMenuGroup>
            <Link href="/settings">
              <DropdownMenuItem className="mx-2 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-colors">
                <LucideSettings className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Settings</span>
                  <span className="text-xs text-muted-foreground">Manage your account</span>
                </div>
              </DropdownMenuItem>
            </Link>
            
            {/* Theme submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="mx-2 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-colors">
                <LucideBell className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Theme</span>
                  <span className="text-xs text-muted-foreground">Customize appearance</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg">
                  <DropdownMenuItem onClick={() => setTheme("light")} className="hover:bg-accent/80 transition-colors">
                    <LucideSun className="mr-2 h-4 w-4 text-amber-500" />
                    <span>Light</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="hover:bg-accent/80 transition-colors">
                    <LucideMoon className="mr-2 h-4 w-4 text-blue-500" />
                    <span>Dark</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")} className="hover:bg-accent/80 transition-colors">
                    <LucideUser className="mr-2 h-4 w-4 text-green-500" />
                    <span>System</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </div>
        
        <DropdownMenuSeparator className="mx-2" />
        
        {/* Additional Links */}
        <div className="py-2">
          <div className="px-3 py-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              More
            </p>
          </div>
          <DropdownMenuGroup>
            <Link href="/integrations">
              <DropdownMenuItem className="mx-2 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-colors">
                <LucideFileText className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Integrations</span>
                  <span className="text-xs text-muted-foreground">Connect your apps</span>
                </div>
              </DropdownMenuItem>
            </Link>

            <Link href="/share">
              <DropdownMenuItem className="mx-2 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-colors">
                <LucideShare2 className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Share Moments</span>
                  <span className="text-xs text-muted-foreground">Create shareable cards</span>
                </div>
              </DropdownMenuItem>
            </Link>
            
            <Link href="/my-story">
              <DropdownMenuItem className="mx-2 rounded-md hover:bg-accent/80 focus:bg-accent/80 transition-colors">
                <LucideHelpCircle className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">My Story</span>
                  <span className="text-xs text-muted-foreground">Your fitness journey</span>
                </div>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
        </div>
        
        <DropdownMenuSeparator className="mx-2" />
        
        {/* Logout */}
        <div className="py-2">
          <DropdownMenuItem 
            className="mx-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 focus:bg-red-50 dark:focus:bg-red-950/50 transition-colors cursor-pointer" 
            onClick={handleLogout}
          >
            <LucideLogOut className="mr-3 h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Sign out</span>
              <span className="text-xs text-muted-foreground">Log out of your account</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Wrapper component to check session and only render inner component when valid
export function UserNavigation() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  // Don't render on auth pages at all
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/register' || 
    pathname === '/forgot-password';

  // Don't render during loading or if no session
  if (status === "loading" || !session || !session.user || isAuthPage) {
    return null;
  }

  // Now we're sure session exists, render the inner component
  return <UserNavigationInner session={session} />;
} 