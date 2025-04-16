"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface InlineSpinnerProps {
  size?: number; // Optional size prop (defaults to 16px / h-4 w-4)
  className?: string; // Allow passing additional classes
}

export function InlineSpinner({ size = 16, className }: InlineSpinnerProps) {
  const pixelSize = size;
  
  return (
    <Image 
      src="/icon.svg"
      alt="Loading..."
      width={pixelSize} 
      height={pixelSize}
      className={cn("animate-spin", className)} // Combine animate-spin with any passed classes
      priority
    />
  );
} 