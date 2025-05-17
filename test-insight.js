// Test script for workout distance comparisons
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-typescript'],
  extensions: ['.js', '.ts'],
});

const { generateDistanceComparisonText } = require('./src/lib/workout-distance-comparisons');

// Test with various distances
console.log('--- Testing distance comparisons ---');
const distances = [
  3.0,  // Should match around 3.0 km
  5.0,  // Around 5.0 km
  9.0,  // Around 9.0 km
  0.5,  // Very short distance
  15.0, // Longer distance
  NaN,  // Should handle error
  'not a number', // Should handle type error
];

distances.forEach(distance => {
  console.log(`\nTesting with distance: ${distance}`);
  try {
    const result = generateDistanceComparisonText(distance);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error caught in test script:', error);
  }
});

console.log('\n--- Test complete ---'); 