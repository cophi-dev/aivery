import { Metadata } from 'next'
import { generateMetadata } from '@/lib/utils/metadata'

export const metadata: Metadata = generateMetadata({
  title: "Workouts | Aivery",
  description: "Track and analyze your workouts with AI-powered insights. View your training history, monitor progress, and discover patterns in your fitness journey.",
  path: "/workouts",
  keywords: ["workout history", "training log", "fitness tracking", "workout analytics", "exercise journal"],
  type: "website"
})

export default function WorkoutsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 