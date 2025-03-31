import { fetchWithAuth } from '@/lib/client-utils';

export interface AiPreferences {
  location: string;
  units: string;
  trainingPreferences: string;
  fitnessGoals: string;
  dietaryPreferences: string;
}

/**
 * Fetches the user's AI personalization preferences
 * @returns The user's AI preferences or default values
 */
export async function getUserAiPreferences(): Promise<AiPreferences> {
  try {
    const response = await fetchWithAuth('/api/user/ai-preferences');
    
    if (!response.ok) {
      console.warn('Failed to fetch AI preferences, using defaults');
      return getDefaultAiPreferences();
    }
    
    const data = await response.json();
    
    return {
      location: data.aiPreferences?.location || '',
      units: data.aiPreferences?.units || 'metric',
      trainingPreferences: data.aiPreferences?.trainingPreferences || '',
      fitnessGoals: data.aiPreferences?.fitnessGoals || '',
      dietaryPreferences: data.aiPreferences?.dietaryPreferences || ''
    };
  } catch (error) {
    console.error('Error fetching AI preferences:', error);
    return getDefaultAiPreferences();
  }
}

/**
 * Returns default AI preferences when user preferences aren't available
 */
export function getDefaultAiPreferences(): AiPreferences {
  return {
    location: '',
    units: 'metric',
    trainingPreferences: '',
    fitnessGoals: '',
    dietaryPreferences: ''
  };
}

/**
 * Generates a formatted context string from AI preferences for use in prompts
 * @param preferences The user's AI preferences
 * @returns A formatted string to include in AI prompts
 */
export function formatAiPreferencesForPrompt(preferences: AiPreferences): string {
  const sections: string[] = [];
  
  if (preferences.location) {
    sections.push(`Location: ${preferences.location}`);
  }
  
  if (preferences.units) {
    sections.push(`Units: ${preferences.units === 'metric' ? 'Metric (kg, km)' : 'Imperial (lb, miles)'}`);
  }
  
  if (preferences.trainingPreferences) {
    sections.push(`Training Preferences: ${preferences.trainingPreferences}`);
  }
  
  if (preferences.fitnessGoals) {
    sections.push(`Fitness Goals: ${preferences.fitnessGoals}`);
  }
  
  if (preferences.dietaryPreferences) {
    sections.push(`Dietary Preferences: ${preferences.dietaryPreferences}`);
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  return `User Preferences:\n${sections.join('\n')}`;
} 