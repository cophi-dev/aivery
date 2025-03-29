import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongoose";
import { getCollection } from "@/lib/db/mongodb";

// Sample exercises for the API
const SAMPLE_EXERCISES = [
  {
    _id: "ex1",
    name: "Bench Press",
    description: "A compound exercise that primarily targets the chest muscles",
    muscleGroups: ["chest", "triceps", "shoulders"],
    category: "strength",
    equipment: "barbell, bench",
    instructions: "Lie on a bench, grip the barbell, lower to chest, and press back up"
  },
  {
    _id: "ex2",
    name: "Squat",
    description: "A fundamental lower body exercise that works multiple muscle groups",
    muscleGroups: ["quadriceps", "glutes", "hamstrings", "calves"],
    category: "strength",
    equipment: "barbell, squat rack",
    instructions: "Stand with feet shoulder-width apart, bend knees to lower body, then stand back up"
  },
  {
    _id: "ex3",
    name: "Deadlift",
    description: "A compound exercise that works the entire posterior chain",
    muscleGroups: ["back", "hamstrings", "glutes", "traps"],
    category: "strength",
    equipment: "barbell",
    instructions: "Stand with feet hip-width apart, bend to grip barbell, and lift by extending hips and knees"
  },
  {
    _id: "ex4",
    name: "Pull-up",
    description: "An upper body exercise that primarily targets the back and biceps",
    muscleGroups: ["back", "biceps", "shoulders", "forearms"],
    category: "strength",
    equipment: "pull-up bar",
    instructions: "Hang from a bar with palms facing away, pull body up until chin is over the bar"
  },
  {
    _id: "ex5",
    name: "Push-up",
    description: "A bodyweight exercise that works the chest, shoulders, and triceps",
    muscleGroups: ["chest", "shoulders", "triceps", "core"],
    category: "strength",
    equipment: "none",
    instructions: "Start in plank position, lower body until chest nearly touches ground, then push back up"
  },
  {
    _id: "ex6",
    name: "Overhead Press",
    description: "A compound exercise that targets the shoulders and upper body",
    muscleGroups: ["shoulders", "triceps", "upper back"],
    category: "strength",
    equipment: "barbell or dumbbells",
    instructions: "Stand with feet shoulder-width apart, press weight overhead, then lower back to shoulders"
  },
  {
    _id: "ex7",
    name: "Barbell Row",
    description: "A pulling exercise that targets the back muscles",
    muscleGroups: ["back", "biceps", "forearms", "shoulders"],
    category: "strength",
    equipment: "barbell",
    instructions: "Bend forward at hips with slight knee bend, pull barbell to lower chest, then lower"
  },
  {
    _id: "ex8",
    name: "Dips",
    description: "A bodyweight exercise for the upper body",
    muscleGroups: ["chest", "triceps", "shoulders"],
    category: "strength",
    equipment: "parallel bars or dip station",
    instructions: "Support body on bars, lower until elbows are at 90 degrees, then push back up"
  },
  {
    _id: "ex9",
    name: "Lunges",
    description: "A unilateral lower body exercise",
    muscleGroups: ["quadriceps", "glutes", "hamstrings", "calves"],
    category: "strength",
    equipment: "none or dumbbells",
    instructions: "Step forward with one leg, lower hips until both knees are bent at 90 degrees, then return to starting position"
  },
  {
    _id: "ex10",
    name: "Plank",
    description: "A core exercise that improves stability",
    muscleGroups: ["core", "shoulders", "back"],
    category: "strength",
    equipment: "none",
    instructions: "Hold a push-up position with body in a straight line from head to heels"
  }
];

export async function GET(request: NextRequest) {
  try {
    // Check for authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Try to get exercises from database if it exists
    try {
      await dbConnect();
      const exercisesCollection = await getCollection("exercises");
      const dbExercises = await exercisesCollection.find({}).limit(100).toArray();
      
      // If we have exercises in the database, return those
      if (dbExercises && dbExercises.length > 0) {
        return NextResponse.json(dbExercises);
      }
    } catch (error) {
      console.error("Error fetching exercises from database:", error);
    }

    // Otherwise, return sample exercises
    return NextResponse.json(SAMPLE_EXERCISES);
  } catch (error) {
    console.error("Error in /api/exercises route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 