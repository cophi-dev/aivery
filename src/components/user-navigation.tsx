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
import { LucideBell, LucideLogOut, LucideMoon, LucideSun, LucideSettings, LucideUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./user-avatar";
import { useEffect, useState } from "react";

// Inner component that only renders when session is valid
function UserNavigationInner({ session }: { session: any }) {
  const { setTheme } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  
  // Ensure we have safe defaults and type checking for user info
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    nickname: '',
  });

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
        // Fetch avatar
        const avatarResponse = await fetch('/api/user/avatar');
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          if (avatarData.image && typeof avatarData.image === 'string') {
            setImageUrl(avatarData.image);
          }
        }
        
        // Fetch user info with nickname
        const userResponse = await fetch('/api/user');
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

  // Handle logout safely - direct to URL, don't use callback
  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
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
          className="relative h-10 w-10 p-0 rounded-full"
        >
          <UserAvatar 
            name={safeNickname || safeName || safeSessionEmail || 'U'} 
            imageUrl={typeof imageUrl === 'string' ? imageUrl : null}
            size="md"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {safeNickname || safeName}
            </p>
            <p className="text-xs text-muted-foreground">{safeEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/settings">
            <DropdownMenuItem>
              <LucideSettings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LucideBell className="mr-2 h-4 w-4" />
              <span>Appearance</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <LucideSun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <LucideMoon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-red-500 focus:text-red-500" 
          onClick={handleLogout}
        >
          <LucideLogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
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