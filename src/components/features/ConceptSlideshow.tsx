'use client';

import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogOverlay } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { InlineSpinner } from '@/components/ui/inline-spinner';

interface Slide {
  type: 'title' | 'definition' | 'subheading' | 'content' | 'question';
  content: string;
}

interface ConceptSlideshowProps {
  keyword: string;
  markdownContent: string;
  isOpen: boolean;
  onClose: () => void;
}

function parseMarkdownToSlides(markdown: string): Slide[] {
  console.log("Parsing markdown:", markdown);
  const slides: Slide[] = [];
  const trimmedMarkdown = markdown.trim();

  if (!trimmedMarkdown) {
    return [{ type: 'content', content: 'No content provided.' }];
  }

  // 1. Extract Title (###)
  const titleMatch = trimmedMarkdown.match(/^###\s+(.*?)(\n|$)/);
  let remainingContent = trimmedMarkdown;
  if (titleMatch && titleMatch[1]) {
    const title = titleMatch[1].trim();
    slides.push({ type: 'title', content: title });
    // Remove the title line and any leading whitespace from the rest
    remainingContent = trimmedMarkdown.substring(titleMatch[0].length).trim();
  } else {
    // If no ### title, maybe use the first line or a default?
    // For now, let's proceed without a dedicated title slide if none found
    console.warn("No H3 title found in markdown.");
  }

  // 2. Split by Subheadings (####)
  // Regex splits the string by #### headers, keeping the header with the content that follows it.
  // It looks for \n#### followed by a space, ensuring it's not part of a code block or similar.
  const sections = remainingContent.split(/\n(?=####\s)/);

  // 3. Process Sections
  sections.forEach((section, index) => {
    const trimmedSection = section.trim();
    if (!trimmedSection) return;

    // Check if this section starts with a subheading
    const subheadingMatch = trimmedSection.match(/^####\s+(.*?)(\n|$)/);
    
    if (subheadingMatch && subheadingMatch[1]) {
      // This section is a subheading block
      const subheadingTitle = subheadingMatch[1].trim();
      // Content is everything after the subheading line
      let subheadingContent = trimmedSection.substring(subheadingMatch[0].length).trim();

      // If this is the *last* section, try to separate the question
      if (index === sections.length - 1) {
        const questionMatch = subheadingContent.match(/\n([*_].*[\*_])\s*$/); // Look for last line starting/ending with * or _
        let finalQuestion = null;

        if (questionMatch && questionMatch[1]) {
          finalQuestion = questionMatch[1].trim();
          // Remove the question from the subheading content
          subheadingContent = subheadingContent.substring(0, questionMatch.index).trim();
          console.log(`Extracted question: "${finalQuestion}"`);
        }
        
        // Add the main content slide for this subheading (if any remains)
        if (subheadingContent) {
            slides.push({ type: 'subheading', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
        }
        // Add the question slide if found
        if (finalQuestion) {
            slides.push({ type: 'question', content: finalQuestion });
        }
         else {
            // If no question extracted, the whole last section might be content or the question itself wasn't formatted as expected.
            // Add the whole last section as the final content/question slide. Render will just use Markdown.
            slides.push({ type: 'question', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
            console.warn("Could not reliably extract final question, treating last block as question.");
        }
      } else {
        // Not the last section, treat as a normal subheading slide
        slides.push({ type: 'subheading', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
      }
    } else {
      // This section doesn't start with ####. 
      // If it's the first section after the title, treat it as definition/intro content.
      if (index === 0) {
          slides.push({ type: 'definition', content: trimmedSection });
      } else {
          // This case shouldn't happen often with the current split logic, but handle as content.
          console.warn("Found content block not following a subheading:", trimmedSection);
          slides.push({ type: 'content', content: trimmedSection });
      }
    }
  });

  console.log("Parsed slides:", slides); // Log output

  // Ensure there's at least one slide
  if (slides.length === 0 && trimmedMarkdown) {
       console.warn("Parsing resulted in zero slides, using full markdown as fallback.");
       return [{ type: 'content', content: trimmedMarkdown }];
  }
  
  return slides;
}

export function ConceptSlideshow({ keyword, markdownContent, isOpen, onClose }: ConceptSlideshowProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50; // Minimum distance for a swipe gesture

  useEffect(() => {
    if (markdownContent && markdownContent !== "Loading...") {
      const parsedSlides = parseMarkdownToSlides(markdownContent);
      setSlides(parsedSlides);
      setCurrentSlideIndex(0); // Reset to first slide when content changes
    } else {
      // Show loading state or handle error state if markdownContent reflects it
      setSlides([{ type: 'content', content: markdownContent }]); 
    }
  }, [markdownContent]);

  const goToNextSlide = () => {
    setCurrentSlideIndex((prevIndex) => Math.min(prevIndex + 1, slides.length - 1));
  };

  const goToPreviousSlide = () => {
    setCurrentSlideIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

  // Swipe handlers
  const handleTouchStart = (e: TouchEvent) => {
    touchEndX.current = null; // Reset end position
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

    if (isLeftSwipe) {
      goToNextSlide();
    } else if (isRightSwipe) {
      goToPreviousSlide();
    }

    // Reset refs
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;
  // Assume the question is the last slide based on parsing logic
  const isQuestionSlide = currentSlide?.type === 'question'; 
  const isLoading = markdownContent === "Loading..."; // Check if loading

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Overlay remains fixed fullscreen behind */}
      <DialogOverlay className="fixed inset-0 z-40 bg-black/80" /> 
      {/* Let the primitive handle fixed positioning; make content fill it */}
      <DialogContent 
        className="z-50 flex flex-col w-full h-full border-0 bg-background p-0 text-foreground rounded-none overflow-hidden shadow-none" 
        // Removed fixed, inset, style width/height
        // Added w-full h-full, removed shadow
      >
        {/* Header remains absolute */}
        <DialogHeader className="p-2 sm:p-3 flex-shrink-0 flex flex-row justify-between items-center absolute top-0 left-0 right-0 bg-transparent z-20">
           <div></div> 
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogHeader>
        
        {/* Main Content Wrapper: Takes remaining space, centers content */}
        <div 
           className="flex-grow flex flex-col items-center justify-center text-center overflow-y-auto pt-16 pb-20 px-6 md:px-12" 
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
         >
          {/* Inner content container for prose and max-width */}
           <div className="w-full max-w-prose">
             {isLoading ? (
               <div className="flex flex-col items-center justify-center">
                   <InlineSpinner size={32} />
               </div>
             ) : currentSlide ? (
              <div className="prose prose-lg dark:prose-invert mx-auto">
                <ReactMarkdown
                   components={{ 
                     h3: ({node, ...props}) => <h3 className="text-2xl font-semibold mb-4" {...props} />,
                     h4: ({node, ...props}) => <h4 className="text-xl font-medium mt-6 mb-3" {...props} />,
                     p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                     li: ({node, ...props}) => <li className="mb-2" {...props} />,
                     em: ({node, ...props}) => <em className="text-lg font-medium" {...props} /> 
                   }}
                 >
                   {currentSlide.content}
                 </ReactMarkdown>
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center">
                   <p className="text-muted-foreground">{markdownContent || "Could not load content."}</p>
               </div>
             )}
           </div>
        </div>

        {/* Footer Navigation - Absolute positioning */}
        <DialogFooter className="p-3 sm:p-4 flex justify-between items-center flex-shrink-0 absolute bottom-0 left-0 right-0 bg-transparent z-20">
          <Button 
            variant="ghost" 
            onClick={goToPreviousSlide} 
            disabled={currentSlideIndex === 0}
            size="sm"
            className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-5 w-5" /> 
             <span className="sr-only">Previous</span>
          </Button>

          {/* Progress Indicator (Optional) */}
          <span className="text-xs font-medium text-muted-foreground">
            {currentSlideIndex + 1} / {slides.length}
          </span>

          {!isQuestionSlide ? (
            <Button 
              variant="ghost" 
              onClick={goToNextSlide} 
              disabled={isLastSlide}
              size="sm"
               className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ArrowRight className="h-5 w-5" />
              <span className="sr-only">Next</span>
            </Button>
          ) : (
            <Link href={`/chat?keyword=${encodeURIComponent(keyword)}&context=viewed_slideshow`} passHref>
              <Button 
                 variant="ghost" 
                 size="sm" 
                  className="rounded-full h-9 w-9 p-0 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                 onClick={onClose} 
               >
                 <MessageSquare className="h-5 w-5" />
                 <span className="sr-only">Discuss in Chat</span>
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 