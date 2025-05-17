// Estimate weight for common bodyweight exercises
// Accepts exerciseName and optional userWeight
export const estimateBodyweightForExercise = (exerciseName: string, userWeight?: number | null): number => {
  const baseWeight = (userWeight && userWeight > 0) ? userWeight : 75;
  const bodyweightExercises: Record<string, number> = {
    "pull-up": 1.0,
    "chin-up": 1.0,
    "dip": 0.95,
    "muscle-up": 1.0,
    "inverted row": 0.8,
    "bodyweight squat": 0.9,
    "air squat": 0.9,
    "pistol squat": 0.9,
    "lunge": 0.6,
    "push-up": 0.65,
    "diamond push-up": 0.7,
    "plank": 0.5,
    "sit-up": 0.3,
    "crunch": 0.2,
    "leg raise": 0.3,
    "mountain climber": 0.4,
    "burpee": 0.7,
    "jumping jack": 0.1
  };
  const normalizedName = exerciseName.toLowerCase().trim();
  for (const [exerciseKey, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exerciseKey)) {
      return Math.round(baseWeight * percentage);
    }
  }
  return 0;
}; 