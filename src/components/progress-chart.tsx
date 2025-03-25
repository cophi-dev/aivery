"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ProgressChart() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Mock workout data with IDs - in a real app, this would come from props or an API
  const workoutData = {
    bench: [
      { id: "w1", date: "Jan", weight: 80, x: 70, y: 180 },
      { id: "w2", date: "Feb", weight: 85, x: 160, y: 170 },
      { id: "w3", date: "Mar", weight: 90, x: 250, y: 150 },
      { id: "w4", date: "Apr", weight: 95, x: 340, y: 140 },
      { id: "w5", date: "May", weight: 100, x: 430, y: 120 },
      { id: "w6", date: "Jun", weight: 105, x: 520, y: 100 },
    ],
    squat: [
      { id: "w7", date: "Jan", weight: 120, x: 70, y: 190 },
      { id: "w8", date: "Feb", weight: 130, x: 160, y: 170 },
      { id: "w9", date: "Mar", weight: 140, x: 250, y: 140 },
      { id: "w10", date: "Apr", weight: 150, x: 340, y: 120 },
      { id: "w11", date: "May", weight: 160, x: 430, y: 90 },
      { id: "w12", date: "Jun", weight: 170, x: 520, y: 70 },
    ],
    deadlift: [
      { id: "w13", date: "Jan", weight: 140, x: 70, y: 200 },
      { id: "w14", date: "Feb", weight: 150, x: 160, y: 180 },
      { id: "w15", date: "Mar", weight: 160, x: 250, y: 150 },
      { id: "w16", date: "Apr", weight: 170, x: 340, y: 130 },
      { id: "w17", date: "May", weight: 180, x: 430, y: 100 },
      { id: "w18", date: "Jun", weight: 190, x: 520, y: 80 },
    ],
  }

  const runningData = {
    fiveK: [
      { id: "r1", date: "Jan", time: 25.5, x: 70, y: 180 },
      { id: "r2", date: "Feb", time: 24.8, x: 160, y: 170 },
      { id: "r3", date: "Mar", time: 24.2, x: 250, y: 160 },
      { id: "r4", date: "Apr", time: 23.5, x: 340, y: 150 },
      { id: "r5", date: "May", time: 22.8, x: 430, y: 140 },
      { id: "r6", date: "Jun", time: 22.0, x: 520, y: 130 },
    ],
    tenK: [
      { id: "r7", date: "Jan", time: 52.0, x: 70, y: 190 },
      { id: "r8", date: "Feb", time: 51.2, x: 160, y: 180 },
      { id: "r9", date: "Mar", time: 50.5, x: 250, y: 170 },
      { id: "r10", date: "Apr", time: 49.8, x: 340, y: 160 },
      { id: "r11", date: "May", time: 48.5, x: 430, y: 150 },
      { id: "r12", date: "Jun", time: 47.2, x: 520, y: 140 },
    ],
  }

  const swimmingData = {
    fiftyM: [
      { id: "s1", date: "Jan", time: 45.0, x: 70, y: 200 },
      { id: "s2", date: "Feb", time: 43.5, x: 160, y: 190 },
      { id: "s3", date: "Mar", time: 42.0, x: 250, y: 180 },
      { id: "s4", date: "Apr", time: 40.5, x: 340, y: 170 },
      { id: "s5", date: "May", time: 39.0, x: 430, y: 160 },
      { id: "s6", date: "Jun", time: 38.0, x: 520, y: 150 },
    ],
    hundredM: [
      { id: "s7", date: "Jan", time: 95.0, x: 70, y: 210 },
      { id: "s8", date: "Feb", time: 92.0, x: 160, y: 200 },
      { id: "s9", date: "Mar", time: 89.0, x: 250, y: 190 },
      { id: "s10", date: "Apr", time: 86.0, x: 340, y: 180 },
      { id: "s11", date: "May", time: 83.0, x: 430, y: 170 },
      { id: "s12", date: "Jun", time: 80.0, x: 520, y: 160 },
    ],
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDataPointClick = (workoutId: string) => {
    router.push(`/workout/${workoutId}`)
  }

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progress Tracking</CardTitle>
          <CardDescription>View your progress over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p>Loading chart...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <CardTitle>Progress Tracking</CardTitle>
            <CardDescription>View your progress over time</CardDescription>
          </div>
          <div className="mt-2 md:mt-0">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="recent">Recent (3 months)</SelectItem>
                <SelectItem value="year">Past Year</SelectItem>
                <SelectItem value="prs">Personal Records</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Tabs defaultValue="bench">
          <TabsList className="grid grid-cols-5 w-full max-w-md">
            <TabsTrigger value="bench">Bench</TabsTrigger>
            <TabsTrigger value="squat">Squat</TabsTrigger>
            <TabsTrigger value="deadlift">Deadlift</TabsTrigger>
            <TabsTrigger value="running">Running</TabsTrigger>
            <TabsTrigger value="swimming">Swimming</TabsTrigger>
          </TabsList>
          <TabsContent value="bench" className="mt-4">
            <div className="h-[250px] w-full relative">
              <svg className="w-full h-full">
                <line
                  x1="40"
                  y1="220"
                  x2="40"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />
                <line
                  x1="40"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />

                {/* Y-axis labels */}
                <text x="30" y="220" textAnchor="end" className="text-xs text-muted-foreground">
                  0
                </text>
                <text x="30" y="170" textAnchor="end" className="text-xs text-muted-foreground">
                  25
                </text>
                <text x="30" y="120" textAnchor="end" className="text-xs text-muted-foreground">
                  50
                </text>
                <text x="30" y="70" textAnchor="end" className="text-xs text-muted-foreground">
                  75
                </text>
                <text x="30" y="20" textAnchor="end" className="text-xs text-muted-foreground">
                  100
                </text>

                {/* X-axis labels */}
                <text x="70" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jan
                </text>
                <text x="160" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Feb
                </text>
                <text x="250" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Mar
                </text>
                <text x="340" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Apr
                </text>
                <text x="430" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  May
                </text>
                <text x="520" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jun
                </text>

                {/* Data points and line */}
                <polyline
                  points={workoutData.bench.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />

                {workoutData.bench.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-primary/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" />
                    <title>{`${point.date}: ${point.weight}kg - Click to view workout`}</title>
                  </g>
                ))}
              </svg>
            </div>
          </TabsContent>
          <TabsContent value="squat" className="mt-4">
            <div className="h-[250px] w-full relative">
              <svg className="w-full h-full">
                <line
                  x1="40"
                  y1="220"
                  x2="40"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />
                <line
                  x1="40"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />

                {/* Y-axis labels */}
                <text x="30" y="220" textAnchor="end" className="text-xs text-muted-foreground">
                  0
                </text>
                <text x="30" y="170" textAnchor="end" className="text-xs text-muted-foreground">
                  50
                </text>
                <text x="30" y="120" textAnchor="end" className="text-xs text-muted-foreground">
                  100
                </text>
                <text x="30" y="70" textAnchor="end" className="text-xs text-muted-foreground">
                  150
                </text>
                <text x="30" y="20" textAnchor="end" className="text-xs text-muted-foreground">
                  200
                </text>

                {/* X-axis labels */}
                <text x="70" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jan
                </text>
                <text x="160" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Feb
                </text>
                <text x="250" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Mar
                </text>
                <text x="340" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Apr
                </text>
                <text x="430" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  May
                </text>
                <text x="520" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jun
                </text>

                {/* Data points and line */}
                <polyline
                  points={workoutData.squat.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />

                {workoutData.squat.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-primary/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" />
                    <title>{`${point.date}: ${point.weight}kg - Click to view workout`}</title>
                  </g>
                ))}
              </svg>
            </div>
          </TabsContent>
          <TabsContent value="deadlift" className="mt-4">
            <div className="h-[250px] w-full relative">
              <svg className="w-full h-full">
                <line
                  x1="40"
                  y1="220"
                  x2="40"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />
                <line
                  x1="40"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />

                {/* Y-axis labels */}
                <text x="30" y="220" textAnchor="end" className="text-xs text-muted-foreground">
                  0
                </text>
                <text x="30" y="170" textAnchor="end" className="text-xs text-muted-foreground">
                  60
                </text>
                <text x="30" y="120" textAnchor="end" className="text-xs text-muted-foreground">
                  120
                </text>
                <text x="30" y="70" textAnchor="end" className="text-xs text-muted-foreground">
                  180
                </text>
                <text x="30" y="20" textAnchor="end" className="text-xs text-muted-foreground">
                  240
                </text>

                {/* X-axis labels */}
                <text x="70" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jan
                </text>
                <text x="160" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Feb
                </text>
                <text x="250" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Mar
                </text>
                <text x="340" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Apr
                </text>
                <text x="430" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  May
                </text>
                <text x="520" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jun
                </text>

                {/* Data points and line */}
                <polyline
                  points={workoutData.deadlift.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />

                {workoutData.deadlift.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-primary/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" />
                    <title>{`${point.date}: ${point.weight}kg - Click to view workout`}</title>
                  </g>
                ))}
              </svg>
            </div>
          </TabsContent>
          <TabsContent value="running" className="mt-4">
            <div className="h-[250px] w-full relative">
              <svg className="w-full h-full">
                <line
                  x1="40"
                  y1="220"
                  x2="40"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />
                <line
                  x1="40"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />

                {/* Y-axis labels */}
                <text x="30" y="220" textAnchor="end" className="text-xs text-muted-foreground">
                  0
                </text>
                <text x="30" y="170" textAnchor="end" className="text-xs text-muted-foreground">
                  15
                </text>
                <text x="30" y="120" textAnchor="end" className="text-xs text-muted-foreground">
                  30
                </text>
                <text x="30" y="70" textAnchor="end" className="text-xs text-muted-foreground">
                  45
                </text>
                <text x="30" y="20" textAnchor="end" className="text-xs text-muted-foreground">
                  60
                </text>

                {/* X-axis labels */}
                <text x="70" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jan
                </text>
                <text x="160" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Feb
                </text>
                <text x="250" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Mar
                </text>
                <text x="340" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Apr
                </text>
                <text x="430" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  May
                </text>
                <text x="520" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jun
                </text>

                {/* Data points and line for 5K */}
                <polyline
                  points={runningData.fiveK.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />

                {runningData.fiveK.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-primary/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" />
                    <title>{`${point.date}: ${point.time} min (5K) - Click to view activity`}</title>
                  </g>
                ))}

                {/* Data points and line for 10K */}
                <polyline
                  points={runningData.tenK.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />

                {runningData.tenK.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-destructive/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--destructive))" />
                    <title>{`${point.date}: ${point.time} min (10K) - Click to view activity`}</title>
                  </g>
                ))}

                {/* Legend */}
                <circle cx="480" cy="30" r="4" fill="hsl(var(--primary))" />
                <text x="490" y="33" className="text-xs">
                  5K Time
                </text>
                <circle cx="480" cy="50" r="4" fill="hsl(var(--destructive))" />
                <text x="490" y="53" className="text-xs">
                  10K Time
                </text>
              </svg>
            </div>
          </TabsContent>

          <TabsContent value="swimming" className="mt-4">
            <div className="h-[250px] w-full relative">
              <svg className="w-full h-full">
                <line
                  x1="40"
                  y1="220"
                  x2="40"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />
                <line
                  x1="40"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground"
                />

                {/* Y-axis labels */}
                <text x="30" y="220" textAnchor="end" className="text-xs text-muted-foreground">
                  0
                </text>
                <text x="30" y="170" textAnchor="end" className="text-xs text-muted-foreground">
                  30
                </text>
                <text x="30" y="120" textAnchor="end" className="text-xs text-muted-foreground">
                  60
                </text>
                <text x="30" y="70" textAnchor="end" className="text-xs text-muted-foreground">
                  90
                </text>
                <text x="30" y="20" textAnchor="end" className="text-xs text-muted-foreground">
                  120
                </text>

                {/* X-axis labels */}
                <text x="70" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jan
                </text>
                <text x="160" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Feb
                </text>
                <text x="250" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Mar
                </text>
                <text x="340" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Apr
                </text>
                <text x="430" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  May
                </text>
                <text x="520" y="235" textAnchor="middle" className="text-xs text-muted-foreground">
                  Jun
                </text>

                {/* Data points and line for 50m */}
                <polyline
                  points={swimmingData.fiftyM.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />

                {swimmingData.fiftyM.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-primary/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--primary))" />
                    <title>{`${point.date}: ${point.time} sec (50m) - Click to view activity`}</title>
                  </g>
                ))}

                {/* Data points and line for 100m */}
                <polyline
                  points={swimmingData.hundredM.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />

                {swimmingData.hundredM.map((point, index) => (
                  <g key={index} onClick={() => handleDataPointClick(point.id)} className="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke="none"
                      className="hover:fill-destructive/20"
                    />
                    <circle cx={point.x} cy={point.y} r="4" fill="hsl(var(--destructive))" />
                    <title>{`${point.date}: ${point.time} sec (100m) - Click to view activity`}</title>
                  </g>
                ))}

                {/* Legend */}
                <circle cx="480" cy="30" r="4" fill="hsl(var(--primary))" />
                <text x="490" y="33" className="text-xs">
                  50m Time
                </text>
                <circle cx="480" cy="50" r="4" fill="hsl(var(--destructive))" />
                <text x="490" y="53" className="text-xs">
                  100m Time
                </text>
              </svg>
            </div>
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  )
}

