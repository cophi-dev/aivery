import { fetchExercises } from "@/lib/exercise-actions"
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
import { ExerciseData } from "@/types/db"

export const metadata = {
  title: "Exercises | Aivery",
  description: "Browse and manage exercises",
}

export default async function ExercisesPage() {
  const exercises = await fetchExercises()
  
  // Group exercises by category
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
      
      {exercises.length === 0 ? (
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
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="strength">Strength</TabsTrigger>
            <TabsTrigger value="cardio">Cardio</TabsTrigger>
            <TabsTrigger value="flexibility">Flexibility</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exercises.map(exercise => (
                <ExerciseCard key={exercise._id} exercise={exercise} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="strength">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strengthExercises.length > 0 ? (
                strengthExercises.map(exercise => (
                  <ExerciseCard key={exercise._id} exercise={exercise} />
                ))
              ) : (
                <p className="text-muted-foreground">No strength exercises found.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="cardio">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cardioExercises.length > 0 ? (
                cardioExercises.map(exercise => (
                  <ExerciseCard key={exercise._id} exercise={exercise} />
                ))
              ) : (
                <p className="text-muted-foreground">No cardio exercises found.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="flexibility">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flexibilityExercises.length > 0 ? (
                flexibilityExercises.map(exercise => (
                  <ExerciseCard key={exercise._id} exercise={exercise} />
                ))
              ) : (
                <p className="text-muted-foreground">No flexibility exercises found.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// Exercise card component to reduce repetition
function ExerciseCard({ exercise }: { exercise: ExerciseData }) {
  return (
    <Link href={`/exercises/${exercise._id}`} className="block h-full">
      <Card className="h-full hover:bg-accent/50 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{exercise.name}</CardTitle>
          <p className="text-sm text-muted-foreground capitalize">
            {exercise.category}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 mb-2">
            {exercise.muscleGroups.map((muscle: string) => (
              <Badge key={muscle} variant="secondary" className="capitalize">
                {muscle}
              </Badge>
            ))}
          </div>
          
          {exercise.equipment && (
            <p className="text-sm mt-2">
              <span className="text-muted-foreground">Equipment:</span> {exercise.equipment}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
} 