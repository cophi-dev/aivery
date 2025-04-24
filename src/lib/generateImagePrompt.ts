interface WeatherData {
    description?: string;
}

interface PromptArgs {
    type?: string;
    distanceKm?: string | null;
    durationFormatted?: string | null;
    elevation?: number | null;
    startTime?: Date | string | null;
    locationName?: string | null; // Likely always null/undefined from our data
    weather?: WeatherData | null;
}

// Helper function to format duration (seconds -> H:MM:SS)
function formatDuration(seconds: number | null | undefined): string | null {
    if (seconds === null || seconds === undefined) return null;
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getTimeOfDayTheme(hour: number | null): string {
    if (hour === null) return "Natural daylight scene."; // Default if hour is unknown
    if (hour >= 5 && hour < 8) return "Early morning light with cool shadows and quiet surroundings.";
    if (hour >= 8 && hour < 17) return "Daylight scene with crisp lighting and vibrant energy.";
    if (hour >= 17 && hour < 21) return "Golden hour glow with long shadows and warm colors.";
    return "Nighttime mood with city lights or dim ambient tones.";
}

function getWeatherStyle(description: string | undefined = ""): string {
    if (description.includes("rain")) return "Wet surfaces reflect light, droplets suspended in motion.";
    if (description.includes("clear")) return "Bright, sharp light with intense contrast and clear skies.";
    if (description.includes("cloud") || description.includes("overcast")) return "Soft diffused light with a calm, moody ambiance.";
    if (description.includes("fog") || description.includes("mist")) return "Misty background with softened edges and low visibility.";
    return "Natural lighting shaped by the current weather.";
}

function getRandomVisual(type: string | undefined): string {
    const visuals: Record<string, string[]> = {
        running: [
            "Closeup on shoes kicking up dust with the ground blurring underneath.",
            "Side view of a runner mid-stride with motion lines and glowing sunlight.",
            "Low-angle sprint scene, focused on muscular motion.",
            "Rear view of a fast-paced runner vanishing into a scenic trail."
        ],
        cycling: [
            "Spinning front wheel closeup, road stripes streaking past.",
            "Focused face of cyclist under a helmet, wind blurring the background.",
            "Side view of rider in aerodynamic posture, speed lines in motion.",
            "Tire cutting through gravel or wet asphalt, showing motion."
        ],
        swimming: [
            "Underwater hand slicing through bubbles, lit by filtered light.",
            "Above-water splash as arm breaks surface mid-stroke.",
            "Dynamic closeup of swimmer's face through water droplets.",
            "Ripples and waves trailing powerful strokes underwater."
        ],
        strength: [
            "Hand gripping textured barbell, chalk particles suspended in air.",
            "Muscles under tension lifting heavy weight, dramatic light.",
            "Barbell mid-lift, sweat and focus emphasized.",
            "Over-the-shoulder shot of lifter preparing, gritty environment."
        ]
    };
    const options = type ? visuals[type.toLowerCase()] : undefined;
    return options?.[Math.floor(Math.random() * options.length)] || "Athlete in motion with visual intensity.";
}

function getMicroTheme(): string {
    const themes = [
        "Capture the rush of a breakthrough workout.",
        "Freeze the feeling of pushing past the limit.",
        "A visual tribute to quiet discipline and movement.",
        "The stillness before the next stride."
    ];
    return themes[Math.floor(Math.random() * themes.length)];
}

// Main exported function
export function generatePrompt({ 
    type, 
    distanceKm, 
    durationFormatted, 
    elevation, 
    startTime, 
    locationName, 
    weather 
}: PromptArgs): string {
    let prompt = "A powerful, cinematic image of a lone athlete in motion.";

    // Activity data
    const details = [];
    if (distanceKm && parseFloat(distanceKm) > 0) details.push(`${distanceKm}km`);
    if (durationFormatted) details.push(durationFormatted);
    if (elevation && elevation > 10) details.push(`${Math.round(elevation)}m elevation gain`);
    if (details.length > 0) prompt += ` This workout included ${details.join(', ')}.`;

    // Visual subject
    prompt += ` ${getRandomVisual(type)}`;

    // Time of day
    const hour = startTime ? new Date(startTime).getHours() : null;
    prompt += ` ${getTimeOfDayTheme(hour)}`;

    // Weather
    if (weather?.description) prompt += ` ${getWeatherStyle(weather.description)}`;

    // Location
    if (locationName) prompt += ` Scene set in or near ${locationName}.`;

    // Micro-narrative
    prompt += ` ${getMicroTheme()}`;

    // Visual style
    prompt += " Shot with a shallow depth of field. Professional cinematic lighting (rim lighting, contrast). Textures are tack sharp at the focal point, surrounded by motion blur and haze to convey intensity. Resembles a high-end fitness campaign photo.";

    console.log("Generated Prompt (Library):", prompt);
    return prompt;
}

// Export formatDuration if it needs to be used externally (like in the API route before calling generatePrompt)
export { formatDuration }; 