import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2">Track your progress and performance metrics</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Select defaultValue="30days">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Workouts</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">16</div>
            <p className="text-muted-foreground text-sm">+2 from previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Volume</CardTitle>
            <CardDescription>Weight lifted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">48,320 kg</div>
            <p className="text-muted-foreground text-sm">+8% from previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Workout Time</CardTitle>
            <CardDescription>Total duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">18.5 hrs</div>
            <p className="text-muted-foreground text-sm">+1.5 hrs from previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Personal Records</CardTitle>
            <CardDescription>New PRs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-muted-foreground text-sm">Bench, Squat, Deadlift</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="strength" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="strength">Strength</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="frequency">Frequency</TabsTrigger>
        </TabsList>

        <TabsContent value="strength" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Strength Progress</CardTitle>
              <CardDescription>Track your main lifts progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full relative">
                <svg className="w-full h-full">
                  <line
                    x1="50"
                    y1="350"
                    x2="50"
                    y2="50"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />
                  <line
                    x1="50"
                    y1="350"
                    x2="750"
                    y2="350"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />

                  {/* Y-axis labels */}
                  <text x="40" y="350" textAnchor="end" className="text-xs text-muted-foreground">
                    0
                  </text>
                  <text x="40" y="300" textAnchor="end" className="text-xs text-muted-foreground">
                    50
                  </text>
                  <text x="40" y="250" textAnchor="end" className="text-xs text-muted-foreground">
                    100
                  </text>
                  <text x="40" y="200" textAnchor="end" className="text-xs text-muted-foreground">
                    150
                  </text>
                  <text x="40" y="150" textAnchor="end" className="text-xs text-muted-foreground">
                    200
                  </text>
                  <text x="40" y="100" textAnchor="end" className="text-xs text-muted-foreground">
                    250
                  </text>
                  <text x="40" y="50" textAnchor="end" className="text-xs text-muted-foreground">
                    300
                  </text>

                  {/* X-axis labels */}
                  <text x="100" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jan
                  </text>
                  <text x="200" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Feb
                  </text>
                  <text x="300" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Mar
                  </text>
                  <text x="400" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Apr
                  </text>
                  <text x="500" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    May
                  </text>
                  <text x="600" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jun
                  </text>
                  <text x="700" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jul
                  </text>

                  {/* Bench Press data */}
                  <polyline
                    points="100,300 200,290 300,280 400,270 500,260 600,250 700,240"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                  />

                  {/* Squat data */}
                  <polyline
                    points="100,270 200,250 300,230 400,210 500,190 600,170 700,150"
                    fill="none"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="2"
                  />

                  {/* Deadlift data */}
                  <polyline
                    points="100,250 200,230 300,210 400,190 500,170 600,150 700,130"
                    fill="none"
                    stroke="hsl(var(--secondary))"
                    strokeWidth="2"
                  />

                  {/* Legend */}
                  <circle cx="600" cy="30" r="4" fill="hsl(var(--primary))" />
                  <text x="610" y="35" className="text-xs">
                    Bench Press
                  </text>

                  <circle cx="600" cy="50" r="4" fill="hsl(var(--destructive))" />
                  <text x="610" y="55" className="text-xs">
                    Squat
                  </text>

                  <circle cx="600" cy="70" r="4" fill="hsl(var(--secondary))" />
                  <text x="610" y="75" className="text-xs">
                    Deadlift
                  </text>
                </svg>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Volume Progression</CardTitle>
              <CardDescription>Total weight lifted per workout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full relative">
                <svg className="w-full h-full">
                  <line
                    x1="50"
                    y1="350"
                    x2="50"
                    y2="50"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />
                  <line
                    x1="50"
                    y1="350"
                    x2="750"
                    y2="350"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />

                  {/* Y-axis labels */}
                  <text x="40" y="350" textAnchor="end" className="text-xs text-muted-foreground">
                    0
                  </text>
                  <text x="40" y="300" textAnchor="end" className="text-xs text-muted-foreground">
                    1000
                  </text>
                  <text x="40" y="250" textAnchor="end" className="text-xs text-muted-foreground">
                    2000
                  </text>
                  <text x="40" y="200" textAnchor="end" className="text-xs text-muted-foreground">
                    3000
                  </text>
                  <text x="40" y="150" textAnchor="end" className="text-xs text-muted-foreground">
                    4000
                  </text>
                  <text x="40" y="100" textAnchor="end" className="text-xs text-muted-foreground">
                    5000
                  </text>
                  <text x="40" y="50" textAnchor="end" className="text-xs text-muted-foreground">
                    6000
                  </text>

                  {/* X-axis labels - last 30 days */}
                  <text x="100" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Week 1
                  </text>
                  <text x="250" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Week 2
                  </text>
                  <text x="400" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Week 3
                  </text>
                  <text x="550" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Week 4
                  </text>
                  <text x="700" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Week 5
                  </text>

                  {/* Volume bars */}
                  <rect x="70" y="250" width="30" height="100" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="110" y="230" width="30" height="120" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="150" y="270" width="30" height="80" fill="hsl(var(--primary))" opacity="0.8" />

                  <rect x="220" y="240" width="30" height="110" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="260" y="220" width="30" height="130" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="300" y="260" width="30" height="90" fill="hsl(var(--primary))" opacity="0.8" />

                  <rect x="370" y="230" width="30" height="120" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="410" y="210" width="30" height="140" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="450" y="250" width="30" height="100" fill="hsl(var(--primary))" opacity="0.8" />

                  <rect x="520" y="220" width="30" height="130" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="560" y="200" width="30" height="150" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="600" y="240" width="30" height="110" fill="hsl(var(--primary))" opacity="0.8" />

                  <rect x="670" y="210" width="30" height="140" fill="hsl(var(--primary))" opacity="0.8" />
                  <rect x="710" y="190" width="30" height="160" fill="hsl(var(--primary))" opacity="0.8" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Workout Frequency</CardTitle>
              <CardDescription>Number of workouts per week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full relative">
                <svg className="w-full h-full">
                  <line
                    x1="50"
                    y1="350"
                    x2="50"
                    y2="50"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />
                  <line
                    x1="50"
                    y1="350"
                    x2="750"
                    y2="350"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground"
                  />

                  {/* Y-axis labels */}
                  <text x="40" y="350" textAnchor="end" className="text-xs text-muted-foreground">
                    0
                  </text>
                  <text x="40" y="300" textAnchor="end" className="text-xs text-muted-foreground">
                    1
                  </text>
                  <text x="40" y="250" textAnchor="end" className="text-xs text-muted-foreground">
                    2
                  </text>
                  <text x="40" y="200" textAnchor="end" className="text-xs text-muted-foreground">
                    3
                  </text>
                  <text x="40" y="150" textAnchor="end" className="text-xs text-muted-foreground">
                    4
                  </text>
                  <text x="40" y="100" textAnchor="end" className="text-xs text-muted-foreground">
                    5
                  </text>
                  <text x="40" y="50" textAnchor="end" className="text-xs text-muted-foreground">
                    6
                  </text>

                  {/* X-axis labels - months */}
                  <text x="100" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jan
                  </text>
                  <text x="200" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Feb
                  </text>
                  <text x="300" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Mar
                  </text>
                  <text x="400" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Apr
                  </text>
                  <text x="500" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    May
                  </text>
                  <text x="600" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jun
                  </text>
                  <text x="700" y="370" textAnchor="middle" className="text-xs text-muted-foreground">
                    Jul
                  </text>

                  {/* Frequency line */}
                  <polyline
                    points="100,200 200,150 300,150 400,100 500,150 600,100 700,100"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                  />

                  <circle cx="100" cy="200" r="4" fill="hsl(var(--primary))" />
                  <circle cx="200" cy="150" r="4" fill="hsl(var(--primary))" />
                  <circle cx="300" cy="150" r="4" fill="hsl(var(--primary))" />
                  <circle cx="400" cy="100" r="4" fill="hsl(var(--primary))" />
                  <circle cx="500" cy="150" r="4" fill="hsl(var(--primary))" />
                  <circle cx="600" cy="100" r="4" fill="hsl(var(--primary))" />
                  <circle cx="700" cy="100" r="4" fill="hsl(var(--primary))" />

                  {/* Target line */}
                  <line
                    x1="50"
                    y1="100"
                    x2="750"
                    y2="100"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                    className="text-muted-foreground"
                  />
                  <text x="60" y="90" className="text-xs text-muted-foreground">
                    Target (5)
                  </text>
                </svg>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Body Measurements</CardTitle>
            <CardDescription>Track your physical changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Weight</div>
                  <div className="text-sm font-medium">82 kg (-2 kg)</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[85%]"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Body Fat %</div>
                  <div className="text-sm font-medium">15% (-2%)</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[70%]"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Chest</div>
                  <div className="text-sm font-medium">105 cm (+2 cm)</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[80%]"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Arms</div>
                  <div className="text-sm font-medium">38 cm (+1 cm)</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[75%]"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Waist</div>
                  <div className="text-sm font-medium">84 cm (-3 cm)</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[65%]"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Muscle Group Focus</CardTitle>
            <CardDescription>Distribution of your training volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full relative">
              <svg viewBox="0 0 400 300" className="w-full h-full">
                <circle cx="200" cy="150" r="120" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />

                {/* Chest - 25% */}
                <path d="M200,150 L200,30 A120,120 0 0,1 304,150 Z" fill="hsl(var(--primary))" opacity="0.8" />
                <text x="250" y="80" className="text-sm font-medium">
                  Chest 25%
                </text>

                {/* Back - 20% */}
                <path d="M200,150 L304,150 A120,120 0 0,1 242,258 Z" fill="hsl(var(--destructive))" opacity="0.8" />
                <text x="270" y="200" className="text-sm font-medium">
                  Back 20%
                </text>

                {/* Legs - 30% */}
                <path d="M200,150 L242,258 A120,120 0 0,1 96,210 Z" fill="hsl(var(--secondary))" opacity="0.8" />
                <text x="160" y="240" className="text-sm font-medium">
                  Legs 30%
                </text>

                {/* Arms - 15% */}
                <path d="M200,150 L96,210 A120,120 0 0,1 110,70 Z" fill="hsl(var(--accent))" opacity="0.8" />
                <text x="100" y="150" className="text-sm font-medium">
                  Arms 15%
                </text>

                {/* Shoulders - 10% */}
                <path d="M200,150 L110,70 A120,120 0 0,1 200,30 Z" fill="hsl(var(--muted))" opacity="0.8" />
                <text x="140" y="70" className="text-sm font-medium">
                  Shoulders 10%
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

