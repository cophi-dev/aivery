"use server"

import { ExerciseData } from "@/types/db"

// Define the proper category type
type ExerciseCategory = "strength" | "cardio" | "flexibility"

// Define the structure for database entries
interface ExerciseTemplate {
  description: string
  muscleGroups: string[]
  category: ExerciseCategory
  equipment: string
  instructions: string
}

/**
 * Generate exercise details using AI based on the exercise name
 * 
 * @param exerciseName The name of the exercise to generate details for
 * @returns Partial exercise data with suggested fields
 */
export async function generateExerciseDetails(exerciseName: string): Promise<Partial<ExerciseData>> {
  // Predefined exercise data for common exercises
  const exerciseDatabase: Record<string, ExerciseTemplate> = {
    // Strength - Chest
    "bench press": {
      description: "A compound upper-body exercise where weight is pressed upward while lying on a bench",
      muscleGroups: ["chest", "triceps", "shoulders"],
      category: "strength",
      equipment: "Barbell, bench",
      instructions: "1. Lie on a flat bench with feet on the ground\n2. Grip the barbell with hands slightly wider than shoulder-width\n3. Lower the bar to your mid-chest\n4. Press the bar back up to the starting position with arms fully extended"
    },
    "dumbbell press": {
      description: "An upper-body exercise using dumbbells pressed upward while lying on a bench",
      muscleGroups: ["chest", "triceps", "shoulders"],
      category: "strength",
      equipment: "Dumbbells, bench",
      instructions: "1. Lie on a bench with a dumbbell in each hand\n2. Start with dumbbells at chest level, palms facing forward\n3. Press dumbbells upward until arms are extended\n4. Lower back to starting position with control"
    },
    "push up": {
      description: "A classic bodyweight exercise that targets the upper body",
      muscleGroups: ["chest", "triceps", "shoulders", "core"],
      category: "strength",
      equipment: "None",
      instructions: "1. Start in a plank position with hands slightly wider than shoulder-width\n2. Keep your body in a straight line from head to heels\n3. Lower your body until your chest nearly touches the floor\n4. Push back up to the starting position"
    },
    "dumbbell fly": {
      description: "An isolation exercise that targets the chest muscles with a stretching motion",
      muscleGroups: ["chest"],
      category: "strength",
      equipment: "Dumbbells, bench",
      instructions: "1. Lie on a flat bench with a dumbbell in each hand\n2. Extend arms above chest, palms facing each other\n3. Lower weights out to sides in an arc motion\n4. Return to starting position, squeezing chest muscles"
    },
    
    // Strength - Back
    "deadlift": {
      description: "A compound exercise that targets multiple muscle groups by lifting a loaded barbell off the ground",
      muscleGroups: ["back", "glutes", "hamstrings", "quads", "core"],
      category: "strength",
      equipment: "Barbell, weight plates",
      instructions: "1. Stand with feet hip-width apart, barbell over mid-foot\n2. Bend at hips and knees, grip bar just outside legs\n3. Lift bar by straightening hips and knees, keeping back straight\n4. Return bar to floor with controlled movement"
    },
    "pull up": {
      description: "An upper body compound pulling exercise performed by hanging from a bar",
      muscleGroups: ["back", "biceps", "shoulders"],
      category: "strength",
      equipment: "Pull-up bar",
      instructions: "1. Grip pull-up bar with hands wider than shoulder-width\n2. Hang with arms fully extended, legs off the ground\n3. Pull your body upward until chin clears the bar\n4. Lower with control to starting position"
    },
    "bent over row": {
      description: "A compound exercise targeting the back muscles by pulling weight toward the torso",
      muscleGroups: ["back", "biceps", "shoulders"],
      category: "strength",
      equipment: "Barbell or dumbbells",
      instructions: "1. Stand with feet shoulder-width apart, knees slightly bent\n2. Bend forward at the hips, keeping back straight\n3. Pull weight toward lower ribcage\n4. Lower with control and repeat"
    },
    
    // Strength - Legs
    "squat": {
      description: "A compound lower body exercise where you lower your body by bending your knees and hips",
      muscleGroups: ["quads", "glutes", "hamstrings", "core"],
      category: "strength",
      equipment: "Optional: Barbell, squat rack",
      instructions: "1. Stand with feet shoulder-width apart\n2. Lower your body by bending knees and hips, as if sitting in a chair\n3. Keep chest up, back straight, and knees over toes\n4. Return to standing position by pushing through heels"
    },
    "leg press": {
      description: "A machine-based lower body exercise where weight is pushed away with the legs",
      muscleGroups: ["quads", "glutes", "hamstrings"],
      category: "strength",
      equipment: "Leg press machine",
      instructions: "1. Sit on the leg press machine with feet shoulder-width on platform\n2. Release safety catches and lower platform by bending knees\n3. Press weight back up by extending legs (without locking knees)\n4. Control platform back to starting position"
    },
    "lunge": {
      description: "A unilateral lower body exercise that works one leg at a time",
      muscleGroups: ["quads", "glutes", "hamstrings", "calves"],
      category: "strength",
      equipment: "Optional: Dumbbells",
      instructions: "1. Stand with feet together\n2. Step forward with one leg into a lunge position\n3. Lower your back knee toward the floor\n4. Push through front heel to return to starting position\n5. Repeat on other leg"
    },
    
    // Strength - Shoulders
    "overhead press": {
      description: "A compound upper-body exercise where weight is pressed upward from shoulder level",
      muscleGroups: ["shoulders", "triceps", "upper back"],
      category: "strength",
      equipment: "Barbell or dumbbells",
      instructions: "1. Stand with feet shoulder-width apart\n2. Start with weight at shoulder height\n3. Press weight upward until arms are fully extended\n4. Lower with control to starting position"
    },
    "lateral raise": {
      description: "An isolation exercise targeting the middle deltoid muscles",
      muscleGroups: ["shoulders"],
      category: "strength",
      equipment: "Dumbbells",
      instructions: "1. Stand with feet shoulder-width apart, dumbbells at sides\n2. Raise arms out to sides until parallel to floor\n3. Maintain slight bend in elbows throughout movement\n4. Lower with control and repeat"
    },
    
    // Strength - Arms
    "bicep curl": {
      description: "An isolation exercise targeting the biceps muscles",
      muscleGroups: ["biceps"],
      category: "strength",
      equipment: "Dumbbells or barbell",
      instructions: "1. Stand with feet shoulder-width apart, weights in hands\n2. Keep elbows close to sides\n3. Curl weights toward shoulders, rotating forearms\n4. Lower with control to starting position"
    },
    "tricep extension": {
      description: "An isolation exercise targeting the triceps muscles",
      muscleGroups: ["triceps"],
      category: "strength",
      equipment: "Dumbbell, cable machine, or resistance band",
      instructions: "1. Stand or sit with weight held overhead\n2. Keep upper arms close to head\n3. Lower weight behind head by bending elbows\n4. Extend arms back up to starting position"
    },
    
    // Strength - Core
    "plank": {
      description: "An isometric core exercise that promotes stability and strength",
      muscleGroups: ["core", "shoulders", "back"],
      category: "strength",
      equipment: "None",
      instructions: "1. Start in forearm plank position, elbows under shoulders\n2. Keep body in a straight line from head to heels\n3. Engage core and hold position\n4. Maintain normal breathing throughout"
    },
    "russian twist": {
      description: "A rotational exercise targeting the obliques and other core muscles",
      muscleGroups: ["core", "obliques"],
      category: "strength",
      equipment: "Optional: weight or medicine ball",
      instructions: "1. Sit on floor with knees bent, feet elevated slightly\n2. Lean back slightly to engage core\n3. Twist torso to one side, then the other\n4. Add weight for increased difficulty if desired"
    },
    "sit up": {
      description: "A classic abdominal exercise that strengthens core muscles",
      muscleGroups: ["core", "hip flexors"],
      category: "strength",
      equipment: "None, optional mat",
      instructions: "1. Lie on back with knees bent, feet flat on floor\n2. Cross arms over chest or place hands behind head\n3. Lift upper body toward knees using core muscles\n4. Lower back down with control"
    },
    
    // Cardio
    "running": {
      description: "A high-impact cardiovascular exercise that improves endurance",
      muscleGroups: ["quads", "hamstrings", "calves", "core"],
      category: "cardio",
      equipment: "Running shoes, optional treadmill",
      instructions: "1. Maintain proper posture with slightly forward lean\n2. Land midfoot with each step, rolling to forefoot\n3. Keep arms at 90-degree angles, swinging naturally\n4. Breathe regularly and maintain consistent pace"
    },
    "cycling": {
      description: "A low-impact cardiovascular exercise performed on a bicycle",
      muscleGroups: ["quads", "hamstrings", "calves", "glutes"],
      category: "cardio",
      equipment: "Bicycle or stationary bike",
      instructions: "1. Adjust seat height so legs are nearly straight at bottom of pedal stroke\n2. Maintain neutral spine position\n3. Pedal with smooth, consistent cadence\n4. Use appropriate resistance for your fitness level"
    },
    "jumping jacks": {
      description: "A full-body cardio exercise that raises heart rate quickly",
      muscleGroups: ["shoulders", "core", "quads", "calves"],
      category: "cardio",
      equipment: "None",
      instructions: "1. Start standing with feet together and arms at sides\n2. Jump feet out wider than shoulders while raising arms overhead\n3. Jump feet back together while lowering arms\n4. Repeat at a quick, consistent pace"
    },
    
    // Flexibility
    "hamstring stretch": {
      description: "A stretch targeting the muscles at the back of the thigh",
      muscleGroups: ["hamstrings"],
      category: "flexibility",
      equipment: "None, optional mat",
      instructions: "1. Sit on floor with one leg extended, other leg bent\n2. Reach toward extended foot, keeping back straight\n3. Hold for 20-30 seconds, feeling stretch in hamstring\n4. Repeat on other side"
    },
    "quad stretch": {
      description: "A stretch targeting the muscles at the front of the thigh",
      muscleGroups: ["quads"],
      category: "flexibility",
      equipment: "None",
      instructions: "1. Stand on one leg (hold onto something for balance if needed)\n2. Bend the other knee, bringing foot toward buttocks\n3. Hold foot with hand on the same side\n4. Hold for 20-30 seconds, repeat on other side"
    }
  }
  
  // Normalize input name for matching
  const normalizedName = exerciseName.trim().toLowerCase()
  
  // Check if exercise exists in database
  const exactMatch = exerciseDatabase[normalizedName]
  if (exactMatch) {
    // Explicitly create the return object, converting equipment and instructions
    return {
      name: exerciseName,
      description: exactMatch.description,
      // Assuming muscleGroups from local DB matches expected ExerciseData type (string[])
      primaryMuscles: exactMatch.muscleGroups, // Use primaryMuscles if that's the field in ExerciseData
      category: exactMatch.category,
      // Convert equipment string to string array
      equipment: exactMatch.equipment ? exactMatch.equipment.split(',').map(e => e.trim()).filter(e => e) : [],
      // Split instructions string into array
      instructions: exactMatch.instructions ? exactMatch.instructions.split('\n').filter(line => line.trim() !== '') : [],
      // Add other fields from ExerciseData if needed, or ensure exactMatch covers them
    }
  }
  
  // Fuzzy matching to find similar exercises
  const findSimilarExercise = (): Partial<ExerciseData> => {
    // Simple keyword-based matching
    for (const [key, data] of Object.entries(exerciseDatabase)) {
      const keywords = key.split(' ')
      for (const word of keywords) {
        if (normalizedName.includes(word) && word.length > 3) {
          // Explicitly create the return object, converting equipment and instructions
          return {
            name: exerciseName,
            description: data.description,
            primaryMuscles: data.muscleGroups, // Use primaryMuscles
            category: data.category,
            // Convert equipment string to string array (assuming comma separation or single item)
            equipment: data.equipment ? data.equipment.split(',').map(e => e.trim()).filter(e => e) : [],
            // Split instructions string into array
            instructions: data.instructions ? data.instructions.split('\n').filter(line => line.trim() !== '') : [],
            // Add other fields
          }
        }
      }
    }
    
    // Attempt to guess category and muscle groups from common keywords
    const result: Partial<ExerciseData> = {
      name: exerciseName,
      primaryMuscles: [], // Use primaryMuscles
      category: "strength" // Default category
    }
    
    // Analyze name for muscle groups
    const muscleKeywords: Record<string, string[]> = {
      chest: ["chest", "pec", "bench"],
      back: ["back", "lat", "row", "pull"],
      shoulders: ["shoulder", "delt", "press", "raise"],
      biceps: ["bicep", "curl", "arm"],
      triceps: ["tricep", "extension", "pushdown"],
      legs: ["leg", "squat", "lunge", "quad", "hamstring"],
      glutes: ["glute", "butt", "hip"],
      abs: ["ab", "core", "crunch", "plank"]
    }
    
    for (const [muscle, keywords] of Object.entries(muscleKeywords)) {
      for (const keyword of keywords) {
        if (normalizedName.includes(keyword)) {
          // Ensure primaryMuscles exists before pushing
          if (!result.primaryMuscles) {
            result.primaryMuscles = [];
          }
          result.primaryMuscles.push(muscle)
          break
        }
      }
    }
    
    // Determine category
    if (normalizedName.includes("cardio") || 
        normalizedName.includes("run") || 
        normalizedName.includes("jog") || 
        normalizedName.includes("jump")) {
      result.category = "cardio"
    } else if (normalizedName.includes("stretch") || 
              normalizedName.includes("flex") || 
              normalizedName.includes("mobility")) {
      result.category = "flexibility"
    }
    
    return result
  }
  
  return findSimilarExercise()
} 