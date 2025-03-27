import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "../../../../lib/db/mongodb"
import { Document, WithId } from "mongodb"

interface Workout {
  _id: any;
  name: string;
  date: string;
  type: string;
  stravaLink?: string;
  notes?: string;
  source: string;
  importedFrom: string;
}

interface MappedWorkout {
  id: string;
  name: string;
  date: string;
  type: string;
  hasStravaLink: boolean;
  stravaLink?: string;
  hasNotes: boolean;
  noteLength: number;
  notesExcerpt: string;
  source: string;
  importedFrom: string;
}

export async function GET(req: NextRequest) {
  try {
    const collection = await getCollection("workouts")
    
    // Get the most recent 10 workouts
    const workouts = await collection
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray()
    
    // Map the workouts to a more readable format 
    const mappedWorkouts = workouts.map((doc) => {
      const workout = doc as unknown as Workout;
      return {
        id: workout._id.toString(),
        name: workout.name,
        date: workout.date,
        type: workout.type,
        hasStravaLink: !!workout.stravaLink,
        stravaLink: workout.stravaLink,
        hasNotes: !!workout.notes,
        noteLength: workout.notes ? workout.notes.length : 0,
        notesExcerpt: workout.notes ? workout.notes.substring(0, 100) + '...' : '',
        source: workout.source,
        importedFrom: workout.importedFrom
      } as MappedWorkout;
    });
    
    return NextResponse.json({ 
      workouts: mappedWorkouts,
      count: mappedWorkouts.length,
      hasStravaLinks: mappedWorkouts.filter((w: MappedWorkout) => w.hasStravaLink).length
    })
  } catch (error) {
    console.error('Error debugging workouts:', error)
    return NextResponse.json({ error: 'Failed to debug workouts' }, { status: 500 })
  }
} 