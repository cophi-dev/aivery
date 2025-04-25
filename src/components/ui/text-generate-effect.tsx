"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  duration = 0.5,
  staggerDelay = 0.015,
}: {
  words: string;
  className?: string;
  duration?: number;
  staggerDelay?: number;
}) => {
  const [scope, animate] = useAnimate();
  let charactersArray = words.split("");
  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
      },
      {
        duration: duration,
        delay: stagger(staggerDelay),
      }
    );
  }, [scope.current, words, duration, staggerDelay]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {charactersArray.map((char, idx) => {
          if (char === '\n') {
            return <br key={`br-${idx}`} />;
          }
          const displayChar = char === ' ' ? ' ' : char;
          return (
            <motion.span
              key={char + idx}
              className="opacity-0"
            >
              {displayChar}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("font-bold", className)}>
      <div className="text-foreground text-2xl md:text-4xl lg:text-5xl leading-normal">
        {renderWords()}
      </div>
    </div>
  );
};
