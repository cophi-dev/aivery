#!/usr/bin/env ts-node
// Use CommonJS require syntax
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const Exercise = require('../src/lib/db/models/exercise').default; 

// --- Configuration ---
const MONGODB_URI = process.env.MONGODB_URI;
const BODYWEIGHT_TAG = 'bodyweight';
const COMPOUND_TAG = 'compound';

// Define major muscle groups (adjust as needed)
// Using broader categories for simplicity in heuristics
const MAJOR_MUSCLE_GROUPS: { [key: string]: string[] } = {
    LEGS: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
    CHEST: ['pectorals'],
    BACK: ['lats', 'middle back', 'lower back', 'traps', 'spine'], // Note: source data uses 'middle back', 'lower back'
    SHOULDERS: ['delts'],
    // Arms are often involved secondarily in compound, so not explicitly checked for compound trigger
};

if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable not set.');
    process.exit(1);
}

// Helper function to check if an exercise uses multiple major groups
function isCompound(muscleGroups?: string[], secondaryMuscles?: string[]): boolean {
    const primary = muscleGroups || [];
    const allMuscles = [...(primary || []), ...(secondaryMuscles || [])].map(m => m.toLowerCase());
    const workedMajorGroups = new Set<string>();

    allMuscles.forEach(muscle => {
        for (const groupName in MAJOR_MUSCLE_GROUPS) {
            if (MAJOR_MUSCLE_GROUPS[groupName].some(majorMuscle => muscle.includes(majorMuscle))) {
                workedMajorGroups.add(groupName);
                break; // Found group for this muscle, move to next muscle
            }
        }
    });

    // Consider compound if 2 or more major groups are worked
    return workedMajorGroups.size >= 2;
}

// Helper function to check if bodyweight exercise
function isBodyweight(equipment: string[] | undefined | null): boolean {
    if (!equipment || equipment.length === 0) {
        return true;
    }
    return equipment.some(e => e.toLowerCase().includes('body weight'));
}

// --- Main Tagging Function ---
async function tagExercises() {
    console.log('Starting exercise tagging script...');
    try {
        console.log('Connecting directly to database...');
        await mongoose.connect(MONGODB_URI, { bufferCommands: false });
        console.log('Database connected.');

        console.log('Fetching exercises from database...');
        // Fetch full documents to use save() method for middleware/validation
        const exercises = await Exercise.find({}); 
        console.log(`Found ${exercises.length} exercises.`);

        if (exercises.length === 0) {
            console.log('No exercises found to tag.');
            return;
        }

        let updatedCount = 0;
        let alreadyTaggedCount = 0;
        const totalExercises = exercises.length;

        console.log('Applying tagging heuristics...');

        for (let i = 0; i < totalExercises; i++) {
            const exercise = exercises[i];
            const progress = `(${(i + 1)}/${totalExercises})`;
            let needsUpdate = false;
            const tagsToAdd = new Set<string>();

            // Rule 1: Bodyweight
            if (isBodyweight(exercise.equipment)) {
                if (!exercise.tags?.includes(BODYWEIGHT_TAG)) {
                    tagsToAdd.add(BODYWEIGHT_TAG);
                    needsUpdate = true;
                }
            }

            // Rule 2: Compound
            if (isCompound(exercise.muscleGroups, exercise.secondaryMuscles)) {
                if (!exercise.tags?.includes(COMPOUND_TAG)) {
                     tagsToAdd.add(COMPOUND_TAG);
                     needsUpdate = true;
                 }
            }

            // Update if necessary
            if (needsUpdate) {
                const newTags = Array.from(tagsToAdd);
                console.log(`${progress} Updating ${exercise.name} - Adding tags: [${newTags.join(', ')}]`);
                // Ensure tags array exists before pushing
                if (!exercise.tags) {
                     exercise.tags = [];
                }
                // Add new tags without duplicates
                newTags.forEach(tag => {
                    if (!exercise.tags.includes(tag)) {
                         exercise.tags.push(tag);
                    }
                });
                
                try {
                    await exercise.save();
                    updatedCount++;
                } catch (saveError: any) {
                     console.error(`  ❗️ Error saving tags for ${exercise.name}: ${saveError.message}`);
                }
            } else {
                // Check if already correctly tagged by previous runs (optional logging)
                 const shouldHaveBw = isBodyweight(exercise.equipment);
                 const shouldHaveComp = isCompound(exercise.muscleGroups, exercise.secondaryMuscles);
                 if ((shouldHaveBw && exercise.tags?.includes(BODYWEIGHT_TAG)) || (shouldHaveComp && exercise.tags?.includes(COMPOUND_TAG))) {
                     alreadyTaggedCount++;
                     // console.log(`${progress} Skipping ${exercise.name} - Already appropriately tagged.`);
                 }
            }
        }

        console.log('\n--- Tagging Summary ---');
        console.log(`✅ Exercises Updated with New Tags: ${updatedCount}`);
        console.log(`⏭️ Exercises Already Tagged/No Changes: ${totalExercises - updatedCount}`);
        // console.log(`  (Already appropriately tagged: ${alreadyTaggedCount})`); // More detailed count
        console.log('-----------------------\n');

    } catch (error: any) {
        console.error(`\n❌ An unexpected error occurred during the tagging process:`, error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('Mongoose connection disconnected.');
        }
        console.log('Exercise tagging script finished.');
    }
}

// --- Execute Script ---
tagExercises().catch(err => {
    console.error("Script execution failed globally:", err);
    mongoose.disconnect().finally(() => process.exit(1));
}); 