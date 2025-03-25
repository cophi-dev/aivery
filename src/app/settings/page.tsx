"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { LucideBell, LucideLogOut, LucideMoon, LucideSun, LucideUser } from "lucide-react"
import { StravaImport } from "@/components/strava-import"

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mr-6">
                  <LucideUser className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <Button variant="outline" size="sm" className="mb-2">
                    Upload Photo
                  </Button>
                  <p className="text-sm text-muted-foreground">JPG, GIF or PNG. Max size of 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" defaultValue="John" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" defaultValue="Doe" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john.doe@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" defaultValue="+1 (555) 123-4567" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Physical Information</CardTitle>
              <CardDescription>Update your physical details for better tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" defaultValue="180" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" defaultValue="82" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" defaultValue="32" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select defaultValue="male">
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activity-level">Activity Level</Label>
                  <Select defaultValue="moderate">
                    <SelectTrigger id="activity-level">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary</SelectItem>
                      <SelectItem value="light">Lightly Active</SelectItem>
                      <SelectItem value="moderate">Moderately Active</SelectItem>
                      <SelectItem value="very">Very Active</SelectItem>
                      <SelectItem value="extreme">Extremely Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Update your password and security settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>

                <Button>Update Password</Button>
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="text-lg font-medium mb-4">Danger Zone</h3>
                <Button variant="destructive">
                  <LucideLogOut className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the app looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <LucideSun className="h-4 w-4" />
                    <Switch id="dark-mode" />
                    <LucideMoon className="h-4 w-4" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="theme-color">Theme Color</Label>
                  <Select defaultValue="default">
                    <SelectTrigger id="theme-color">
                      <SelectValue placeholder="Select theme color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Units</CardTitle>
              <CardDescription>Set your preferred measurement units</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weight-unit">Weight Unit</Label>
                  <Select defaultValue="kg">
                    <SelectTrigger id="weight-unit">
                      <SelectValue placeholder="Select weight unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height-unit">Height Unit</Label>
                  <Select defaultValue="cm">
                    <SelectTrigger id="height-unit">
                      <SelectValue placeholder="Select height unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">Centimeters (cm)</SelectItem>
                      <SelectItem value="ft">Feet/Inches (ft/in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance-unit">Distance Unit</Label>
                  <Select defaultValue="km">
                    <SelectTrigger id="distance-unit">
                      <SelectValue placeholder="Select distance unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Kilometers (km)</SelectItem>
                      <SelectItem value="mi">Miles (mi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workout Preferences</CardTitle>
              <CardDescription>Customize your workout experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Rest Timer</Label>
                    <p className="text-sm text-muted-foreground">Automatically start rest timer between sets</p>
                  </div>
                  <Switch id="rest-timer" defaultChecked />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="default-rest">Default Rest Time (seconds)</Label>
                  <Input id="default-rest" type="number" defaultValue="90" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Workout Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminders for scheduled workouts</p>
                  </div>
                  <Switch id="workout-reminders" defaultChecked />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="weekly-goal">Weekly Workout Goal</Label>
                  <Select defaultValue="5">
                    <SelectTrigger id="weekly-goal">
                      <SelectValue placeholder="Select weekly goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 workouts per week</SelectItem>
                      <SelectItem value="4">4 workouts per week</SelectItem>
                      <SelectItem value="5">5 workouts per week</SelectItem>
                      <SelectItem value="6">6 workouts per week</SelectItem>
                      <SelectItem value="7">7 workouts per week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Control how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Push Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="workout-reminders" className="text-base">
                          Workout Reminders
                        </Label>
                      </div>
                      <Switch id="workout-reminders" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="goal-achievements" className="text-base">
                          Goal Achievements
                        </Label>
                      </div>
                      <Switch id="goal-achievements" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="new-features" className="text-base">
                          New Features
                        </Label>
                      </div>
                      <Switch id="new-features" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="weekly-summary" className="text-base">
                          Weekly Summary
                        </Label>
                      </div>
                      <Switch id="weekly-summary" defaultChecked />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="email-progress" className="text-base">
                          Progress Reports
                        </Label>
                      </div>
                      <Switch id="email-progress" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="email-tips" className="text-base">
                          Workout Tips
                        </Label>
                      </div>
                      <Switch id="email-tips" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <LucideBell className="h-4 w-4 text-primary" />
                        <Label htmlFor="email-newsletter" className="text-base">
                          Monthly Newsletter
                        </Label>
                      </div>
                      <Switch id="email-newsletter" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Notification Schedule</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet-hours-start">Quiet Hours Start</Label>
                      <Select defaultValue="22:00">
                        <SelectTrigger id="quiet-hours-start">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20:00">8:00 PM</SelectItem>
                          <SelectItem value="21:00">9:00 PM</SelectItem>
                          <SelectItem value="22:00">10:00 PM</SelectItem>
                          <SelectItem value="23:00">11:00 PM</SelectItem>
                          <SelectItem value="00:00">12:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quiet-hours-end">Quiet Hours End</Label>
                      <Select defaultValue="07:00">
                        <SelectTrigger id="quiet-hours-end">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="05:00">5:00 AM</SelectItem>
                          <SelectItem value="06:00">6:00 AM</SelectItem>
                          <SelectItem value="07:00">7:00 AM</SelectItem>
                          <SelectItem value="08:00">8:00 AM</SelectItem>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enable Quiet Hours</Label>
                        <p className="text-sm text-muted-foreground">No notifications during quiet hours</p>
                      </div>
                      <Switch id="enable-quiet-hours" defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StravaImport />
    </div>
  )
}

