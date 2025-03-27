"use client"

import {
  CheckCircle,
  AlertCircle, 
  Loader2,
  HelpCircle,
  X,
  Menu,
  User,
  LogOut,
  Settings,
  Moon,
  Sun,
  Dumbbell,
  Calendar,
  MessageSquare,
  Activity,
  BarChart,
  Plus,
  ChevronRight,
} from "lucide-react"

export type IconProps = React.HTMLAttributes<SVGElement>

export const Icons = {
  spinner: Loader2,
  check: CheckCircle,
  alert: AlertCircle,
  question: HelpCircle,
  close: X,
  menu: Menu,
  user: User,
  logout: LogOut,
  settings: Settings,
  moon: Moon,
  sun: Sun,
  dumbbell: Dumbbell,
  calendar: Calendar,
  chat: MessageSquare,
  activity: Activity,
  chart: BarChart,
  add: Plus,
  chevronRight: ChevronRight,
} 