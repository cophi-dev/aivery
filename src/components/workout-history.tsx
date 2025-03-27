"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format, parseISO, isAfter, isBefore, isEqual } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { 
  Activity, 
  Clock, 
  Dumbbell, 
  Filter, 
  Ruler, 
  CalendarIcon, 
  X,
  ArrowUpDown,
  Search
} from "lucide-react"
import type { WorkoutData } from "@/types/db"

// Add missing popover components temporarily - will be replaced with proper imports
const Popover = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const PopoverTrigger = ({ asChild, children }: { asChild?: boolean, children: React.ReactNode }) => <div>{children}</div>;
const PopoverContent = ({ className, children }: { className?: string, children: React.ReactNode }) => <div className={className}>{children}</div>;

interface WorkoutHistoryProps {
  initialWorkouts: WorkoutData[]
}

type SortField = "date" | "name" | "duration" | "type" | "intensity"
type SortDirection = "asc" | "desc"

export default function WorkoutHistory({ initialWorkouts }: WorkoutHistoryProps) {
  const [workouts, setWorkouts] = useState<WorkoutData[]>(initialWorkouts || [])
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutData[]>(initialWorkouts || [])
  
  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [intensityFilter, setIntensityFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  
  // Get unique workout types for filter options
  const workoutTypes = Array.from(new Set(workouts.map(w => w.type)))
  
  // Apply filters
  useEffect(() => {
    let result = [...workouts]
    
    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter(workout => workout.type === typeFilter)
    }
    
    // Filter by intensity
    if (intensityFilter !== "all") {
      result = result.filter(workout => workout.intensity === intensityFilter)
    }
    
    // Filter by date range
    if (startDate) {
      result = result.filter(workout => {
        const workoutDate = new Date(workout.date)
        return isAfter(workoutDate, startDate) || isEqual(workoutDate, startDate)
      })
    }
    
    if (endDate) {
      result = result.filter(workout => {
        const workoutDate = new Date(workout.date)
        return isBefore(workoutDate, endDate) || isEqual(workoutDate, endDate)
      })
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(workout => 
        (workout.name && workout.name.toLowerCase().includes(query)) ||
        workout.type.toLowerCase().includes(query) ||
        (workout.notes && workout.notes.toLowerCase().includes(query))
      )
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortField === "date") {
        return sortDirection === "asc" 
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime()
      }
      
      if (sortField === "duration") {
        return sortDirection === "asc" 
          ? a.duration - b.duration
          : b.duration - a.duration
      }
      
      // String-based sorting (name, type, intensity)
      const aValue = String(a[sortField] || "").toLowerCase()
      const bValue = String(b[sortField] || "").toLowerCase()
      
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    })
    
    setFilteredWorkouts(result)
  }, [workouts, typeFilter, intensityFilter, startDate, endDate, searchQuery, sortField, sortDirection])
  
  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default to descending for date, ascending for others
      setSortField(field)
      setSortDirection(field === "date" ? "desc" : "asc")
    }
  }
  
  // Reset all filters
  const resetFilters = () => {
    setTypeFilter("all")
    setIntensityFilter("all")
    setStartDate(undefined)
    setEndDate(undefined)
    setSearchQuery("")
  }
  
  // Determine if filters are active
  const filtersActive = 
    typeFilter !== "all" || 
    intensityFilter !== "all" || 
    startDate !== undefined || 
    endDate !== undefined || 
    searchQuery !== ""

  // Format date in a readable way
  const formatDate = (date: Date | undefined) => {
    if (!date) return "No date"
    return format(new Date(date), "MMM d, yyyy")
  }
  
  // Get badge color based on intensity
  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case "High":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      case "Medium":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
      case "Low":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
    }
  }
  
  // Get icon based on workout type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "running":
        return <Activity className="h-4 w-4" />
      case "cycling":
        return <Activity className="h-4 w-4" />
      case "swimming":
        return <Activity className="h-4 w-4" />
      case "strength":
        return <Dumbbell className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }
  
  // Get workout distance safely
  const getWorkoutDistance = (workout: WorkoutData): number => {
    if (workout.distance !== undefined) {
      return workout.distance;
    }
    if (workout.cardioDetails?.distance !== undefined) {
      return workout.cardioDetails.distance;
    }
    return 0;
  }
  
  return (
    <div>
      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          {/* Search */}
          <div className="w-full md:w-auto md:min-w-[250px]">
            <Label htmlFor="search-query">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-query"
                placeholder="Search workouts..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Workout Type */}
          <div className="w-full md:w-auto md:min-w-[150px]">
            <Label htmlFor="type-filter">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {workoutTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Intensity */}
          <div className="w-full md:w-auto md:min-w-[150px]">
            <Label htmlFor="intensity-filter">Intensity</Label>
            <Select value={intensityFilter} onValueChange={setIntensityFilter}>
              <SelectTrigger id="intensity-filter">
                <SelectValue placeholder="All intensities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All intensities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Date Range */}
          <div className="flex gap-2 w-full md:w-auto">
            <div>
              <Label htmlFor="start-date">From</Label>
              <Button
                id="start-date"
                variant="outline"
                className="w-full md:w-[130px] justify-start text-left font-normal"
                onClick={() => setStartDate(undefined)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? formatDate(startDate) : "Pick date"}
              </Button>
            </div>
            <div>
              <Label htmlFor="end-date">To</Label>
              <Button
                id="end-date"
                variant="outline"
                className="w-full md:w-[130px] justify-start text-left font-normal"
                onClick={() => setEndDate(undefined)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? formatDate(endDate) : "Pick date"}
              </Button>
            </div>
          </div>
          
          {/* Reset filters */}
          {filtersActive && (
            <Button 
              variant="ghost" 
              onClick={resetFilters}
              className="md:self-end"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
    
      {/* Results info */}
      <div className="flex justify-between items-center mb-4 text-sm text-muted-foreground">
        <span>
          Showing {filteredWorkouts.length} of {workouts.length} workouts
          {filtersActive && " (filtered)"}
        </span>
      </div>
      
      {/* Workouts Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="bg-muted">
          <div className="grid grid-cols-12 gap-2 p-4 text-xs font-medium text-muted-foreground">
            <div 
              className="col-span-3 flex items-center cursor-pointer"
              onClick={() => handleSort("date")}
            >
              Date
              <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "date" ? "opacity-100" : "opacity-50"}`} />
            </div>
            <div 
              className="col-span-3 flex items-center cursor-pointer"
              onClick={() => handleSort("name")}
            >
              Workout
              <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "name" ? "opacity-100" : "opacity-50"}`} />
            </div>
            <div 
              className="col-span-2 flex items-center cursor-pointer"
              onClick={() => handleSort("type")}
            >
              Type
              <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "type" ? "opacity-100" : "opacity-50"}`} />
            </div>
            <div 
              className="col-span-2 flex items-center cursor-pointer"
              onClick={() => handleSort("intensity")}
            >
              Intensity
              <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "intensity" ? "opacity-100" : "opacity-50"}`} />
            </div>
            <div 
              className="col-span-1 flex items-center cursor-pointer"
              onClick={() => handleSort("duration")}
            >
              Duration
              <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "duration" ? "opacity-100" : "opacity-50"}`} />
            </div>
            <div className="col-span-1"></div>
          </div>
        </div>
        
        <div className="divide-y">
          {filteredWorkouts.length > 0 ? (
            filteredWorkouts.map((workout) => (
              <div 
                key={workout._id} 
                className="grid grid-cols-12 gap-2 p-4 items-center hover:bg-muted/50"
              >
                <div className="col-span-3 flex flex-col">
                  <div className="font-medium">{formatDate(new Date(workout.date))}</div>
                </div>
                <div className="col-span-3">
                  <div className="font-medium">{workout.name || `${workout.type} workout`}</div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    {getTypeIcon(workout.type)}
                    {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Badge className={`${getIntensityColor(workout.intensity)} w-fit`}>
                    {workout.intensity}
                  </Badge>
                </div>
                <div className="col-span-1">
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {workout.duration} min
                  </div>
                  {(workout.distance || workout.cardioDetails?.distance) && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Ruler className="h-3 w-3" />
                      {getWorkoutDistance(workout).toFixed(1)} km
                    </div>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/workout/${workout._id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No workouts found matching your criteria.</p>
              {filtersActive && (
                <Button variant="link" onClick={resetFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 