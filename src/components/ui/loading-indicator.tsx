"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';

// Define loading messages
const loadingMessages = [
  "Just a sec...",
  "Crunching the numbers...",
  "Loading your stats...",
  "Fetching your workout...",
  "Almost there...",
  "Warming up...",
  "Lacing up...",
  "Getting ready...",
];

// Define props if needed in the future (e.g., size, custom messages)
interface LoadingIndicatorProps {
  // Add props here if customization is needed
}

export function LoadingIndicator({ /* props */ }: LoadingIndicatorProps) {
  const [loadingText, setLoadingText] = useState(loadingMessages[0]);

  // Select random loading message on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    setLoadingText(loadingMessages[randomIndex]);

    // Optional: Could add an interval here to cycle through messages
    // const intervalId = setInterval(() => {
    //   setLoadingText(prevText => {
    //     let nextIndex;
    //     const currentIndex = loadingMessages.indexOf(prevText);
    //     do {
    //       nextIndex = Math.floor(Math.random() * loadingMessages.length);
    //     } while (nextIndex === currentIndex); // Ensure it's a different message
    //     return loadingMessages[nextIndex];
    //   });
    // }, 3000); // Change every 3 seconds

    // return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    // Main container ensures centering and background (can be overridden by parent)
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-primary text-primary-dark-bg">
      <Image
        src="/icon.svg"
        alt="Loading..."
        width={64} // Default size (h-16 w-16)
        height={64}
        className="animate-spin mb-4" // Add margin-bottom
        priority // Prioritize loading the logo image
      />
      {/* Add loading text below logo */}
      <span className="text-lg text-secondary-dark-bg">{loadingText}</span>
    </div>
  );
} 