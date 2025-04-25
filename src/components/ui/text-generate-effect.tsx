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
          const displayChar = char === ' ' ? '\\u00A0' : char;
          return (
            <motion.span
              key={char + idx}
              className="dark:text-white text-black opacity-0"
            >
              {displayChar}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("font-normal text-left", className)}>
      <div className="dark:text-white text-black text-lg sm:text-xl md:text-2xl leading-snug tracking-wide">
        {renderWords()}
      </div>
    </div>
  );
};
