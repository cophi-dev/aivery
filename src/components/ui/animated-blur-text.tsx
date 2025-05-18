import { cn } from "@/lib/utils";
import { motion, Transition, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letter";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  pulseAfterLoad?: boolean;
};

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
): Record<string, Array<string | number>> => {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

const BlurText: React.FC<BlurTextProps> = ({
  text = "",
  delay = 200,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  pulseAfterLoad = true,
}) => {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref.current as Element);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -50 }
        : { filter: "blur(10px)", opacity: 0, y: 50 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: "blur(5px)",
        opacity: 0.5,
        y: direction === "top" ? 5 : -5,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  );

  // Calculate total animation time to know when all elements are done
  const totalAnimationTime = totalDuration + (elements.length - 1) * (delay / 1000);

  // Set animation completed after the last element finishes
  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => {
        setAnimationCompleted(true);
        if (onAnimationComplete) onAnimationComplete();
      }, totalAnimationTime * 1000 + 100); // Add a small buffer
      return () => clearTimeout(timer);
    }
  }, [inView, totalAnimationTime, onAnimationComplete]);

  // Define the pulsating effect - removing any y/position changes to prevent layout shift
  const pulseAnimation = {
    scale: [1, 1.01, 1],
    opacity: [1, 0.92, 1],
    filter: ["blur(0px)", "blur(0.7px)", "blur(0px)"],
    // Explicitly set y to 0 to maintain consistent position
    y: 0,
    transition: {
      duration: 2,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse" as const,
    },
  };

  return (
    <p ref={ref} className={`blur-text ${className} flex flex-wrap h-auto min-h-[1.5em]`} style={{ position: 'relative' }}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
        };
        (spanTransition as any).ease = easing;

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={
              inView
                ? animationCompleted && pulseAfterLoad
                  ? pulseAnimation
                  : animateKeyframes
                : fromSnapshot
            }
            transition={!animationCompleted ? spanTransition : undefined}
            style={{
              display: "inline-block",
              willChange: "transform, filter, opacity",
              position: "relative", // Prevent layout shifts
              transformOrigin: "center", // Scale from center
            }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
};

export { BlurText } 