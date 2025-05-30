import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import WorkoutModel, { IWorkout } from "@/lib/db/models/workout";
import { ObjectId } from 'mongodb';
import { generateDistanceComparisonText } from "@/lib/workout-distance-comparisons";

export async function GET(
  req: NextRequest,
  { params }: { params: { workoutId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const workoutId = params.workoutId;

    if (!workoutId || !ObjectId.isValid(workoutId)) {
      return NextResponse.json({ error: "Valid Workout ID is required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch the workout
    const workout = await WorkoutModel.findOne({
      _id: new ObjectId(workoutId),
      userId: new ObjectId(userId)
    }).lean<IWorkout>();

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    // Generate comparison text
    let comparisonText = '';
    if (workout.type === 'running' && workout.cardioDetails?.distance) {
      const comparison = generateDistanceComparisonText(workout.cardioDetails.distance);
      if (comparison) {
        comparisonText = comparison;
      }
    }

    // Generate SVG image
    const svg = generateWorkoutShareSVG({
      workout,
      comparisonText,
      userName: session.user.name || 'Fitness Enthusiast'
    });

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error generating share image:', error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}

function generateWorkoutShareSVG({ 
  workout, 
  comparisonText, 
  userName 
}: { 
  workout: IWorkout; 
  comparisonText: string; 
  userName: string; 
}) {
  const gradients = {
    running: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
    cycling: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    strength: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
    swimming: 'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)',
    default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };

  const workoutEmojis = {
    running: '🏃‍♂️',
    cycling: '🚴‍♂️', 
    strength: '💪',
    swimming: '🏊‍♂️',
    default: '💪'
  };

  const gradient = gradients[workout.type as keyof typeof gradients] || gradients.default;
  const emoji = workoutEmojis[workout.type as keyof typeof workoutEmojis] || workoutEmojis.default;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  // Generate metrics display
  const metrics = [];
  if (workout.duration) {
    metrics.push({
      label: 'Duration',
      value: formatDuration(workout.duration),
      icon: '⏱️'
    });
  }
  
  if (workout.cardioDetails?.distance && workout.cardioDetails.distance > 0) {
    metrics.push({
      label: 'Distance', 
      value: `${workout.cardioDetails.distance.toFixed(1)}km`,
      icon: '📍'
    });
  }
  
  if (workout.calculatedVolume && workout.calculatedVolume > 0) {
    const volumeInTons = (workout.calculatedVolume / 1000).toFixed(1);
    metrics.push({
      label: 'Volume',
      value: `${volumeInTons}t`,
      icon: '⚖️'
    });
  }

  const workoutDate = new Date(workout.date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Main Card -->
  <rect x="50" y="50" width="1100" height="530" rx="24" fill="white" opacity="0.95" filter="url(#shadow)"/>
  
  <!-- Header -->
  <g transform="translate(100, 120)">
    <!-- Workout Emoji -->
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="48" fill="#333">${emoji}</text>
    
    <!-- Workout Type -->
    <text x="70" y="0" font-family="Inter, sans-serif" font-size="36" font-weight="bold" fill="#333" text-transform="capitalize">
      ${workout.type} Workout
    </text>
    
    <!-- Date -->
    <text x="70" y="30" font-family="Inter, sans-serif" font-size="18" fill="#666">
      ${workoutDate}
    </text>
  </g>
  
  <!-- Aivery Branding -->
  <g transform="translate(950, 120)">
    <text x="0" y="-10" font-family="Inter, sans-serif" font-size="12" fill="#999" text-anchor="end">
      POWERED BY
    </text>
    <text x="0" y="15" font-family="Inter, sans-serif" font-size="24" font-weight="bold" fill="#667eea" text-anchor="end">
      Aivery
    </text>
  </g>
  
  <!-- Main Insight -->
  ${comparisonText ? `
  <g transform="translate(100, 220)">
    <rect x="0" y="0" width="1000" height="120" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <text x="30" y="40" font-family="Inter, sans-serif" font-size="24" font-weight="500" fill="#334155">
      ${comparisonText.length > 70 ? comparisonText.substring(0, 70) + '...' : comparisonText}
    </text>
  </g>
  ` : ''}
  
  <!-- Metrics -->
  ${metrics.map((metric, index) => `
  <g transform="translate(${150 + (index * 280)}, ${comparisonText ? 400 : 280})">
    <rect x="0" y="0" width="240" height="120" rx="12" fill="#f1f5f9"/>
    <text x="120" y="35" font-family="Arial, sans-serif" font-size="32" text-anchor="middle">${metric.icon}</text>
    <text x="120" y="65" font-family="Inter, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#1e293b">
      ${metric.value}
    </text>
    <text x="120" y="85" font-family="Inter, sans-serif" font-size="14" text-anchor="middle" fill="#64748b" text-transform="uppercase">
      ${metric.label}
    </text>
  </g>
  `).join('')}
  
  <!-- Footer -->
  <g transform="translate(100, 550)">
    <circle cx="0" cy="0" r="16" fill="#e2e8f0"/>
    <text x="30" y="5" font-family="Inter, sans-serif" font-size="16" fill="#64748b">
      ${userName}
    </text>
    <text x="900" y="5" font-family="Inter, sans-serif" font-size="16" fill="#64748b" text-anchor="end">
      #AiveryPowered
    </text>
  </g>
</svg>`;
} 