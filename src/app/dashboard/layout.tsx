import { Metadata } from 'next'
import { generateMetadata } from '@/lib/utils/metadata'

export const metadata: Metadata = generateMetadata({
  title: "Dashboard | Aivery",
  description: "Your personalized fitness dashboard with AI-powered insights, progress tracking, and workout analytics. Monitor your performance and achieve your fitness goals.",
  path: "/dashboard",
  keywords: ["fitness dashboard", "workout tracking", "progress analytics", "AI insights", "personal records"],
  type: "website"
})

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 