'use client'

import { Calendar } from "@/components/ui/calendar"
import { useRouter, useSearchParams } from "next/navigation"

interface DatePickerProps {
  initialDate: Date
  workoutDates?: Date[]
}

export function DatePicker({ initialDate, workoutDates = [] }: DatePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onSelect = (date: Date | undefined) => {
    if (date) {
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('date', date.toISOString())
      router.push(`/calendar?${params.toString()}`)
    }
  }

  return (
    <Calendar
      mode="single"
      selected={initialDate}
      onSelect={onSelect}
      modifiers={{ workout: workoutDates }}
      modifiersStyles={{
        workout: {
          fontWeight: "bold",
          backgroundColor: "hsl(var(--primary) / 0.1)",
          color: "hsl(var(--primary))",
          borderRadius: "0.375rem"
        }
      }}
      className="rounded-md"
    />
  )
} 