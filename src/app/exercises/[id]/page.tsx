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
    return { 
      title: "Exercise Not Found | Aivery",
      description: "The requested exercise could not be found.",
      robots: { index: false, follow: false }
    }
  }

  const blobBaseUrl = process.env.BLOB_URL;
  const screenshotFilename = `og-images_exercises_${params.id}.png`;
  const screenshotUrl = blobBaseUrl ? `${blobBaseUrl}/${screenshotFilename}` : '/api/og-fallback'; 
  const title = `${exercise.name} | Aivery Exercises`;
  const description = exercise.description 
    ? `${exercise.description.slice(0, 150)}...` 
    : `Track your ${exercise.name} performance with detailed analysis and history. Part of your personalized fitness journey with Aivery.`;

  return {
    title,
    description,
    keywords: ['exercise', exercise.name, 'fitness tracking', 'workout', 'performance analysis'],
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app'),
    alternates: {
      canonical: `/exercises/${params.id}`,
    },
    openGraph: {
      title,
      description,
      url: `/exercises/${params.id}`,
      siteName: 'Aivery',
      images: [
        { 
          url: screenshotUrl, 
          width: 1200, 
          height: 630, 
          alt: `${exercise.name} - Exercise Details and Performance Analysis`,
          type: 'image/png'
        },
        {
          url: '/icons/aivery.svg',
          width: 512,
          height: 512,
          alt: 'Aivery Logo',
          type: 'image/svg+xml',
        }
      ],
      type: 'article',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@aivery_app',
      creator: '@aivery_app',
      title,
      description,
      images: [screenshotUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
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