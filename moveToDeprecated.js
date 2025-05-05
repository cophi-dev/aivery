#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const DEPRECATED_DIR = '__deprecated__';

// List of files to move to the deprecated folder
// Replace with your actual list of files from the "Safe to Delete" category
const filesToDeprecate = [
  // Scripts category
  'scripts/update-user.js',
  'scripts/update-manifest.js',
  'scripts/test-grok.js',
  'scripts/test-endpoints.js',
  'scripts/fix-buffer-errors.js',
  'scripts/tag-exercises.ts',
  'scripts/populate-exercise-details.ts',
  'scripts/import-exercises.ts',
  'scripts/clear_workouts.ts',
  'scripts/clear_workout_exercises.ts',
  'scripts/clear_exercises.ts',
  'scripts/clear_all_demo_data.ts',
  'scripts/backfill-workout-volumes.ts',
  'scripts/backfill-user-summaries.ts',
  'scripts/backfill-exercise-prs.ts',
  'scripts/backfill-exercise-flags.ts',
  'src/scripts/repair-workout-exercises.ts',
  'src/scripts/fix-strava-distances.ts',
  
  // Temporary or legacy files
  'temp/exercises.json/scripts/psql-builder.ts',
  'temp/exercises.json/scripts/json-builder.ts',
  'temp/exercises.json/scripts/__tests__/psql-builder.test.ts',
  'temp/exercises.json/scripts/__tests__/json-builder.test.ts',
  'temp/exercises.json/jest.config.js',
  'temp/exercises.json/types/measure.d.ts',
  'temp/exercises.json/types/exercise.d.ts',
  
  // Unused service files
  'src/lib/services/workoutService.ts',
  'src/lib/db/workouts-db.ts',
  
  // UI Components that appear unused
  'src/components/recent-workouts.tsx',
  'src/components/progress-chart.tsx',
  'src/components/delete-workout-button.tsx',
  'src/components/ui/steps.tsx',
  'src/components/ui/double-metric-card.tsx',
  'src/components/ui/alert-dialog.tsx',
  'src/components/dashboard/WeeklyOverview.tsx',
  'src/components/exercises/exercise-list.tsx',
  'src/app/settings/strava/fix-button.tsx'
];

/**
 * Creates a directory if it doesn't exist
 * @param {string} dir - Directory path to create
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    // Create directory recursively
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

/**
 * Moves a file to the deprecated directory
 * @param {string} sourceFile - Source file path
 */
function moveToDeprecated(sourceFile) {
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.log(`Skipping (not found): ${sourceFile}`);
    return;
  }

  // Create target path preserving the directory structure
  const targetFile = path.join(DEPRECATED_DIR, sourceFile);
  const targetDir = path.dirname(targetFile);

  // Ensure target directory exists
  ensureDirectoryExists(targetDir);

  // Move file (using copy + delete since fs.rename might not work across drives)
  try {
    // Copy the file content
    fs.copyFileSync(sourceFile, targetFile);
    
    // Delete the original file
    fs.unlinkSync(sourceFile);
    
    console.log(`Moved: ${sourceFile} → ${targetFile}`);
  } catch (err) {
    console.error(`Failed to move ${sourceFile}: ${err.message}`);
  }
}

/**
 * Main function
 */
function main() {
  console.log(`Starting to move files to ${DEPRECATED_DIR}/...`);
  
  // Ensure the deprecated directory exists
  ensureDirectoryExists(DEPRECATED_DIR);
  
  // Process each file
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  filesToDeprecate.forEach(file => {
    try {
      moveToDeprecated(file);
      successCount++;
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
      errorCount++;
    }
  });
  
  // Print summary
  console.log('\nSummary:');
  console.log(`- Total files processed: ${filesToDeprecate.length}`);
  console.log(`- Successfully moved: ${successCount}`);
  console.log(`- Skipped (not found): ${skipCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log('\nCompleted moving files to the deprecated directory.');
}

// Run the script
main(); 