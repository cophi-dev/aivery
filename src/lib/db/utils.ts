/**
 * Utility functions for handling MongoDB documents
 */

/**
 * Recursively checks if an object has any buffer properties that need special handling
 */
function hasBufferProperty(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  
  // Check if the object itself is a buffer or has a buffer property
  if (Buffer.isBuffer(obj) || (obj.buffer && Buffer.isBuffer(obj.buffer))) {
    return true;
  }
  
  // Check nested properties
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object') {
      if (hasBufferProperty(obj[key])) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Sanitize workout data specifically by removing all nested _id fields
 * This tackles the specific issue with buffer objects in cardioDetails
 */
export function sanitizeWorkoutData(workouts: any[]): any[] {
  if (!Array.isArray(workouts)) {
    return workouts;
  }
  
  return workouts.map(workout => {
    if (!workout || typeof workout !== 'object') {
      return workout;
    }
    
    // Create a new workout object
    const sanitized = { ...workout };
    
    // Ensure the primary _id is a string
    if (sanitized._id && typeof sanitized._id === 'object') {
      sanitized._id = String(sanitized._id);
    }
    
    // Ensure userId is a string
    if (sanitized.userId && typeof sanitized.userId === 'object') {
      sanitized.userId = String(sanitized.userId);
    }
    
    // Remove all _id fields from cardioDetails structure
    if (sanitized.cardioDetails && typeof sanitized.cardioDetails === 'object') {
      // Process cardioDetails
      const cardioDetails = { ...sanitized.cardioDetails };
      
      // Remove _id from cardioDetails
      delete cardioDetails._id;
      
      // Process heartRate data
      if (cardioDetails.heartRate && typeof cardioDetails.heartRate === 'object') {
        const heartRate = { ...cardioDetails.heartRate };
        delete heartRate._id;
        
        // Process zones
        if (heartRate.zones && typeof heartRate.zones === 'object') {
          const zones = { ...heartRate.zones };
          delete zones._id;
          heartRate.zones = zones;
        }
        
        cardioDetails.heartRate = heartRate;
      }
      
      // Process power data
      if (cardioDetails.power && typeof cardioDetails.power === 'object') {
        const power = { ...cardioDetails.power };
        delete power._id;
        cardioDetails.power = power;
      }
      
      // Process laps - remove all _id fields
      if (Array.isArray(cardioDetails.laps)) {
        cardioDetails.laps = cardioDetails.laps.map((lap: any) => {
          if (lap && typeof lap === 'object') {
            const cleanLap = { ...lap };
            delete cleanLap._id;
            return cleanLap;
          }
          return lap;
        });
      }
      
      sanitized.cardioDetails = cardioDetails;
    }
    
    // Clean exercises array
    if (Array.isArray(sanitized.exercises)) {
      sanitized.exercises = sanitized.exercises.map((exercise: any) => {
        if (exercise && typeof exercise === 'object') {
          const cleanExercise = { ...exercise };
          
          // Convert _id to string
          if (cleanExercise._id && typeof cleanExercise._id === 'object') {
            cleanExercise._id = String(cleanExercise._id);
          }
          
          // Clean sets
          if (Array.isArray(cleanExercise.sets)) {
            cleanExercise.sets = cleanExercise.sets.map((set: any) => {
              if (set && typeof set === 'object') {
                const cleanSet = { ...set };
                delete cleanSet._id;
                return cleanSet;
              }
              return set;
            });
          }
          
          return cleanExercise;
        }
        return exercise;
      });
    }
    
    return sanitized;
  });
}

/**
 * Converts MongoDB documents to plain JavaScript objects
 * to prevent serialization errors when sending to client components
 */
export function serializeMongoDoc(doc: any): any {
  return toClientData(doc);
}

/**
 * Safely converts any MongoDB data to plain JSON objects before sending to client
 * This ensures all objects have proper serialization
 */
export function toClientData<T>(data: any): T {
  try {
    // Special case for workout data arrays which have deeply nested buffer issues
    if (Array.isArray(data) && data.length > 0 && data[0]?.type) {
      // This looks like workout data
      const sanitizedWorkouts = sanitizeWorkoutData(data);
      return JSON.parse(JSON.stringify(sanitizedWorkouts)) as T;
    }
    
    // Handle null/undefined
    if (data === null || data === undefined) {
      return data as T;
    }
    
    // The most reliable approach: JSON stringify then parse
    // This forces all objects to be plain JS objects
    // with a special replacer to handle problematic patterns
    const stringified = JSON.stringify(data, (key, value) => {
      // Convert any object with a buffer property (like ObjectId's) to a string
      if (value && typeof value === 'object') {
        // Direct Buffer conversion
        if (Buffer.isBuffer(value)) {
          return value.toString('hex');
        }
        
        // ObjectId or objects with buffer property conversion
        if (value.buffer || value._bsontype === 'ObjectID') {
          return value.toString();
        }
        
        // Handle the specific error pattern: {buffer: ...} objects
        if (key === '_id' && value.buffer) {
          return String(value.buffer);
        }
      }
      
      return value;
    });
    
    return JSON.parse(stringified) as T;
  } catch (error) {
    console.error("Error serializing MongoDB data:", error);
    
    // Last resort fallback - strip all problematic objects
    // This approach is more drastic but will ensure no serialization errors
    try {
      // Helper to deep clone while removing problem fields
      const sanitize = (obj: any): any => {
        // Handle primitives and null
        if (obj === null || typeof obj !== 'object') {
          return obj;
        }
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => sanitize(item));
        }
        
        // Handle plain objects
        const result: any = {};
        
        // Special case for MongoDB ObjectId with buffer
        if (obj._bsontype === 'ObjectID' || (obj.id && obj.buffer)) {
          return String(obj);
        }
        
        // Process each property
        for (const key in obj) {
          // Skip MongoDB internal fields
          if (key === '__v' || key === '$init' || key.startsWith('$')) {
            continue;
          }
          
          // Handle _id specially
          if (key === '_id') {
            if (obj[key] === null || obj[key] === undefined) {
              result[key] = null;
            } else if (typeof obj[key] === 'object') {
              // Convert any object-type _id to string
              result[key] = String(obj[key]);
            } else {
              result[key] = obj[key];
            }
            continue;
          }
          
          // Handle nested objects
          if (obj[key] !== null && typeof obj[key] === 'object') {
            result[key] = sanitize(obj[key]); 
          } else {
            result[key] = obj[key];
          }
        }
        
        return result;
      };
      
      const safeData = sanitize(data);
      return JSON.parse(JSON.stringify(safeData)) as T;
    } catch (fallbackError) {
      console.error("Fallback serialization failed:", fallbackError);
      // Return a minimal object as absolute last resort
      return {} as T;
    }
  }
}

/**
 * Utility to handle MongoDB lean() documents safely
 */
export function processLeanDoc(doc: any): any {
  if (!doc) return null;
  return toClientData(doc);
} 