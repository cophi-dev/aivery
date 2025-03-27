'use client';

import Link from "next/link";
import { signOut } from "next-auth/react";
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
import { AvatarLoader } from "./avatar-loader";
import { useSession } from "next-auth/react";

export function UserNavigation() {
  const { setTheme } = useTheme();
  const { data: session } = useSession();
  const pathname = usePathname();
  
  // Don't render on auth pages at all
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/register' || 
    pathname === '/forgot-password';

  // Only render if we have a session
  if (!session?.user || isAuthPage) {
    return null;
  }

  // Handle logout safely - direct to URL, don't use callback
  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 p-0 rounded-full overflow-hidden">
          <AvatarLoader 
            name={session.user.name as string} 
            size="md" 
            skipLoad={pathname === '/dashboard'} // Skip loading on dashboard to avoid loops
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
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