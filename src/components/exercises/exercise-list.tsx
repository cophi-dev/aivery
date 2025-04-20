'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ExerciseData } from "@/types/db"; // Assuming this type exists

interface ExerciseListProps {
  initialExercises: ExerciseData[];
  // Add other props like initial filter state if needed
}

// Mapping for display names and URL values
const TAG_OPTIONS = [
  { id: 'compound', label: 'Compound' },
  { id: 'bodyweight', label: 'Bodyweight' },
  // Add more tags here as needed (e.g., isolation, push, pull)
];

export function ExerciseList({ initialExercises }: ExerciseListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL search params
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tags = searchParams?.get('tags'); // Use optional chaining
    return tags ? tags.split(',') : [];
  });
  
  const [currentCategory, setCurrentCategory] = useState('all');

  // Update URL when selected tags change
  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams?.toString() || ''); // Handle null searchParams
    if (selectedTags.length > 0) {
      currentParams.set('tags', selectedTags.join(','));
    } else {
      currentParams.delete('tags');
    }
    // Use router.replace to update URL without adding to history stack
    router.replace(`${pathname}?${currentParams.toString()}`, { scroll: false }); 
  }, [selectedTags, pathname, router, searchParams]);

  const handleTagChange = (tagId: string, checked: boolean) => {
    setSelectedTags(prev => {
      if (checked) {
        return [...prev, tagId];
      } else {
        return prev.filter(t => t !== tagId);
      }
    });
  };
  
  // Filter exercises based on the current category tab (client-side)
  // The actual data fetching based on tags happens server-side via navigation
  const getFilteredExercisesForTab = (category: string): ExerciseData[] => {
    if (category === 'all') return initialExercises;
    return initialExercises.filter(ex => ex.category === category);
  }
  
  const allExercises = getFilteredExercisesForTab('all');
  const strengthExercises = getFilteredExercisesForTab('strength');
  const cardioExercises = getFilteredExercisesForTab('cardio');
  const flexibilityExercises = getFilteredExercisesForTab('flexibility');

  return (
    <div>
      {/* Filter Section */}
      <div className="mb-6 p-4 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-3">Filter by Tags</h3>
        <div className="flex flex-wrap gap-4">
          {TAG_OPTIONS.map(tag => (
            <div key={tag.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`tag-${tag.id}`}
                checked={selectedTags.includes(tag.id)}
                onCheckedChange={(checked) => handleTagChange(tag.id, !!checked)}
              />
              <Label htmlFor={`tag-${tag.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {tag.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise List Tabs */}
      {initialExercises.length === 0 ? (
         <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No exercises found matching the selected filters.</p>
        </div>
       ) : (
        <Tabs defaultValue="all" value={currentCategory} onValueChange={setCurrentCategory} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All ({allExercises.length})</TabsTrigger>
            <TabsTrigger value="strength">Strength ({strengthExercises.length})</TabsTrigger>
            <TabsTrigger value="cardio">Cardio ({cardioExercises.length})</TabsTrigger>
            <TabsTrigger value="flexibility">Flexibility ({flexibilityExercises.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <ExerciseGrid exercises={allExercises} />
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
  );
}

// Grid component to display exercises
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

// Exercise card component (Using updated ExerciseData type)
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
            {/* Display Primary Muscles */}
            <div className="flex flex-wrap gap-1 mb-2">
              {(exercise.muscleGroups || []).map((muscle: string) => (
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
          {exercise.equipment && exercise.equipment.length > 0 && (
            <p className="text-xs mt-2 text-muted-foreground">
              Equipment: {Array.isArray(exercise.equipment) ? exercise.equipment.join(', ') : exercise.equipment}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
} 