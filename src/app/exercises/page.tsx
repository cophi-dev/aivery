import { fetchExercises, fetchExerciseByName } from "@/lib/exercise-actions"
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

export const metadata = {
  title: "Exercises | Aivery",
  description: "Browse and manage exercises",
}

// Revalidate this page on demand or periodically if needed
// export const revalidate = 3600; // Example: revalidate every hour

export default async function ExercisesPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const nameParam = searchParams.name as string | undefined
  const tagsParam = searchParams.tags as string | undefined // Get tags from URL
  
  // If a name is provided, try to find the matching exercise and redirect
  if (nameParam) {
    const exercise = await fetchExerciseByName(nameParam)
    if (exercise) {
      // If found, redirect to the exercise detail page
      redirect(`/exercises/${exercise._id}`)
    }
    // If not found, continue to show the list with a note
  }
  
  // Fetch exercises, passing the tags parameter
  // We assume fetchExercises is updated or calls the API route which handles tags
  const exercises = await fetchExercises(tagsParam)
  
  // Track if a name was searched but not found
  const exerciseNotFound = nameParam ? true : false
  
  // Restore category filtering logic
  const strengthExercises = exercises.filter(ex => ex.category === "strength")
  const cardioExercises = exercises.filter(ex => ex.category === "cardio")
  const flexibilityExercises = exercises.filter(ex => ex.category === "flexibility")

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
      
      {/* Show notification if exercise was not found */}
      {exerciseNotFound && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-md mb-6">
          <p>Exercise &quot;{nameParam}&quot; not found. You can create it or browse existing exercises below.</p>
        </div>
      )}
      
      {/* ADD FILTER COMPONENT HERE LATER - Removed as per user request */}

      {/* Restore original structure with Tabs */}
      {exercises.length === 0 && !tagsParam ? ( // Show seeding message only if no exercises AND no filters applied
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No exercises found.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Start by adding exercises to your database or seed some predefined exercises.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/api/seed-exercises">
              <Button variant="outline">Seed Sample Exercises</Button>
            </Link>
            <Link href="/exercises/new">
              <Button>Add Exercise</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All ({exercises.length})</TabsTrigger>
            <TabsTrigger value="strength">Strength ({strengthExercises.length})</TabsTrigger>
            <TabsTrigger value="cardio">Cardio ({cardioExercises.length})</TabsTrigger>
            <TabsTrigger value="flexibility">Flexibility ({flexibilityExercises.length})</TabsTrigger>
            {/* Add "Used Exercises" tab later */}
          </TabsList>
          
          <TabsContent value="all">
            <ExerciseGrid exercises={exercises} />
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