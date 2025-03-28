import { createExercise } from "../repositories/exerciseRepository"
import dbConnect from "../mongodb"
import type { ExerciseData } from "@/types/db"

export const exercises: Array<Partial<ExerciseData>> = [
  {
    name: "Push-up",
    description: "A bodyweight exercise that targets the chest, shoulders, and triceps.",
    muscleGroups: ["chest", "shoulders", "triceps"],
    category: "strength",
    equipment: "bodyweight",
    instructions: "Start in a plank position with hands shoulder-width apart. Lower your body until your chest nearly touches the floor. Push your body back up to the starting position."
  },
  {
    name: "Weighted Pull-up",
    description: "A pull-up performed with additional weight attached to the body.",
    muscleGroups: ["back", "biceps", "forearms"],
    category: "strength",
    equipment: "pull-up bar, weight belt",
    instructions: "Attach weight to a belt around your waist. Hang from a pull-up bar with hands slightly wider than shoulder-width. Pull your body up until your chin clears the bar. Lower back to the starting position with control."
  },
  {
    name: "Bench Press",
    description: "A compound strength exercise that develops the chest, shoulders, and triceps.",
    muscleGroups: ["chest", "shoulders", "triceps"],
    category: "strength",
    equipment: "barbell, bench",
    instructions: "Lie on a flat bench with feet on the ground. Grip the barbell with hands slightly wider than shoulder-width. Lower the bar to your chest, then press it back up to the starting position."
  },
  {
    name: "Barbell Row",
    description: "A compound exercise that targets the back, biceps, and posterior chain.",
    muscleGroups: ["back", "biceps", "traps", "forearms"],
    category: "strength",
    equipment: "barbell",
    instructions: "Bend at the hips with a slight knee bend, keeping your back flat. Grip the barbell with hands shoulder-width apart. Pull the bar to your lower ribcage, then lower it back to the starting position with control."
  },
  {
    name: "Squat",
    description: "A compound lower body exercise that primarily targets the quadriceps, hamstrings, and glutes.",
    muscleGroups: ["quadriceps", "hamstrings", "glutes", "core"],
    category: "strength",
    equipment: "barbell or bodyweight",
    instructions: "Stand with feet shoulder-width apart. Lower your body by bending your knees and pushing your hips back. Go down until thighs are parallel to the ground, then return to the starting position."
  },
  {
    name: "Running (Freestyle)",
    description: "Basic running at a consistent pace.",
    muscleGroups: ["quadriceps", "hamstrings", "calves", "glutes", "core"],
    category: "cardio",
    equipment: "running shoes",
    instructions: "Maintain good posture with a slight forward lean. Land midfoot with feet under your body. Keep arms at 90 degrees, swinging from shoulder to hip."
  },
  {
    name: "Running (Interval)",
    description: "Alternating between high-intensity sprints and lower-intensity recovery periods.",
    muscleGroups: ["quadriceps", "hamstrings", "calves", "glutes", "core"],
    category: "cardio",
    equipment: "running shoes",
    instructions: "Warm up with a light jog. Sprint at 80-90% of maximum effort for a set time or distance. Recover with a slow jog or walk. Repeat the sprint/recovery pattern for the desired number of intervals."
  },
  {
    name: "Swimming (Freestyle)",
    description: "The front crawl swimming stroke, also known as freestyle.",
    muscleGroups: ["shoulders", "back", "chest", "core", "glutes", "quadriceps"],
    category: "cardio",
    equipment: "swimwear, goggles (optional)",
    instructions: "Face down in the water with body horizontal. Alternate arm strokes forward while kicking legs. Turn head to the side to breathe every few strokes."
  },
  {
    name: "Swimming (Breaststroke)",
    description: "A swimming stroke performed on the chest with arms moving symmetrically.",
    muscleGroups: ["chest", "shoulders", "back", "glutes", "quadriceps"],
    category: "cardio",
    equipment: "swimwear, goggles (optional)",
    instructions: "Begin face down in the water with arms extended forward. Pull arms back in a circular motion while bringing legs up and out behind you, then propel forward with a frog kick."
  },
  {
    name: "Swimming (Butterfly)",
    description: "A swimming stroke with simultaneous arm movements and dolphin kick.",
    muscleGroups: ["shoulders", "back", "chest", "core", "glutes", "quadriceps"],
    category: "cardio",
    equipment: "swimwear, goggles (optional)",
    instructions: "Start face down with arms extended forward. Pull both arms back simultaneously in a keyhole pattern while performing a dolphin kick with the legs together."
  },
  {
    name: "Standing Hamstring Stretch",
    description: "A stretch that targets the hamstring muscles on the back of the thighs.",
    muscleGroups: ["hamstrings", "lower back"],
    category: "flexibility",
    equipment: "none",
    instructions: "Stand with feet hip-width apart. Extend one leg forward with heel on the ground and toes pointing up. Bend your supporting leg slightly. Hinge at the hips and lean forward, keeping your back straight. Hold for 20-30 seconds, then switch legs."
  },
  {
    name: "Child's Pose",
    description: "A resting yoga pose that gently stretches the lower back, hips, thighs, and ankles.",
    muscleGroups: ["lower back", "hips", "shoulders"],
    category: "flexibility",
    equipment: "yoga mat (optional)",
    instructions: "Kneel on the floor with toes together and knees hip-width apart. Sit back on your heels and extend arms forward, lowering your chest to the ground. Rest your forehead on the floor and relax, breathing deeply. Hold for 1-3 minutes."
  },
  {
    name: "Cobra Stretch",
    description: "A yoga pose that stretches the chest, shoulders, and abdominals while strengthening the spine.",
    muscleGroups: ["chest", "shoulders", "abdominals", "spine"],
    category: "flexibility",
    equipment: "yoga mat (optional)",
    instructions: "Lie face down with hands under shoulders, elbows close to body. Press into hands to lift chest off the floor, keeping hips and legs on the ground. Keep shoulders down and away from ears. Hold for 15-30 seconds while breathing deeply."
  }
]

export async function seedExercises() {
  try {
    await dbConnect()
    console.log("Connected to database")
    
    console.log("Seeding exercises...")
    
    for (const exercise of exercises) {
      try {
        // Check if exercise already exists
        const existingExercise = await import("../../exercise-actions").then(
          module => module.fetchExerciseByName(exercise.name || "")
        )
        
        if (existingExercise) {
          console.log(`Exercise "${exercise.name}" already exists, skipping...`)
          continue
        }
        
        await createExercise(exercise)
        console.log(`Created exercise: ${exercise.name}`)
      } catch (err) {
        console.error(`Error creating exercise ${exercise.name}:`, err)
      }
    }
    
    console.log("Exercise seeding complete")
  } catch (error) {
    console.error("Error seeding exercises:", error)
  }
} 