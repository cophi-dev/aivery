import Link from "next/link"
import { LucideBrain, Menu, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <LucideBrain className="h-5 w-5 text-primary" />
          <span>Aivery</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/chat">
            <Button variant="outline" size="sm">
              AI Coach
            </Button>
          </Link>
          <Link href="/my-story">
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              My Story
            </Button>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="grid gap-4 py-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl px-2">
                  <LucideBrain className="h-5 w-5 text-primary" />
                  <span>Aivery</span>
                </Link>
                <div className="grid gap-2">
                  <Link href="/" className="px-2 py-1 hover:underline">
                    Dashboard
                  </Link>
                  <Link href="/workouts" className="px-2 py-1 hover:underline">
                    Workouts
                  </Link>
                  <Link href="/plan" className="px-2 py-1 hover:underline">
                    Plans
                  </Link>
                  <Link href="/chat" className="px-2 py-1 hover:underline">
                    AI Coach
                  </Link>
                  <Link href="/activity/new" className="px-2 py-1 hover:underline">
                    Log Activity
                  </Link>
                  <Link href="/analytics" className="px-2 py-1 hover:underline">
                    Analytics
                  </Link>
                  <Link href="/integrations" className="px-2 py-1 hover:underline">
                    Integrations
                  </Link>
                  <Link href="/settings" className="px-2 py-1 hover:underline">
                    Settings
                  </Link>
                  <Link href="/my-story" className="px-2 py-1 hover:underline flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    My Story
                  </Link>
                  <div className="h-px bg-border my-1"></div>
                  <Link href="/init-db" className="px-2 py-1 hover:underline text-green-600">
                    Initialize Database
                  </Link>
                  <Link href="/check-db" className="px-2 py-1 hover:underline text-primary">
                    Check DB Connection
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

