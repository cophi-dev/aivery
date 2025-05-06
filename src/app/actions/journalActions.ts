'use server'

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateWorkout, getWorkoutById } from '@/lib/db/repositories/workoutRepository';

interface ActionResult {
    success: boolean;
    error?: string;
}

/**
 * Server action to save a journal entry to the notes field of specified workouts.
 * Appends the entry to existing notes.
 * 
 * @param workoutIds - An array of workout IDs to update.
 * @param journalEntry - The text of the journal entry.
 * @returns ActionResult object indicating success or failure.
 */
export async function saveDailyJournalEntry(workoutIds: string[], journalEntry: string): Promise<ActionResult> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        console.error("[Action saveDailyJournalEntry] Unauthorized attempt.");
        return { success: false, error: 'Unauthorized' };
    }

    if (!workoutIds || workoutIds.length === 0) {
        console.error("[Action saveDailyJournalEntry] No workout IDs provided.");
        return { success: false, error: 'No workout IDs specified.' };
    }

    if (!journalEntry || !journalEntry.trim()) {
        console.error("[Action saveDailyJournalEntry] Journal entry is empty.");
        return { success: false, error: 'Journal entry cannot be empty.' };
    }

    const userId = session.user.id;
    const entryTimestamp = new Date().toLocaleString(); // Add a timestamp to the entry
    const formattedEntry = `\n\n--- Journal Entry [${entryTimestamp}] ---\n${journalEntry.trim()}`; // Format the entry

    console.log(`[Action saveDailyJournalEntry] User ${userId} saving entry to workouts: ${workoutIds.join(', ')}`);

    try {
        let updatedCount = 0;
        for (const workoutId of workoutIds) {
            // Fetch the workout to verify ownership and get existing notes
            const workout = await getWorkoutById(workoutId);

            if (!workout) {
                console.warn(`[Action saveDailyJournalEntry] Workout ${workoutId} not found. Skipping.`);
                continue;
            }

            // IMPORTANT: Verify the workout belongs to the current user
            if (workout.userId !== userId) {
                console.error(`[Action saveDailyJournalEntry] User ${userId} attempted to update workout ${workoutId} owned by ${workout.userId}. Forbidden.`);
                // Optionally return error immediately, or just skip
                return { success: false, error: 'Attempted to update workout belonging to another user.' }; 
            }

            // Append the new entry to existing notes
            const existingNotes = workout.notes || '';
            const newNotes = existingNotes + formattedEntry;

            // Update the workout
            const updateResult = await updateWorkout(workoutId, { notes: newNotes });
            if (updateResult) {
                console.log(`[Action saveDailyJournalEntry] Successfully updated notes for workout ${workoutId}`);
                updatedCount++;
            } else {
                console.warn(`[Action saveDailyJournalEntry] Failed to update workout ${workoutId}. Update operation returned null.`);
                // Decide if this is a critical failure or just a warning
            }
        }

        if (updatedCount > 0) {
            // Revalidate the dashboard path to reflect changes (if notes are displayed there)
            // Or revalidate specific workout paths if applicable
            revalidatePath('/dashboard');
            console.log(`[Action saveDailyJournalEntry] Successfully updated ${updatedCount} workouts.`);
            return { success: true };
        } else {
            // This could happen if workout IDs were invalid or updates failed
             console.warn(`[Action saveDailyJournalEntry] No workouts were updated.`);
            return { success: false, error: 'Could not find or update any of the specified workouts.' };
        }

    } catch (error) {
        console.error('[Action saveDailyJournalEntry] Error saving journal entry:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred.' };
    }
} 