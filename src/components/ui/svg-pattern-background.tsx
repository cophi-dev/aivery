"use client";

import React from 'react';

interface SvgPatternBackgroundProps {
  className?: string;
  iconSize?: number;
  spacing?: number;
  opacity?: number;
  color?: string;
}

export function SvgPatternBackground({
  className = "",
  iconSize = 40,
  spacing = 80,
  opacity = 0.05,
  color = "currentColor"
}: SvgPatternBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div 
        className="absolute inset-0" 
        style={{
          opacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 512 512'%3E%3Ccircle cx='256' cy='256' r='200' fill='${encodeURIComponent(color)}'/%3E%3Ccircle cx='200' cy='200' r='20' fill='${encodeURIComponent(color)}'/%3E%3Ccircle cx='312' cy='200' r='20' fill='${encodeURIComponent(color)}'/%3E%3Cpath d='M200 300 Q 256 320 312 300' stroke='${encodeURIComponent(color)}' stroke-width='10' fill='none'/%3E%3C/svg%3E")`,
          backgroundSize: `${iconSize}px ${iconSize}px`,
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
          transform: 'rotate(0deg)',
          maskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
        }}
      />
    </div>
  );
}

export function LogoWavyBackground({
  className = "",
  opacity = 0.03,
  color = "currentColor"
}: {
  className?: string;
  opacity?: number;
  color?: string;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity }}
      >
        <svg 
          className="w-full h-full" 
          viewBox="0 0 1440 320" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <g fill={color}>
            {/* First row of logos */}
            {Array.from({ length: 15 }).map((_, i) => (
              <g key={`row1-${i}`} transform={`translate(${i * 100}, 40)`}>
                <circle cx="50" cy="50" r="20" />
                <circle cx="35" cy="40" r="4" />
                <circle cx="65" cy="40" r="4" />
                <path d="M35 60 Q 50 65 65 60" strokeWidth="2" stroke={color} fill="none" />
              </g>
            ))}
            
            {/* Second row of logos - offset */}
            {Array.from({ length: 15 }).map((_, i) => (
              <g key={`row2-${i}`} transform={`translate(${50 + i * 100}, 120)`}>
                <circle cx="50" cy="50" r="20" />
                <circle cx="35" cy="40" r="4" />
                <circle cx="65" cy="40" r="4" />
                <path d="M35 60 Q 50 65 65 60" strokeWidth="2" stroke={color} fill="none" />
              </g>
            ))}
            
            {/* Third row of logos */}
            {Array.from({ length: 15 }).map((_, i) => (
              <g key={`row3-${i}`} transform={`translate(${i * 100}, 200)`}>
                <circle cx="50" cy="50" r="20" />
                <circle cx="35" cy="40" r="4" />
                <circle cx="65" cy="40" r="4" />
                <path d="M35 60 Q 50 65 65 60" strokeWidth="2" stroke={color} fill="none" />
              </g>
            ))}
            
            {/* Fourth row of logos - offset */}
            {Array.from({ length: 15 }).map((_, i) => (
              <g key={`row4-${i}`} transform={`translate(${50 + i * 100}, 280)`}>
                <circle cx="50" cy="50" r="20" />
                <circle cx="35" cy="40" r="4" />
                <circle cx="65" cy="40" r="4" />
                <path d="M35 60 Q 50 65 65 60" strokeWidth="2" stroke={color} fill="none" />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
} 