import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { format } from 'date-fns';

// Define workout type
interface WorkoutType {
  _id: string;
  type?: string;
  name?: string;
  date: string;
  duration?: number;
}

// Define user type
interface UserType {
  _id: string;
  name: string;
  nickname?: string;
  email: string;
  workouts?: WorkoutType[];
  activityLevel?: string;
  gender?: string;
  age?: number;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Basic quotes cache for when we can't use AI
const fallbackQuotes = [
  "Your only limit is the one you set yourself.",
  "The difference between try and triumph is a little umph.",
  "Strength doesn't come from what you can do, it comes from overcoming what you thought you couldn't.",
  "The body achieves what the mind believes.",
  "Don't wish for it, work for it.",
  "Fitness is not about being better than someone else, it's about being better than you used to be.",
  "No matter how slow you go, you're still lapping everyone on the couch.",
  "Your health is an investment, not an expense.",
  "The harder you work, the luckier you get.",
  "Small progress is still progress.",
  "The only bad workout is the one that didn't happen.",
  "Fall in love with taking care of your body.",
  "Success starts with self-discipline.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "When you feel like quitting, remember why you started.",
];

// Get time of day greeting
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// Get day of week
function getDayOfWeek() {
  return format(new Date(), 'EEEE');
}

// Check if it's weekend
function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

// Get weather data if location is provided
async function getWeather(lat?: string, lon?: string) {
  if (!lat || !lon || !process.env.WEATHER_API_KEY) return null;
  
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      temp: data.main.temp,
      condition: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      isRainy: data.weather[0].main.toLowerCase().includes('rain'),
      isSnowy: data.weather[0].main.toLowerCase().includes('snow'),
      isClear: data.weather[0].main.toLowerCase().includes('clear'),
      isCloudy: data.weather[0].main.toLowerCase().includes('cloud'),
      isHot: data.main.temp > 25,
      isCold: data.main.temp < 10
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

// Use OpenAI to generate a personalized quote
async function generateAIQuote(context: {
  nickname?: string;
  workoutCount?: number;
  recentWorkoutTypes?: string[];
  activityLevel?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  isWeekend?: boolean;
  weather?: any;
}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }
    
    // Create a prompt with user context
    let prompt = "Generate a short, inspiring and unique fitness quote (max 100 characters) that's creative, motivational and personalized. Be creative and varied in your tone and style.\n\n";
    
    prompt += "User context:\n";
    if (context.nickname) prompt += `- User's nickname: ${context.nickname}\n`;
    if (context.workoutCount !== undefined) prompt += `- Has logged ${context.workoutCount} workouts\n`;
    if (context.recentWorkoutTypes?.length) prompt += `- Recent workout types: ${context.recentWorkoutTypes.join(', ')}\n`;
    if (context.activityLevel) prompt += `- Activity level: ${context.activityLevel}\n`;
    if (context.timeOfDay) prompt += `- Time of day: ${context.timeOfDay}\n`;
    if (context.dayOfWeek) prompt += `- Day of week: ${context.dayOfWeek}\n`;
    if (context.isWeekend !== undefined) prompt += `- It's ${context.isWeekend ? 'weekend' : 'weekday'}\n`;
    
    if (context.weather) {
      prompt += `- Weather: ${context.weather.condition} (${context.weather.temp}°C)\n`;
      if (context.weather.isRainy) prompt += `- It's raining\n`;
      if (context.weather.isSnowy) prompt += `- It's snowing\n`;
      if (context.weather.isHot) prompt += `- It's hot outside\n`;
      if (context.weather.isCold) prompt += `- It's cold outside\n`;
    }
    
    prompt += "\nThe quote should be motivational, related to fitness/health, and personalized to this context. No quotation marks, no attribution, just the quote text. Be varied and creative in your style - don't be repetitive with previous quotes.";
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative motivational fitness coach creating personalized, inspiring quotes for users. Create a variety of different quote styles, sometimes using metaphors, sometimes direct motivation, sometimes questions, etc. Be creative and unexpected."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.9,
    });

    const generatedQuote = response.choices[0].message.content?.trim();
    
    if (generatedQuote && generatedQuote.length <= 150) {
      // Remove any quotation marks from the beginning and end of the quote
      return generatedQuote.replace(/^["'](.*)["']$/, '$1');
    }
    
    return null;
  } catch (error) {
    console.error('Error generating quote with OpenAI:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // Add cache control headers to prevent caching
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, max-age=0');
    headers.append('Pragma', 'no-cache');
    
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    
    // Add a random parameter to ensure different quotes on reload
    const timestamp = Date.now();
    
    // Try to get weather data if coordinates provided
    const weather = lat && lon ? await getWeather(lat, lon) : null;
    
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      // No session, return a generic quote
      const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
      return NextResponse.json({ quote: randomQuote, timestamp }, { headers });
    }

    // Connect to DB and get user data
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('nickname workouts activityLevel age gender')
      .lean() as unknown as UserType;

    if (!user) {
      const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
      return NextResponse.json({ quote: randomQuote, timestamp }, { headers });
    }

    // Get user's workout data
    const workouts = user.workouts || [];
    const hasWorkouts = workouts.length > 0;
    const recentWorkouts = hasWorkouts ? workouts.slice(-3) : [];
    const recentWorkoutTypes = recentWorkouts.map((w: WorkoutType) => w.type || 'workout').filter(Boolean);

    // Get contextual info
    const timeOfDay = getTimeBasedGreeting();
    const dayOfWeek = getDayOfWeek();
    const isWeekendDay = isWeekend();
    const nickname = user.nickname || "";
    
    // Generate a personalized AI quote with all the context
    const aiQuote = await generateAIQuote({
      nickname,
      workoutCount: workouts.length,
      recentWorkoutTypes,
      activityLevel: user.activityLevel,
      timeOfDay,
      dayOfWeek,
      isWeekend: isWeekendDay,
      weather
    });
    
    // If AI quote generation succeeded, return it
    if (aiQuote) {
      // Add timestamp suffix in dev mode to confirm fresh quotes
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const suffix = process.env.NODE_ENV === 'development' ? ` [${hours}:${minutes}]` : '';
      
      return NextResponse.json({ 
        quote: aiQuote + suffix, 
        timestamp 
      }, { headers });
    }
    
    // If AI quote generation failed, fall back to our rule-based system
    let personalizedQuote = '';
    
    // Determine what type of quote to generate
    let quoteTypes = ['motivation', 'reminder', 'workout-specific', 'time-based', 'progress'];
    
    // Add weather type if we have weather data
    if (weather) {
      quoteTypes.push('weather');
    }
    
    const quoteType = quoteTypes[Math.floor(Math.random() * quoteTypes.length)];
    
    switch (quoteType) {
      case 'motivation':
        if (hasWorkouts) {
          personalizedQuote = `${workouts.length} workouts logged - consistency builds champions!`;
        } else {
          personalizedQuote = "Today is a perfect day to start your fitness journey.";
        }
        break;
        
      case 'reminder':
        if (user.activityLevel === 'sedentary') {
          personalizedQuote = "Remember to take breaks and move throughout your day.";
        } else if (user.activityLevel === 'very-active' || user.activityLevel === 'extra-active') {
          personalizedQuote = "Don't forget to prioritize recovery - it's when your body gets stronger.";
        } else {
          personalizedQuote = "Balance is key - push when you need to, rest when you deserve to.";
        }
        break;
        
      case 'workout-specific':
        if (hasWorkouts) {
          const workoutTypes = recentWorkoutTypes;
          if (workoutTypes.includes('strength')) {
            personalizedQuote = "Strong body, strong mind. Keep lifting!";
          } else if (workoutTypes.includes('cardio')) {
            personalizedQuote = "Every heartbeat makes you stronger. Keep running!";
          } else if (workoutTypes.includes('yoga') || workoutTypes.includes('flexibility')) {
            personalizedQuote = "Flexibility in body creates flexibility in mind.";
          } else {
            personalizedQuote = "Every workout brings you closer to your best self.";
          }
        } else {
          personalizedQuote = "The best workout is the one that you'll actually do.";
        }
        break;
        
      case 'time-based':
        if (isWeekendDay) {
          personalizedQuote = `Happy ${dayOfWeek}! Perfect time for an energizing workout.`;
        } else {
          personalizedQuote = `Good ${timeOfDay}! Make time for yourself today, even if it's just 10 minutes.`;
        }
        break;
        
      case 'weather':
        if (weather) {
          if (weather.isRainy) {
            personalizedQuote = "Rainy day? Perfect for an indoor strength session.";
          } else if (weather.isSnowy) {
            personalizedQuote = "Snow outside? Try a hot yoga session to warm up.";
          } else if (weather.isClear && weather.isHot) {
            personalizedQuote = "Beautiful day! How about an early morning or evening workout to beat the heat?";
          } else if (weather.isClear) {
            personalizedQuote = "Perfect weather for an outdoor workout. Seize the day!";
          } else if (weather.isCold) {
            personalizedQuote = "Cold outside? Remember that you warm up quickly once you get moving!";
          } else {
            personalizedQuote = `${weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1)} weather shouldn't stop you - adapt and conquer!`;
          }
        } else {
          personalizedQuote = "No matter the weather, there's always a way to move your body.";
        }
        break;
        
      case 'progress':
        if (hasWorkouts && workouts.length > 5) {
          personalizedQuote = "Look how far you've come! Celebrate your progress and keep going.";
        } else if (hasWorkouts) {
          personalizedQuote = "Building the habit is the hardest part - and you're doing it!";
        } else {
          personalizedQuote = "The journey of a thousand miles begins with a single step.";
        }
        break;
        
      default:
        personalizedQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    }
    
    return NextResponse.json({ quote: personalizedQuote });
    
  } catch (error) {
    console.error('Error generating personalized quote:', error);
    // Fallback to a random quote if something goes wrong
    const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    return NextResponse.json({ quote: randomQuote });
  }
} 