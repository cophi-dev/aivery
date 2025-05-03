import { 
  fetchAllExercisesAction, 
  getUsedExercises, 
  fetchExerciseByName 
} from "@/lib/exercise-actions"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Dumbbell } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ExerciseData } from "@/types/db"
import { redirect } from "next/navigation"
import type { Metadata } from 'next'
import { Input } from "@/components/ui/input"
import { ExerciseGrid } from "@/components/exercises/exercise-grid"

export const metadata: Metadata = {
  title: "Exercises | Aivery",
  description: "Browse and manage exercises",
  openGraph: {
    title: "Exercises | Aivery",
    description: "Browse and manage exercises",
    url: "https://your-aivery-app-url.com/exercises",
    images: [
      {
        url: "/images/og-exercises.png",
        width: 1200,
        height: 630,
        alt: "Aivery Exercises Page",
      }
    ],
    type: 'website',
  },
}

// Revalidate this page on demand or periodically if needed
// export const revalidate = 3600; // Example: revalidate every hour

export default async function ExercisesPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const nameParam = searchParams.name as string | undefined
  
  if (nameParam) {
    const exercise = await fetchExerciseByName(nameParam)
    if (exercise) {
      redirect(`/exercises/${exercise._id}`)
    }
  }
  
  const allExercises = await fetchAllExercisesAction();
  const usedExercises = await getUsedExercises();
  
  const exerciseNotFound = nameParam ? true : false
  
  const strengthExercises = allExercises.filter((ex: ExerciseData) => ex.category === "strength")
  const cardioExercises = allExercises.filter((ex: ExerciseData) => ex.category === "cardio")
  const flexibilityExercises = allExercises.filter((ex: ExerciseData) => ex.category === "flexibility")

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
          <p className="text-muted-foreground mt-1">Browse and manage your exercise library</p>
        </div>
        <Link href="/exercises/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-4 bg-card p-4 rounded-lg border shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input 
          type="search" 
          placeholder="Search exercises..." 
          className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
        />
      </div>

      {exerciseNotFound && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-md mb-6">
          <p>Exercise &quot;{nameParam}&quot; not found. You can create it or browse existing exercises below.</p>
        </div>
      )}
      
      {allExercises.length === 0 ? ( 
        <div className="text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-muted-foreground mb-2">No exercises found in the database.</p>
              <p className="text-sm text-muted-foreground">
                Start by adding exercises to your database.
              </p>
            </div>
            <Link href="/exercises/new">
              <Button>Add Exercise</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground relative">
            <TabsTrigger 
              value="all" 
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3 rounded-sm"
            >
              All ({allExercises.length})
            </TabsTrigger>
            <TabsTrigger 
              value="performed" 
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3 rounded-sm"
            >
              Performed ({usedExercises.length})
            </TabsTrigger>
            <TabsTrigger 
              value="strength" 
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3 rounded-sm"
            >
              Strength ({strengthExercises.length})
            </TabsTrigger>
            <TabsTrigger 
              value="cardio" 
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3 rounded-sm"
            >
              Cardio ({cardioExercises.length})
            </TabsTrigger>
            <TabsTrigger 
              value="flexibility" 
              className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3 rounded-sm"
            >
              Flexibility ({flexibilityExercises.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <ExerciseGrid exercises={allExercises} />
          </TabsContent>
          
          <TabsContent value="performed">
            <ExerciseGrid exercises={usedExercises} />
          </TabsContent>
          
          <TabsContent value="strength">
            <ExerciseGrid exercises={strengthExercises} />
          </TabsContent>
          
          <TabsContent value="cardio">
            <ExerciseGrid exercises={cardioExercises} />
          </TabsContent>
          
          <TabsContent value="flexibility">
            <ExerciseGrid exercises={flexibilityExercises} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
} 