import { 
  fetchAllExercisesAction, 
  getUsedExercises, 
  fetchExerciseByName 
} from "@/lib/exercise-actions"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideArrowLeft, LucidePlus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ExerciseData } from "@/types/db"
import { redirect } from "next/navigation"
import type { Metadata } from 'next'

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
  // We ignore tagsParam for now as filtering logic might need revisit
  // const tagsParam = searchParams.tags as string | undefined 
  
  // If a name is provided, try to find the matching exercise and redirect
  if (nameParam) {
    const exercise = await fetchExerciseByName(nameParam)
    if (exercise) {
      redirect(`/exercises/${exercise._id}`)
    }
  }
  
  // Fetch ALL exercises for main list and category filtering
  const allExercises = await fetchAllExercisesAction();
  // Fetch USED exercises for the new tab
  const usedExercises = await getUsedExercises();
  
  const exerciseNotFound = nameParam ? true : false
  
  // Filter ALL exercises by category
  const strengthExercises = allExercises.filter((ex: ExerciseData) => ex.category === "strength")
  const cardioExercises = allExercises.filter((ex: ExerciseData) => ex.category === "cardio")
  const flexibilityExercises = allExercises.filter((ex: ExerciseData) => ex.category === "flexibility")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-4">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        </div>
        
        <Link href="/exercises/new">
          <Button>
            <LucidePlus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </Link>
      </div>
      
      {exerciseNotFound && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-md mb-6">
          <p>Exercise &quot;{nameParam}&quot; not found. You can create it or browse existing exercises below.</p>
        </div>
      )}
      
      {allExercises.length === 0 ? ( 
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No exercises found in the database.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Start by adding exercises to your database.
          </p>
          <Link href="/exercises/new">
              <Button>Add Exercise</Button>
          </Link>
          {/* Removed Seed button as API route was deleted */}
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-5"> {/* Adjust grid columns */} 
            <TabsTrigger value="all">All ({allExercises.length})</TabsTrigger>
            <TabsTrigger value="performed">Performed ({usedExercises.length})</TabsTrigger> {/* New Tab */} 
            <TabsTrigger value="strength">Strength ({strengthExercises.length})</TabsTrigger>
            <TabsTrigger value="cardio">Cardio ({cardioExercises.length})</TabsTrigger>
            <TabsTrigger value="flexibility">Flexibility ({flexibilityExercises.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <ExerciseGrid exercises={allExercises} />
          </TabsContent>
          
          {/* New Tab Content */} 
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

// Component for the grid (can stay here or be moved)
function ExerciseGrid({ exercises }: { exercises: ExerciseData[] }) {
    if (exercises.length === 0) {
        return <p className="text-muted-foreground text-center py-8">No exercises found for this category/filter.</p>;
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map(exercise => (
            <ExerciseCard key={exercise._id as string} exercise={exercise} />
          ))}
        </div>
    );
}

// Restore ExerciseCard component definition
function ExerciseCard({ exercise }: { exercise: ExerciseData }) {
  return (
    <Link href={`/exercises/${exercise._id}`} className="block h-full">
      <Card className="h-full hover:bg-accent/50 transition-colors flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{exercise.name}</CardTitle>
          <p className="text-sm text-muted-foreground capitalize">
            {exercise.category}
          </p>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-between">
           <div>
             {/* Use muscleGroups now */}
             <div className="flex flex-wrap gap-1 mb-2">
               {(exercise.muscleGroups  || []).map((muscle: string)  => (
                 <Badge key={muscle} variant="secondary" className="capitalize">
                   {muscle}
                 </Badge>
               ))}
             </div>
             {/* Display Tags */}
             {exercise.tags && exercise.tags.length > 0 && (
               <div className="flex flex-wrap gap-1 mt-2 mb-2 border-t pt-2">
                  {exercise.tags.map((tag: string) => (
                   <Badge key={tag} variant="outline" className="capitalize border-primary/50 text-primary">
                     {tag}
                   </Badge>
                  ))}
               </div>
             )}
           </div>
           {/* Ensure equipment is treated as an array */}
           {Array.isArray(exercise.equipment) && exercise.equipment.length > 0 && (
             <p className="text-xs mt-2 text-muted-foreground">
               Equipment: {exercise.equipment.join(', ')}
             </p>
           )}
         </CardContent>
      </Card>
    </Link>
  )
} 