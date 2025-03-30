"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface StepsProps extends React.HTMLAttributes<HTMLDivElement> {
  current: number
  total: number
  onStepClick?: (step: number) => void
}

export function Steps({ 
  current, 
  total, 
  onStepClick, 
  className, 
  ...props 
}: StepsProps) {
  return (
    <div 
      className={cn("flex items-center w-full justify-between mt-4 mb-6", className)} 
      {...props}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current
        const isCompleted = index < current
        const isClickable = onStepClick && (isCompleted || index === current + 1)
        
        return (
          <React.Fragment key={index}>
            <div 
              className={cn(
                "relative flex items-center justify-center rounded-full transition-all", 
                isActive ? "bg-primary text-primary-foreground" : 
                  isCompleted ? "bg-primary/80 text-primary-foreground" : "bg-muted text-muted-foreground",
                isClickable ? "cursor-pointer hover:ring-2 hover:ring-ring/50" : "",
                "h-8 w-8 text-sm font-medium"
              )}
              onClick={() => isClickable && onStepClick(index)}
            >
              {isCompleted ? (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                    clipRule="evenodd" 
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            
            {index < total - 1 && (
              <div 
                className={cn(
                  "flex-1 h-0.5 mx-2",
                  index < current ? "bg-primary/80" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export interface StepContentProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number
  currentStep: number
}

export function StepContent({ 
  step, 
  currentStep, 
  className, 
  children, 
  ...props 
}: StepContentProps) {
  if (step !== currentStep) {
    return null
  }
  
  return (
    <div 
      className={cn("mt-4 animate-in fade-in duration-300", className)} 
      {...props}
    >
      {children}
    </div>
  )
}

export interface StepActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  hasPrevious?: boolean
  hasNext?: boolean
  onPrevious?: () => void
  onNext?: () => void
  nextLabel?: string
  previousLabel?: string
  isNextDisabled?: boolean
  isPreviousDisabled?: boolean
}

export function StepActions({
  hasPrevious = true,
  hasNext = true,
  onPrevious,
  onNext,
  nextLabel = "Next",
  previousLabel = "Back",
  isNextDisabled = false,
  isPreviousDisabled = false,
  className,
  ...props
}: StepActionsProps) {
  return (
    <div 
      className={cn("flex mt-6 justify-between items-center", className)} 
      {...props}
    >
      {hasPrevious ? (
        <button
          type="button"
          onClick={onPrevious}
          disabled={isPreviousDisabled}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md",
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {previousLabel}
        </button>
      ) : (
        <div />
      )}
      
      {hasNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
} 