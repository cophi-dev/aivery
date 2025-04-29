// Imports needed ONLY by Server Component & Metadata
import { fetchExercise, getExerciseHistory } from "@/lib/exercise-actions"
import type { Metadata, ResolvingMetadata } from 'next'
import type { ExerciseData, WorkoutExerciseData } from "@/types/db"
import { notFound } from 'next/navigation' // Import notFound for 404 handling

// Import the dedicated Client Component
import ExerciseDetailPageClient from "@/components/exercise/exercise-detail-client"; 

// Define Props type for the page component
type Props = {
  params: { id: string }
}

// --- Metadata Generation (Server-Side) ---
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const exercise = await fetchExercise(params.id);
  if (!exercise) {
    // Return metadata for not found page
    return { title: "Exercise Not Found | Aivery" }
  }

  const blobBaseUrl = process.env.BLOB_URL;
  const screenshotFilename = `og-images_exercises_${params.id}.png`;
  const screenshotUrl = blobBaseUrl ? `${blobBaseUrl}/${screenshotFilename}` : '/images/og-fallback.png'; 
  const title = `${exercise.name} | Aivery Exercises`;
  const description = exercise.description || `Details and history for the ${exercise.name} exercise.`;
  const pageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/exercises/${params.id}`; 

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: [{ url: screenshotUrl, width: 1200, height: 630, alt: `${exercise.name} Preview` }],
      type: 'article',
    },
  };
}

// --- Server Component (Default Export) ---
export default async function ExerciseDetailPage({ params }: Props) {
  let initialExercise: ExerciseData | null = null;
  let initialHistory: WorkoutExerciseData[] = [];

  try {
    // Fetch data required for the client component
    initialExercise = await fetchExercise(params.id);
    if (!initialExercise) {
      notFound(); // Trigger 404 if exercise doesn't exist
    }
    initialHistory = await getExerciseHistory(params.id);
  } catch (err) {
    console.error(`[Server Page Error] Failed fetching data for exercise ${params.id}:`, err);
    // Re-throw the error to let Next.js handle it (e.g., display error.tsx)
    throw err;
  }

  // Render the client component, passing necessary data ONLY
  return (
    <ExerciseDetailPageClient 
      initialExercise={initialExercise} 
      initialHistory={initialHistory}
      params={params} 
    />
  );
} 