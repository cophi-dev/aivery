#!/usr/bin/env ts-node
// Use ES Module import syntax
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Adjust dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Adjust model import for ES Modules
import Exercise from '../src/lib/db/models/exercise'; // Direct default import

// --- Configuration ---
const EXERCISES_DATA_PATH = path.resolve(process.cwd(), './temp/exercises.json/exercises');
const REPO_URL = 'https://github.com/wrkout/exercises.json.git';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable not set.');
    process.exit(1);
}

// Define the structure of the source JSON files (interface can remain)
interface SourceExerciseData {
    id: string;
    name: string;
    aliases?: string[];
    level?: 'beginner' | 'intermediate' | 'expert';
    category: string;
    equipment?: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    instructions?: string[];
    details?: string;
    youtube?: string;
    images?: string[];
}

// --- Main Import Function ---
async function importExercises(repoUrl: string) {
    console.log('Starting exercise import script...');

    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined. This should not happen if initial check passed.');
        }
        console.log('Connecting directly to database...');
        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
        });
        console.log('Database connected directly via Mongoose.');

        // 2. Check if the data directory exists
        try {
            await fs.access(EXERCISES_DATA_PATH);
            console.log(`Found exercise data directory: ${EXERCISES_DATA_PATH}`);
        } catch (error) {
            console.error(`\n❌ Error: Exercise data directory not found at: ${EXERCISES_DATA_PATH}`);
            console.error(`Please clone the repository '${repoUrl}'`); // Use repoUrl
            console.error(`e.g., run: git clone ${repoUrl} ../temp/exercises.json`); // Use repoUrl
            console.error(`Then ensure the EXERCISES_DATA_PATH variable in this script is correct.`);
            return; // Exit if directory doesn't exist
        }

        // 3. Read Exercise Directories
        const exerciseDirs = await fs.readdir(EXERCISES_DATA_PATH);
        console.log(`Found ${exerciseDirs.length} potential exercise entries.`);

        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const errors: { file: string; error: string }[] = [];

        // 4. Process Each Exercise
        for (const dirName of exerciseDirs) {
            const exerciseDirPath = path.join(EXERCISES_DATA_PATH, dirName);
            const stats = await fs.stat(exerciseDirPath);

            if (!stats.isDirectory()) {
                continue;
            }

            const jsonFilePath = path.join(exerciseDirPath, 'exercise.json');

            try {
                await fs.access(jsonFilePath);
                const jsonData = await fs.readFile(jsonFilePath, 'utf-8');
                const sourceData = JSON.parse(jsonData) as SourceExerciseData;

                const mappedData: Partial<any> = { // Using any here for simplicity
                    name: sourceData.name,
                    aliases: sourceData.aliases || [],
                    description: sourceData.details,
                    primaryMuscles: sourceData.primaryMuscles || [],
                    secondaryMuscles: sourceData.secondaryMuscles || [],
                    category: ["strength", "cardio", "flexibility"].includes(sourceData.category.toLowerCase())
                        ? sourceData.category.toLowerCase()
                        : 'other',
                    level: sourceData.level && ["beginner", "intermediate", "expert"].includes(sourceData.level) // Corrected level check
                        ? sourceData.level
                        : undefined,
                    equipment: typeof sourceData.equipment === 'string' ? [sourceData.equipment] : [],
                    instructions: sourceData.instructions || [],
                    videos: sourceData.youtube ? [`https://www.youtube.com/watch?v=${sourceData.youtube}`] : [],
                    // Assuming Exercise model handles images; adjust if needed
                };

                if (!mappedData.name || !mappedData.primaryMuscles?.length || !mappedData.instructions?.length) {
                     console.warn(`⚠️ Skipping ${dirName}: Missing required fields (name, primaryMuscles, instructions).`);
                     skippedCount++;
                     continue;
                }

                const result = await Exercise.findOneAndUpdate(
                    { name: mappedData.name },
                    { $set: mappedData },
                    {
                        new: true,
                        upsert: true,
                        runValidators: true,
                    }
                );
                
                // Simple check for new vs updated based on timestamps
                if (result.createdAt && result.updatedAt && Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) {
                    importedCount++;
                    console.log(` -> Imported: ${result.name}`);
                } else {
                    updatedCount++;
                    console.log(` -> Updated: ${result.name}`);
                }

            } catch (err: any) {
                 if (err.code === 'ENOENT') {
                      console.warn(`⚠️ Skipping ${dirName}: exercise.json not found.`);
                      skippedCount++;
                 } else {
                    console.error(`❌ Error processing ${dirName}: ${err.message}`);
                    errors.push({ file: dirName, error: err.message });
                    skippedCount++;
                }
            }
        }

        // 6. Summary
        console.log("\n--- Import Summary ---");
        console.log(`✅ Successfully Imported: ${importedCount}`);
        console.log(`🔄 Successfully Updated: ${updatedCount}`);
        console.log(`⏭️ Skipped: ${skippedCount}`);
        if (errors.length > 0) {
            console.warn(`\n⚠️ Errors encountered: ${errors.length}`);
        }
        console.log("----------------------");

    } catch (error: any) {
        if (error.message.includes('connect ECONNREFUSED') || error.message.includes('queryTxt ETIMEOUT')) {
             console.error(`\n❌ MongoDB Connection Error: ${error.message}. Check your MONGODB_URI and network access.`);
        } else {
             console.error(`\n❌ An unexpected error occurred during the import process:`, error);
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
             await mongoose.disconnect();
             console.log('Mongoose connection disconnected.');
        }
        console.log('Exercise import script finished.');
    }
}

// --- Execute Script (ES Module style) ---
// Immediately invoke the async function
(async () => {
    try {
        await importExercises(REPO_URL);
        // Exit cleanly if successful
        if (mongoose.connection.readyState !== 1) { // Ensure disconnected before exiting cleanly
             process.exit(0);
        } 
    } catch (err) {
        console.error("Script execution failed globally:", err);
        // Ensure disconnection on error
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect().catch(discErr => console.error("Disconnection error:", discErr));
        }
        process.exit(1); // Exit with error code
    }
})(); // IIFE 