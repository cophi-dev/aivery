export default [
  {
    name: 'Bodyweight Row',
    description: 'A horizontal pulling exercise performed with bodyweight, where intensity is determined by the angle of the body relative to the ground.',
    muscleGroups: ['back', 'biceps', 'core'],
    category: 'strength',
    equipment: ['bar', 'rings', 'TRX', 'bodyweight'],
    instructions: [
      'Set up a bar, rings, or TRX at the desired height.',
      'Position your body under the bar with your heels on the ground and your body straight.',
      'Select the angle/intensity for the set.',
      'Pull your chest to the bar, keeping your body rigid.',
      'Lower yourself back down with control.'
    ],
    tags: ['trackMaxReps', 'intensitySelection', 'bodyweight'],
    intensityOptions: [
      { label: 'Horizontal (0°)', factor: 0.7 },
      { label: '30°', factor: 0.6 },
      { label: '45°', factor: 0.5 },
      { label: '60°', factor: 0.4 },
      { label: '75°', factor: 0.3 },
      { label: 'Vertical (90°)', factor: 0.2 }
    ]
  }
]; 