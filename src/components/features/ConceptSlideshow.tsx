'use client';

import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogOverlay } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, X, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { SplashCursor } from "@/components/ui/splash-cursor";

interface Slide {
  type: 'definition' | 'subheading' | 'content' | 'question';
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

  let remainingContent = trimmedMarkdown;

  const sections = remainingContent.split(/\n(?=####\s)/);

  sections.forEach((section, index) => {
    const trimmedSection = section.trim();
    if (!trimmedSection) return;

    const subheadingMatch = trimmedSection.match(/^####\s+(.*?)(\n|$)/);
    
    if (subheadingMatch && subheadingMatch[1]) {
      const subheadingTitle = subheadingMatch[1].trim();
      let subheadingContent = trimmedSection.substring(subheadingMatch[0].length).trim();

      if (index === sections.length - 1) {
        const questionMatch = subheadingContent.match(/\n([*_].*[\*_])\s*$/);
        let finalQuestion = null;
        if (questionMatch && questionMatch[1]) {
          finalQuestion = questionMatch[1].trim();
          subheadingContent = subheadingContent.substring(0, questionMatch.index).trim();
          console.log(`Extracted question: "${finalQuestion}"`);
        }
        if (subheadingContent) {
            slides.push({ type: 'subheading', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
        }
        if (finalQuestion) {
            slides.push({ type: 'question', content: finalQuestion });
        } else {
            slides.push({ type: 'question', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
            console.warn("Could not reliably extract final question, treating last block as question.");
        }
      } else {
        slides.push({ type: 'subheading', content: `#### ${subheadingTitle}\n\n${subheadingContent}` });
      }
    } else {
      slides.push({ type: index === 0 ? 'definition' : 'content', content: trimmedSection });
    }
  });

  console.log("Parsed slides (no title slide expected):", slides);

  if (slides.length === 0 && trimmedMarkdown) {
       console.warn("Parsing resulted in zero slides, using full markdown as fallback.");
       return [{ type: 'content', content: trimmedMarkdown }];
  }
  
  return slides;
}

function stripMarkdown(markdown: string): string {
    if (!markdown) return "";
    let text = markdown.replace(/^#+\s+.*\n*/, ''); 
    text = text.replace(/(\*\*|__|\*|_|`)/g, ''); 
    text = text.replace(/!?\[[^\]]*\]\([^)]+\)/g, ''); 
    text = text.replace(/```[\s\S]*?```/g, ''); 
    text = text.replace(/^(\s*(\*|-|\d+\.)\s+)+/gm, ''); 
    text = text.replace(/^>\s+/gm, ''); 
    text = text.replace(/^(---|___|\*\*\*)\s*$/gm, ''); 
    text = text.replace(/\s*\n\s*/g, '\n').replace(/\s{2,}/g, ' ').trim();
    return text;
}

export function ConceptSlideshow({ keyword, markdownContent, isOpen, onClose }: ConceptSlideshowProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;
  const [animatedText, setAnimatedText] = useState<string>("");

  useEffect(() => {
    if (markdownContent && markdownContent !== "Loading...") {
      const parsedSlides = parseMarkdownToSlides(markdownContent);
      setSlides(parsedSlides);
      setCurrentSlideIndex(0);
      setAnimatedText("");
    } else {
      setSlides([{ type: 'content', content: markdownContent }]); 
      setAnimatedText("");
    }
  }, [markdownContent]);

  const goToNextSlide = () => {
    setCurrentSlideIndex((prevIndex) => Math.min(prevIndex + 1, slides.length - 1));
  };

  const goToPreviousSlide = () => {
    setCurrentSlideIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

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

    if (isLeftSwipe) {
      goToNextSlide();
    } else if (isRightSwipe) {
      goToPreviousSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const isQuestionSlide = currentSlide?.type === 'question'; 
  const isLoading = markdownContent === "Loading...";

  useEffect(() => {
    if (currentSlide?.content && !isLoading) {
      const plainText = stripMarkdown(currentSlide.content);
      setAnimatedText(plainText);
      console.log(`[ConceptSlideshow] Set animated text for slide ${currentSlideIndex}: "${plainText.substring(0,50)}..."`);
    } else {
      setAnimatedText("");
    }
  }, [currentSlideIndex, currentSlide, isLoading]);

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
        <DialogHeader className="p-2 sm:p-3 flex-shrink-0 flex flex-row justify-end items-center absolute top-0 left-0 right-0 bg-transparent z-20">
        </DialogHeader>
        
        <div 
          className="flex-grow flex flex-col justify-center items-center p-6 pt-12 pb-16 overflow-y-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          key={currentSlideIndex}
        >
          {isLoading ? (
            <div className="text-center space-y-4">
              <SplashCursor />
              <p className="text-sm text-muted-foreground animate-pulse">
                  Aivery is fetching insights on {keyword}...
              </p>
            </div>
          ) : !currentSlide ? (
            <p className="text-destructive">Error: Could not load slide content.</p>
          ) : animatedText ? (
            <div className="max-w-prose px-4">
                 <TextGenerateEffect 
                     words={animatedText} 
                 /> 
            </div>
          ) : (
            <p className="text-muted-foreground">Preparing content...</p>
          )}
        </div>

        <DialogFooter className="p-3 sm:p-4 flex justify-between items-center flex-shrink-0 absolute bottom-0 left-0 right-0 bg-transparent z-20">
          <Button 
            variant="ghost" 
            onClick={goToPreviousSlide} 
            disabled={currentSlideIndex === 0 || isLoading}
            size="sm"
            className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-5 w-5" /> 
             <span className="sr-only">Previous</span>
          </Button>

          {!isLoading && (
              <span className="text-xs font-medium text-muted-foreground">
                {currentSlideIndex + 1} / {slides.length}
              </span>
          )}

          {!isQuestionSlide ? (
            <Button 
              variant="ghost" 
              onClick={goToNextSlide} 
              disabled={isLastSlide || isLoading}
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
                 disabled={isLoading}
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