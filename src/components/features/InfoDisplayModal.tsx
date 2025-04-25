'use client';

import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogOverlay } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, X, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { SplashCursor } from "@/components/ui/splash-cursor";
import { cn } from '@/lib/utils';

interface InfoDisplayModalProps {
  title: string;
  contextIdentifier: string;
  content: string | null;
  isLoading: boolean;
  error?: string | null; // Optional error message
  isOpen: boolean;
  onClose: () => void;
  loadingText?: string; // Optional custom loading text
}

// --- Data structure for parsed sections ---
interface ReviewSection {
  title: string;
  content: string; // This will be the raw content for the section
  plainTextContent: string; // Stripped version for TextGenerateEffect
}

// --- Helper Functions ---

// Basic text stripping (removes markdown for TextGenerateEffect)
const stripBasicFormatting = (text: string | null): string => {
  if (!text) return "";
  let plainText = text.replace(/^#+\s+.*/gm, ''); 
  plainText = plainText.replace(/(\*\*|__|\*|_|`)/g, ''); 
  // Keep newlines for structure within the effect if desired, or replace with space
  // plainText = plainText.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(); 
  plainText = plainText.replace(/\s{2,}/g, ' ').trim(); // Trim excess whitespace but keep intentional newlines
  return plainText;
};

// Parses the AI response into sections and feedback prompt
const parseReviewToSections = (rawContent: string | null): { sections: ReviewSection[], feedbackPrompt: string | null } => {
  if (!rawContent) {
    return { sections: [], feedbackPrompt: null };
  }

  const sections: ReviewSection[] = [];
  let feedbackPrompt: string | null = null;

  // 1. Extract Feedback Prompt (***...***)
  let remainingContent = rawContent;
  const feedbackMatch = rawContent.match(/\n\*\*\*(.*)\*\*\*\s*$/); // Look for ***...*** at the very end
  if (feedbackMatch && feedbackMatch[1]) {
    feedbackPrompt = feedbackMatch[1].trim();
    // Remove the prompt from the content to be sectioned
    remainingContent = rawContent.substring(0, feedbackMatch.index).trim();
    console.log("[InfoDisplayModal] Extracted feedback prompt:", feedbackPrompt);
  } else {
     console.warn("[InfoDisplayModal] Could not find feedback prompt (***...***) at the end.");
  }

  // 2. Split into sections by #### headers
  // Regex splits by the header, keeping the delimiter (header) with the subsequent content.
  // It looks for newline followed by #### and a space.
  const parts = remainingContent.split(/\n(?=####\s)/);

  parts.forEach((part) => {
    const trimmedPart = part.trim();
    if (!trimmedPart) return;

    const headerMatch = trimmedPart.match(/^####\s+(.+?)(\n|$)/);
    if (headerMatch && headerMatch[1]) {
      const title = headerMatch[1].trim();
      // Content is everything *after* the header line
      const content = trimmedPart.substring(headerMatch[0].length).trim();
      sections.push({
        title,
        content,
        plainTextContent: stripBasicFormatting(content) // Pre-strip for animation
      });
    } else {
      // Handle content that might appear before the first #### header (e.g., if AI adds an intro)
      // Or if splitting failed unexpectedly.
      if (sections.length === 0) {
          console.log("[InfoDisplayModal] Found content before first #### header, adding as 'Introduction'.")
          sections.push({ title: "Introduction", content: trimmedPart, plainTextContent: stripBasicFormatting(trimmedPart) });
      } else {
           console.warn("[InfoDisplayModal] Found unexpected content block:", trimmedPart);
           // Append to the previous section's content or add as a generic section?
           // For simplicity, let's add as a generic section for now.
           sections.push({ title: "Additional Info", content: trimmedPart, plainTextContent: stripBasicFormatting(trimmedPart) });
      }
    }
  });

  console.log("[InfoDisplayModal] Parsed sections:", sections);
  return { sections, feedbackPrompt };
};

export function InfoDisplayModal({ 
  title, 
  contextIdentifier,
  content, // Raw content from API
  isLoading, 
  error,
  isOpen, 
  onClose, 
  loadingText = "Aivery is fetching insights..."
}: InfoDisplayModalProps) {

  const [parsedSections, setParsedSections] = useState<ReviewSection[]>([]);
  const [feedbackPrompt, setFeedbackPrompt] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0); // State for current slide
  // Refs for swipe gestures (optional but good to keep)
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50; 

  // Effect to parse content when it changes
  useEffect(() => {
    if (!isLoading && content) {
      console.log("[InfoDisplayModal] Content received, parsing...");
      const { sections, feedbackPrompt: prompt } = parseReviewToSections(content);
      setParsedSections(sections);
      setFeedbackPrompt(prompt);
      setCurrentSectionIndex(0); // Reset to first section when content loads
    } else {
      // Reset when loading or no content
      setParsedSections([]);
      setFeedbackPrompt(null);
      setCurrentSectionIndex(0);
    }
  }, [content, isLoading]);

  // --- Navigation Functions ---
  const goToNextSection = () => {
    setCurrentSectionIndex((prevIndex) => Math.min(prevIndex + 1, parsedSections.length - 1));
  };

  const goToPreviousSection = () => {
    setCurrentSectionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

  // --- Swipe Handlers ---
  const handleTouchStart = (e: TouchEvent) => {
    touchEndX.current = null; 
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && currentSectionIndex < parsedSections.length - 1) {
      goToNextSection();
    } else if (isRightSwipe) {
      goToPreviousSection();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // --- Current Section Data ---
  const currentSection = parsedSections[currentSectionIndex];
  const isLastSection = currentSectionIndex === parsedSections.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="fixed inset-0 z-40 bg-black/80" /> 
      <DialogContent 
        className="z-50 flex flex-col border-0 bg-background p-0 text-foreground rounded-none overflow-hidden shadow-none sm:rounded-none" 
        style={{
          position: 'fixed',
          inset: '0px',
          width: '100vw', 
          height: '100dvh',
          maxWidth: 'none',
          maxHeight: 'none',
          transform: 'none',
        }}
      >
        {/* Header with only Title and Close button */}
        <DialogHeader className="p-4 flex-shrink-0 flex flex-row justify-between items-center absolute top-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-b border-border/50 z-20">
           <h2 className="text-lg font-semibold truncate pr-4">{title || 'Information'}</h2>
           {/* Use Shadcn default close button */}
           {/* Ensure Dialog primitive adds its own X */}
        </DialogHeader>
        
        {/* Main Content Area */}
        <div 
          className="flex-grow flex flex-col justify-center items-center p-6 pt-20 pb-20 overflow-y-auto" // Adjust bottom padding for footer
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          // Key ensures TextGenerateEffect re-runs on index change
          key={isLoading ? 'loading' : `section-${currentSectionIndex}`}
        >
          {isLoading ? (
            // Center loading vertically
            <div className="flex flex-col justify-center items-center h-full">
              <div className="text-center space-y-4">
                <SplashCursor />
                <p className="text-sm text-muted-foreground animate-pulse">
                    {loadingText}
                </p>
              </div>
            </div>
          ) : error ? ( 
             // Center error vertically
             <div className="flex flex-col justify-center items-center h-full">
                <p className="text-destructive text-center max-w-prose">Error: {error}</p>
             </div>
          ) : currentSection ? ( 
            <div className="w-full max-w-prose space-y-4 text-center"> {/* Center section content */}
               {/* Display section title */}
               <h4 className="text-base font-semibold text-primary dark:text-primary/90">{currentSection.title}</h4>
               {/* Display section content */}
               <div className="prose prose-sm dark:prose-invert max-w-none">
                 <TextGenerateEffect 
                     words={currentSection.plainTextContent} 
                     className="text-sm"
                 /> 
               </div>
               {/* Display feedback prompt ONLY on the last slide */}
               {isLastSection && feedbackPrompt && (
                  <p className="pt-4 text-base font-medium italic text-muted-foreground">
                     {feedbackPrompt}
                  </p>
               )}
            </div>
          ) : (
            // Fallback if not loading, no error, but no sections parsed
            <div className="flex flex-col justify-center items-center h-full">
               <p className="text-muted-foreground">Could not parse information.</p>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <DialogFooter className="p-3 sm:p-4 flex justify-between items-center flex-shrink-0 absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/50 z-10">
          <Button 
            variant="ghost" 
            onClick={goToPreviousSection} 
            disabled={currentSectionIndex === 0 || isLoading}
            size="sm"
            className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-5 w-5" /> 
             <span className="sr-only">Previous</span>
          </Button>

          {/* Progress Indicator */}
          {!isLoading && parsedSections.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {currentSectionIndex + 1} / {parsedSections.length}
              </span>
          )}

          {/* Conditional Next / Chat Button */}
          {!isLoading && parsedSections.length > 0 && (
            isLastSection ? (
              <Link 
                href={`/chat?contextType=performance_review&contextIdentifier=${encodeURIComponent(contextIdentifier)}&feedbackPrompt=${encodeURIComponent(feedbackPrompt || '')}`}
                passHref
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full h-9 w-9 p-0 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                  onClick={onClose} // Close modal when clicking chat link
                >
                  <MessageSquare className="h-5 w-5" />
                  <span className="sr-only">Discuss in Chat</span>
                </Button>
              </Link>
            ) : (
              <Button 
                variant="ghost" 
                onClick={goToNextSection} 
                disabled={isLastSection /* Should not happen here, but safe */}
                size="sm"
                className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
              >
                <ArrowRight className="h-5 w-5" />
                <span className="sr-only">Next</span>
              </Button>
            )
          )}
           {/* Show empty space if loading or no sections to maintain layout */}
           {(isLoading || parsedSections.length === 0) && <div className="w-9 h-9"></div>}
        </DialogFooter>
       
      </DialogContent>
    </Dialog>
  );
} 