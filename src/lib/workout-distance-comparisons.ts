// import { findClosestNumber } from './utils'; // Assuming a utility function exists or we can create one

interface DistanceComparison {
  distance_km: number;
  city: string;
  from: string;
  to: string;
  description: string; // Keep original description for reference if needed
}

// Embed the landmark data directly
const landmarkDistances: DistanceComparison[] = [
  {
    "distance_km": 3.2,
    "city": "New York",
    "from": "Central Park",
    "to": "Times Square",
    "description": "Roughly the distance from Central Park to Times Square in New York."
  },
  {
    "distance_km": 9.1,
    "city": "New York",
    "from": "Central Park",
    "to": "Brooklyn Bridge",
    "description": "Roughly the distance from Central Park to Brooklyn Bridge in New York."
  },
  {
    "distance_km": 4.3,
    "city": "New York",
    "from": "Central Park",
    "to": "Empire State Building",
    "description": "Roughly the distance from Central Park to Empire State Building in New York."
  },
  {
    "distance_km": 9.4,
    "city": "New York",
    "from": "Central Park",
    "to": "Wall Street",
    "description": "Roughly the distance from Central Park to Wall Street in New York."
  },
  {
    "distance_km": 5.9,
    "city": "New York",
    "from": "Times Square",
    "to": "Brooklyn Bridge",
    "description": "Roughly the distance from Times Square to Brooklyn Bridge in New York."
  },
  {
    "distance_km": 1.1,
    "city": "New York",
    "from": "Times Square",
    "to": "Empire State Building",
    "description": "Roughly the distance from Times Square to Empire State Building in New York."
  },
  {
    "distance_km": 6.2,
    "city": "New York",
    "from": "Times Square",
    "to": "Wall Street",
    "description": "Roughly the distance from Times Square to Wall Street in New York."
  },
  {
    "distance_km": 4.8,
    "city": "New York",
    "from": "Brooklyn Bridge",
    "to": "Empire State Building",
    "description": "Roughly the distance from Brooklyn Bridge to Empire State Building in New York."
  },
  {
    "distance_km": 1.0,
    "city": "New York",
    "from": "Brooklyn Bridge",
    "to": "Wall Street",
    "description": "Roughly the distance from Brooklyn Bridge to Wall Street in New York."
  },
  {
    "distance_km": 5.1,
    "city": "New York",
    "from": "Empire State Building",
    "to": "Wall Street",
    "description": "Roughly the distance from Empire State Building to Wall Street in New York."
  },
  {
    "distance_km": 3.5,
    "city": "London",
    "from": "Big Ben",
    "to": "Tower Bridge",
    "description": "Roughly the distance from Big Ben to Tower Bridge in London."
  },
  {
    "distance_km": 1.2,
    "city": "London",
    "from": "Big Ben",
    "to": "Buckingham Palace",
    "description": "Roughly the distance from Big Ben to Buckingham Palace in London."
  },
  {
    "distance_km": 3.1,
    "city": "London",
    "from": "Tower Bridge",
    "to": "London Eye",
    "description": "Roughly the distance from Tower Bridge to London Eye in London."
  },
  {
    "distance_km": 4.6,
    "city": "London",
    "from": "Tower Bridge",
    "to": "Buckingham Palace",
    "description": "Roughly the distance from Tower Bridge to Buckingham Palace in London."
  },
  {
    "distance_km": 1.6,
    "city": "London",
    "from": "London Eye",
    "to": "Buckingham Palace",
    "description": "Roughly the distance from London Eye to Buckingham Palace in London."
  },
  {
    "distance_km": 4.1,
    "city": "Tokyo",
    "from": "Shibuya Crossing",
    "to": "Tokyo Tower",
    "description": "Roughly the distance from Shibuya Crossing to Tokyo Tower in Tokyo."
  },
  {
    "distance_km": 10.7,
    "city": "Tokyo",
    "from": "Shibuya Crossing",
    "to": "Sensoji Temple",
    "description": "Roughly the distance from Shibuya Crossing to Sensoji Temple in Tokyo."
  },
  {
    "distance_km": 5.5,
    "city": "Tokyo",
    "from": "Shibuya Crossing",
    "to": "Imperial Palace",
    "description": "Roughly the distance from Shibuya Crossing to Imperial Palace in Tokyo."
  },
  {
    "distance_km": 7.8,
    "city": "Tokyo",
    "from": "Tokyo Tower",
    "to": "Sensoji Temple",
    "description": "Roughly the distance from Tokyo Tower to Sensoji Temple in Tokyo."
  },
  {
    "distance_km": 3.0,
    "city": "Tokyo",
    "from": "Tokyo Tower",
    "to": "Imperial Palace",
    "description": "Roughly the distance from Tokyo Tower to Imperial Palace in Tokyo."
  },
  {
    "distance_km": 5.2,
    "city": "Tokyo",
    "from": "Sensoji Temple",
    "to": "Imperial Palace",
    "description": "Roughly the distance from Sensoji Temple to Imperial Palace in Tokyo."
  }
];

// Helper function to find the comparison with the closest distance
function findClosestComparison(targetDistance: number): DistanceComparison | null {
  if (landmarkDistances.length === 0) {
    return null;
  }

  let closestMatch: DistanceComparison = landmarkDistances[0];
  let minDiff = Math.abs(targetDistance - closestMatch.distance_km);

  for (let i = 1; i < landmarkDistances.length; i++) {
    const currentDiff = Math.abs(targetDistance - landmarkDistances[i].distance_km);
    if (currentDiff < minDiff) {
      minDiff = currentDiff;
      closestMatch = landmarkDistances[i];
    }
  }

  // Optional: Add a threshold to only return if the match is "close enough"
  // const MAX_ALLOWED_DIFFERENCE_KM = 2; // Example threshold
  // if (minDiff > MAX_ALLOWED_DIFFERENCE_KM) {
  //   return null;
  // }


  return closestMatch;
}

/**
 * Generates a fun, descriptive text comparing the target workout distance
 * to a real-world distance between landmarks.
 *
 * @param targetDistanceKm The target workout distance in kilometers.
 * @returns A descriptive string or null if no suitable comparison is found.
 */
export function generateDistanceComparisonText(targetDistanceKm: number): string | null {
  const closest = findClosestComparison(targetDistanceKm);

  if (!closest) {
    return null; // Or return a default message
  }

  const distanceDifference = targetDistanceKm - closest.distance_km;
  let comparisonText = `That's roughly the distance from ${closest.from} to ${closest.to} in ${closest.city} (${closest.distance_km} km)!`;

  // Add context based on the difference
  if (Math.abs(distanceDifference) < 0.2) { // Very close match
    comparisonText = `Nice! That's almost exactly the distance from ${closest.from} to ${closest.to} in ${closest.city} (${closest.distance_km} km). Imagine you're running right there!`;
  } else if (distanceDifference > 0) { // Target is longer
    comparisonText = `You went about the distance from ${closest.from} to ${closest.to} in ${closest.city} (${closest.distance_km} km)... plus an extra ${distanceDifference.toFixed(1)} km! Keep pushing!`;
  } else { // Target is shorter
    comparisonText = `You covered about the same distance as going from ${closest.from} to ${closest.to} in ${closest.city} (${closest.distance_km} km). Great pace!`;
    // Or adjust to show how much *of* the landmark distance was covered:
    // const percentage = (targetDistanceKm / closest.distance_km * 100).toFixed(0);
    // comparisonText = `You covered about ${percentage}% of the distance from ${closest.from} to ${closest.to} in ${closest.city} (${closest.distance_km} km total). Keep it up!`;
  }

  // Add more fun variations (can be expanded)
  const funIntros = [
    "Picture this:",
    "Get this:",
    "Fun fact:",
    "Imagine:",
  ];
  const randomIntro = funIntros[Math.floor(Math.random() * funIntros.length)];

  return `${randomIntro} ${comparisonText}`;
}

// Example Usage (optional, for testing)
// console.log(generateDistanceComparisonText(3.0));
// console.log(generateDistanceComparisonText(5.0));
// console.log(generateDistanceComparisonText(10.0));
// console.log(generateDistanceComparisonText(0.5)); 