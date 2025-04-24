'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from "@/components/ui/card";
import { Lightbulb, Search } from "lucide-react";

// --- Keyword & Question Lists (defined locally) ---
const fitnessKeywords = [
  "Plyometrics", "Progressive Overload", "Zone 2 Training", "HIIT", "Tabata",
  "Compound Exercises", "Isolation Exercises", "Supersets", "Drop Sets",
  "Periodization", "Active Recovery", "Foam Rolling", "Dynamic Stretching",
  "Static Stretching", "Mind-Muscle Connection", "Time Under Tension",
  "Macronutrients", "Micronutrients", "Caloric Deficit", "Caloric Surplus",
  "Intermittent Fasting", "Nasal Breathing", "VO2 Max", "Lactate Threshold",
  "Heart Rate Variability (HRV)", "DOMS (Delayed Onset Muscle Soreness)",
  "Functional Training", "Circuit Training", "Bodyweight Training", "Kettlebell Swings"
];

const dataInsightQuestions = [
  "How far did I run last month?",
  "What was my longest run ever?",
  "How much total weight did I lift this week?",
  "What was my average pace last week?",
  "How many workouts did I log in July 2024?",
  "Did I do any cycling last week?",
  "Show my strength workouts from the last 7 days.",
  "What's my best bench press record?",
  "Compare my running distance this month to last month."
];
// -----------------------------------------------

export function SpotlightCards() {
  const [spotlightKeyword, setSpotlightKeyword] = useState<string | null>(null);
  const [dataInsightQuestion, setDataInsightQuestion] = useState<string | null>(null);

  // Select random items on mount
  useEffect(() => {
    if (fitnessKeywords.length > 0) {
      const keywordIndex = Math.floor(Math.random() * fitnessKeywords.length);
      setSpotlightKeyword(fitnessKeywords[keywordIndex]);
    }
    if (dataInsightQuestions.length > 0) {
      const questionIndex = Math.floor(Math.random() * dataInsightQuestions.length);
      setDataInsightQuestion(dataInsightQuestions[questionIndex]);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Concept Spotlight Card */}
      {spotlightKeyword && (
        <Card className="hover:bg-muted/50 transition-colors rounded-xl shadow-sm">
          <Link 
            href={`/chat?keyword=${encodeURIComponent(spotlightKeyword)}`} 
            className="block p-4" 
            title={`Ask about ${spotlightKeyword}`}
          >
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Concept Spotlight</p>
                <p className="text-base font-medium text-foreground">
                  What is {spotlightKeyword}?
                </p>
              </div>
            </div>
          </Link>
        </Card>
      )}

      {/* Data Insights Card */}
      {dataInsightQuestion && (
        <Card className="hover:bg-muted/50 transition-colors rounded-xl shadow-sm">
          <Link 
            href={`/chat?dataQuery=${encodeURIComponent(dataInsightQuestion)}`} 
            className="block p-4"
            title={`Ask: ${dataInsightQuestion}`}
          >
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Explore Your Data</p>
                <p className="text-base font-medium text-foreground">
                  {dataInsightQuestion}
                </p>
              </div>
            </div>
          </Link>
        </Card>
      )}
    </div>
  );
} 