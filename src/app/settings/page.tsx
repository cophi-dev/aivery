"use client"

import { useState, useEffect, useRef, useCallback, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { LucideBell, LucideLogOut, LucideMoon, LucideSun, LucideUser, Loader2, RefreshCw } from "lucide-react"
import { StravaImport } from "@/components/strava-import"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { IUser } from "@/lib/db/models/user"
import { UserAvatar } from "@/components/user-avatar"
import { AvatarLoader } from "@/components/avatar-loader"
import { fetchWithAuth } from "@/lib/client-utils"
import UserNicknameDisplay from "@/components/UserNicknameDisplay"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { deleteWorkoutsByTypes, deleteWorkoutsAction } from '../actions/delete-workouts'

interface Change {
  field: string;
  value: string | number;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [userData, setUserData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    image: session?.user?.image || '',
    nickname: '',
  })
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [fileSizeError, setFileSizeError] = useState<string | null>(null)
  const [user, setUser] = useState<IUser | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoadingUserData, setIsLoadingUserData] = useState(true)

  // Split the name into first and last name with proper default handling
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Update firstName and lastName when userData changes
  useEffect(() => {
    if (userData.name) {
      const nameParts = userData.name.split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
    }
  }, [userData.name]);

  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Add state for profile changes
  const [profileChanges, setProfileChanges] = useState({
    firstName: firstName,
    lastName: lastName,
    email: userData.email,
    phone: '',
    nickname: '',
  })

  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)

  // In the useEffect hook where we update the image, add a key to force refresh
  const [imageKey, setImageKey] = useState(`image-${Date.now()}`);

  // Add new state for AI personalization preferences
  const [aiPreferences, setAiPreferences] = useState({
    location: "",
    units: "metric",
    trainingPreferences: "",
    fitnessGoals: "",
    dietaryPreferences: ""
  })

  const [initialAiPreferences, setInitialAiPreferences] = useState({
    location: "",
    units: "metric",
    trainingPreferences: "",
    fitnessGoals: "",
    dietaryPreferences: ""
  })

  // Add a new state for location autocompletion
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const locationCommandRef = useRef<HTMLDivElement>(null)

  // Add state for optimizing text with AI
  const [isOptimizing, setIsOptimizing] = useState<Record<string, boolean>>({
    trainingPreferences: false,
    fitnessGoals: false,
    dietaryPreferences: false
  })

  // Add a new state to track when a location is being selected
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)

  // Add state to track the active tab
  const [activeTab, setActiveTab] = useState("profile")

  // Add Strava Sync State
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [syncStravaError, setSyncStravaError] = useState<string | null>(null);

  // Simple handleImageUpload function to fix the error
  const handleImageUpload = () => {
    toast({
      description: "Image upload is currently disabled",
    });
  };

  // Add a dummy password update handler
  const handlePasswordUpdate = () => {
    toast({
      description: "Password update is currently disabled",
    });
  };

  // Update hasChanges calculation to be more accurate
  const calculateHasChanges = useCallback(() => {
    // Check AI preferences changes
    const hasAiChanges = 
      (initialAiPreferences.location !== aiPreferences.location && aiPreferences.location !== "") ||
      (initialAiPreferences.trainingPreferences !== aiPreferences.trainingPreferences && aiPreferences.trainingPreferences !== "") ||
      (initialAiPreferences.fitnessGoals !== aiPreferences.fitnessGoals && aiPreferences.fitnessGoals !== "") ||
      (initialAiPreferences.dietaryPreferences !== aiPreferences.dietaryPreferences && aiPreferences.dietaryPreferences !== "");
      
    // Check profile changes
    const hasProfileChanges =
      (firstName !== profileChanges.firstName && profileChanges.firstName !== "") ||
      (lastName !== profileChanges.lastName && profileChanges.lastName !== "") ||
      (userData.email !== profileChanges.email && profileChanges.email !== "") ||
      (userData.nickname !== profileChanges.nickname && profileChanges.nickname !== "");
      
    return hasAiChanges || hasProfileChanges;
  }, [
    initialAiPreferences, aiPreferences,
    firstName, lastName, userData, profileChanges
  ]);

  // Add useEffect to calculate hasChanges when dependencies change
  useEffect(() => {
    setHasChanges(calculateHasChanges());
  }, [
    aiPreferences, 
    profileChanges,
    calculateHasChanges
  ]);

  // Update the loadUserData function to set initialAiPreferences
  const loadUserData = async () => {
    try {
      setIsLoadingUserData(true)
      
      // Fetch main user data
      const response = await fetchWithAuth('/api/user')
      const data = await response.json()
      
      if (data.user) {
        // Set the full user object to access _id
        setUser(data.user)
        
        // Load AI preferences if available
        if (data.user.aiPreferences) {
          const prefs = {
            location: data.user.aiPreferences.location || "",
            units: data.user.aiPreferences.units || "metric",
            trainingPreferences: data.user.aiPreferences.trainingPreferences || "",
            fitnessGoals: data.user.aiPreferences.fitnessGoals || "",
            dietaryPreferences: data.user.aiPreferences.dietaryPreferences || ""
          }
          setAiPreferences(prefs)
          setInitialAiPreferences(prefs)
        }
        
        // Set user data for profile fields
        setUserData({
          name: data.user.name || '',
          email: data.user.email || '',
          image: data.user.image || '',
          nickname: data.user.nickname || '',
        })
        
        // Set profile changes
        const nameParts = data.user.name?.split(' ') || ['', '']
        setFirstName(nameParts[0] || '')
        setLastName(nameParts.slice(1).join(' ') || '')
        
        setProfileChanges({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          nickname: data.user.nickname || '',
        })
      } else {
        setIsLoadingUserData(false)
        toast({
          title: "Error",
          description: "Failed to load user data",
          variant: "destructive"
        })
        return
      }
      
      // Update session to reflect any changes
      updateSession()
      
    } catch (error) {
      console.error("Error loading user data:", error)
      toast({
        title: "Error",
        description: "Failed to load user data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoadingUserData(false)
    }
  };

  useEffect(() => {
    if (session?.user) {
      console.log('Updating userData from session:', session.user)
      setUserData({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || '',
        nickname: (session.user as any).nickname || '',
      })

      // Also update profileChanges with name split into first and last
      if (session.user.name) {
        const nameParts = session.user.name.split(' ');
        const userFirstName = nameParts[0] || '';
        const userLastName = nameParts.slice(1).join(' ') || '';
        
        setProfileChanges(prev => ({
          ...prev,
          firstName: userFirstName,
          lastName: userLastName,
          email: session.user.email || '',
          nickname: (session.user as any).nickname || '',
        }))
      }
    }
  }, [session])

  // Call loadUserData when component mounts
  useEffect(() => {
    if (session?.user) {
      console.log('Loading user data from server...')
      loadUserData()
    }
  }, [session])

  // Add event listener for session updates
  useEffect(() => {
    // Add a DOM event listener for session updates
    const handleSessionUpdate = () => {
      console.log('Session update event detected')
      // Force reload of the page to refresh session
      window.location.reload()
    }

    window.addEventListener('session-update', handleSessionUpdate)
    
    return () => {
      window.removeEventListener('session-update', handleSessionUpdate)
    }
  }, [])

  // Update hasChanges whenever any form data changes
  useEffect(() => {
    // Check if the image has changed by looking at userData.image versus the session image
    const hasImageChanged = userData.image !== session?.user?.image && userData.image !== undefined && session?.user?.image !== undefined;
    
    const hasProfileChanges = 
      (profileChanges.firstName !== firstName && profileChanges.firstName !== '') ||
      (profileChanges.lastName !== lastName && profileChanges.lastName !== '') ||
      (profileChanges.email !== userData.email && profileChanges.email !== '') ||
      (profileChanges.phone !== '' && profileChanges.phone !== undefined) ||
      (profileChanges.nickname !== userData.nickname && profileChanges.nickname !== '') ||
      hasImageChanged;

    console.log('Checking for changes:', {
      hasImageChanged,
      hasProfileChanges,
      'userData.image.length': userData.image?.length,
      'session.image.length': session?.user?.image?.length
    });

    setHasChanges(hasProfileChanges);
  }, [profileChanges, userData, session?.user?.image, firstName, lastName]);

  // Handle profile changes
  const handleProfileChange = (field: string, value: string) => {
    setProfileChanges(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!hasChanges) {
      console.log('No changes to save')
      return
    }
    
    console.log('Starting save process')
    setIsSaving(true)
    setSaveError(null)
    
    // Clear the hasChanges flag immediately to prevent confusion
    setHasChanges(false)
    
    try {
      // Use a counter to track successful operations
      let successCount = 0
      
      // First, save AI preferences if they have changes
      if (Object.keys(aiPreferences).some(key => 
        aiPreferences[key as keyof typeof aiPreferences] !== null && 
        aiPreferences[key as keyof typeof aiPreferences] !== undefined
      )) {
        console.log('Saving AI preferences', aiPreferences)
        toast({
          description: "Saving AI preferences...",
          variant: "default"
        })
        
        try {
          // Make sure we have the full preferences object
          const fullPreferences = {
            location: aiPreferences.location || "",
            units: aiPreferences.units || "metric",
            trainingPreferences: aiPreferences.trainingPreferences || "",
            fitnessGoals: aiPreferences.fitnessGoals || "",
            dietaryPreferences: aiPreferences.dietaryPreferences || ""
          }
          
          // Use direct fetch with credentials to ensure cookies are sent
          const aiPrefsResponse = await fetch('/api/user/ai-preferences', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullPreferences),
            credentials: 'include',
          })
          
          // Get the full response for debugging
          const responseText = await aiPrefsResponse.text()
          console.log('AI preferences response:', aiPrefsResponse.status, responseText)
          
          let responseData
          try {
            responseData = JSON.parse(responseText)
          } catch (e) {
            console.error('Failed to parse response as JSON:', e)
          }
          
          if (!aiPrefsResponse.ok) {
            throw new Error(responseData?.error || `Failed to update AI preferences: ${aiPrefsResponse.status}`)
          }
          
          // After successful save, update the initial values
          setInitialAiPreferences({...aiPreferences});
          
          // Success
          successCount++
          console.log('AI preferences saved successfully')
          
          toast({
            description: "AI preferences saved successfully",
            variant: "default"
          })
        } catch (error) {
          console.error('Error updating AI preferences:', error)
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to update AI preferences"
          })
        }
      }
        
      // Handle profile info changes (name, email)
      if (
        profileChanges.firstName !== firstName ||
        profileChanges.lastName !== lastName ||
        profileChanges.email !== userData.email ||
        profileChanges.nickname !== userData.nickname
      ) {
        console.log('Saving profile changes')
        
        try {
          const profileResponse = await fetchWithAuth('/api/user/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firstName: profileChanges.firstName,
              lastName: profileChanges.lastName,
              email: profileChanges.email !== userData.email ? profileChanges.email : undefined,
              nickname: profileChanges.nickname,
            }),
          })
          
          if (!profileResponse.ok) {
            const profileError = await profileResponse.json()
            throw new Error(profileError.message || 'Failed to update profile info')
          }
          
          const { user: updatedUser, changes: profileChangesResult } = await profileResponse.json()
          
          // Update user data with the changes
          setUserData(prev => ({
            ...prev,
            name: updatedUser.name,
            email: updatedUser.email,
            nickname: updatedUser.nickname || prev.nickname,
          }))
          
          successCount++
          console.log('Profile updated with nickname:', updatedUser.nickname)
          
          // Show success toast with details of what was updated
          if (profileChangesResult && profileChangesResult.length > 0) {
            const changeMessages = profileChangesResult.map((change: Change) => {
              switch (change.field) {
                case 'name':
                  return `Name: ${change.value}`
                case 'email':
                  return `Email: ${change.value}`
                case 'nickname':
                  return `Nickname: ${change.value}`
                default:
                  return `${change.field}: ${change.value}`
              }
            })
            
            toast({
              title: "Success",
              description: `Updated: ${changeMessages.join(', ')}`
            })
          }
        } catch (error) {
          console.error('Error updating profile info:', error)
          setSaveError(error instanceof Error ? error.message : 'Failed to update profile info')
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to update profile info"
          })
        }
      }
      
      // If at least one operation was successful, consider the save successful
      if (successCount > 0) {
        // Show success state
        setSaveSuccess(true)
        
        // Reload user data to ensure form is up to date
        loadUserData()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to update profile')
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile"
      })
    } finally {
      setIsSaving(false)
      // Reset success message after 3 seconds
      if (saveSuccess) {
        setTimeout(() => {
          setSaveSuccess(false)
        }, 3000)
      }
    }
  }

  const [selectedWorkoutTypes, setSelectedWorkoutTypes] = useState<string[]>([])
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteWorkoutsError, setDeleteWorkoutsError] = useState('')
  const [deleteWorkoutsSuccess, setDeleteWorkoutsSuccess] = useState('')
  const [isDeletingWorkouts, setIsDeletingWorkouts] = useState(false)
  
  // Add state for workout type categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    strength: true,
    cardio: true,
    other: true
  })

  // Define workout type mapping to show standard display names but send correct backend values
  const workoutTypeMapping: Record<string, string[]> = {
    "Strength Training": ["strength", "Strength", "Workout"],
    "Running": ["running", "Running", "Run", "run"],
    "Swimming": ["swimming", "Swimming", "Swim", "swim"],
    "Cycling": ["cycling", "Cycling", "Ride", "ride", "bike"],
    "HIIT": ["hiit", "Hiit", "HIIT"],
    "Flexibility": ["flexibility", "Flexibility", "stretch", "Stretch"],
    "Other": ["other", "Other"],
  }

  type CategoryKey = 'strength' | 'cardio' | 'other';

  const workoutTypeCategories: Record<CategoryKey, string[]> = {
    strength: ["Strength Training"],
    cardio: ["Running", "Swimming", "Cycling"],
    other: ["HIIT", "Flexibility", "Other"]
  }

  const toggleCategory = (category: CategoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const selectAllWorkoutTypes = () => {
    const allTypes: string[] = []
    Object.entries(workoutTypeMapping).forEach(([displayName, variants]) => {
      allTypes.push(...variants)
    })
    setSelectedWorkoutTypes(allTypes)
  }

  const clearAllWorkoutTypes = () => {
    setSelectedWorkoutTypes([])
  }

  const toggleWorkoutTypeGroup = (displayName: string) => {
    const variants = workoutTypeMapping[displayName] || []
    
    // Check if all variants of this type are already selected
    const allSelected = variants.every(variant => selectedWorkoutTypes.includes(variant))
    
    if (allSelected) {
      // Remove all variants of this type
      setSelectedWorkoutTypes(prev => 
        prev.filter(t => !variants.includes(t))
      )
    } else {
      // Add all variants that aren't already selected
      setSelectedWorkoutTypes(prev => {
        const newSelection = [...prev]
        variants.forEach(variant => {
          if (!newSelection.includes(variant)) {
            newSelection.push(variant)
          }
        })
        return newSelection
      })
    }
  }

  const isWorkoutTypeSelected = (displayName: string) => {
    const variants = workoutTypeMapping[displayName] || []
    return variants.some(variant => selectedWorkoutTypes.includes(variant))
  }

  const getSelectedCountForCategory = (category: CategoryKey) => {
    const displayNames = workoutTypeCategories[category]
    let selectedCount = 0
    let totalCount = 0
    
    displayNames.forEach((displayName: string) => {
      const variants = workoutTypeMapping[displayName] || []
      totalCount += 1
      if (variants.some(variant => selectedWorkoutTypes.includes(variant))) {
        selectedCount += 1
      }
    })
    
    return { selectedCount, totalCount }
  }

  const [isPending, startTransition] = useTransition();

  const handleDeleteWorkoutsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get form data for the confirmation field
    const formData = new FormData(e.currentTarget);
    const confirmation = formData.get('confirmation')?.toString() || '';
    
    // Use the selectedWorkoutTypes state instead of reading from form data
    const types = selectedWorkoutTypes;
    
    // Validate
    if (confirmation !== 'delete') {
      setDeleteWorkoutsError("Please type 'delete' to confirm");
      return;
    }
    
    if (types.length === 0) {
      setDeleteWorkoutsError("Please select at least one workout type");
      return;
    }
    
    // Reset state
    setIsDeletingWorkouts(true);
    setDeleteWorkoutsError('');
    setDeleteWorkoutsSuccess('');
    
    // Show toast
    const loadingToast = toast({
      title: "Deleting workouts...",
      description: "This might take a few seconds",
    });
    
    // Use fetchWithAuth to call the API endpoint instead of server action
    (async () => {
      try {
        const response = await fetchWithAuth('/api/user/delete-workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workoutTypes: types,
            confirmation: confirmation
          }),
        });
        
        const result = await response.json();
        
        loadingToast.dismiss();
        
        if (!response.ok || !result.success) {
          setDeleteWorkoutsError(result.error || 'Failed to delete workouts');
          toast({
            title: "Error",
            description: result.error || 'Failed to delete workouts',
            variant: "destructive"
          });
        } else {
          // Format workout types for display
          const workoutTypesList = types
            .map(type => type.charAt(0).toUpperCase() + type.slice(1))
            .join(', ');

          // Create success message
          let successMessage = '';
          
          if (result.deletedCount === 0) {
            if (result.userHasWorkouts && result.availableTypes && result.availableTypes.length > 0) {
              // The user has workouts but not of the selected types
              const availableTypesList = result.availableTypes
                .map((type: string) => type.charAt(0).toUpperCase() + type.slice(1))
                .join(', ');
              
              successMessage = `No workouts found matching the selected types: ${workoutTypesList}. ` +
                `Your account has workouts with these types: ${availableTypesList}. ` +
                `Please select one of these types to delete workouts.`;
            } else if (result.userHasWorkouts) {
              successMessage = `No workouts found matching the selected types: ${workoutTypesList}. ` +
                `You have workouts, but they use different workout type names than selected.`;
            } else {
              successMessage = `No workouts found matching the selected types: ${workoutTypesList}.`;
            }
          } else {
            // Use the string returned from the API
            successMessage = `Successfully deleted ${result.deletedCount} ${result.deletedCount === 1 ? 'workout' : 'workouts'} ` +
              `of types: ${result.deletedTypesString}.`; // Use result.deletedTypesString
          }
          
          setDeleteWorkoutsSuccess(successMessage);
          setSelectedWorkoutTypes([]);
          
          toast({
            title: "Success",
            description: successMessage,
          });
          
          // Reset the form
          (e.target as HTMLFormElement).reset();
        }
      } catch (error) {
        loadingToast.dismiss();
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        
        setDeleteWorkoutsError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsDeletingWorkouts(false);
      }
    })();
  };

  // Add this function to handle AI preference changes
  const handleAiPreferenceChange = (field: string, value: string) => {
    setAiPreferences(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  // Update fetchLocationSuggestions to use an API instead of hardcoded cities
  const fetchLocationSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setLocationSuggestions([])
      return
    }

    try {
      // For now use a simple fallback approach, while we implement a real API
      // This simulates an API call without actually making one
      const dummyCities = [
        "New York, USA", "London, UK", "Paris, France", "Tokyo, Japan",
        "Berlin, Germany", "Madrid, Spain", "Rome, Italy", "Sydney, Australia",
        "Moscow, Russia", "Beijing, China", "Cairo, Egypt", "Rio de Janeiro, Brazil",
        "Amsterdam, Netherlands", "Singapore", "Mumbai, India", "Mexico City, Mexico",
        "Los Angeles, USA", "Toronto, Canada", "Barcelona, Spain", "Dubai, UAE",
        "Hamburg, Germany", "Copenhagen, Denmark", "Stockholm, Sweden", "Oslo, Norway"
      ]
      
      // Filter by query
      const lowerQuery = query.toLowerCase()
      const filtered = dummyCities.filter(city => 
        city.toLowerCase().includes(lowerQuery)
      )
      
      // In production, this would be replaced with a real API call
      if (filtered.length > 0) {
        setLocationSuggestions(filtered.slice(0, 15))
      } else {
        setLocationSuggestions([`${query} (Add this location)`])
      }
      
      // Note: In the future, replace this with a real API implementation like:
      /*
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=10&apiKey=YOUR_API_KEY`
      )
      const data = await response.json()
      const suggestions = data.features.map(feature => feature.properties.formatted)
      setLocationSuggestions(suggestions)
      */
    } catch (error) {
      console.error('Error with location suggestions:', error)
      // Fallback to adding the custom location
      setLocationSuggestions([`${query} (Add this location)`])
    }
  }

  // Update the useEffect for handling outside clicks to include the new state
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        locationCommandRef.current && 
        !locationCommandRef.current.contains(event.target as Node) &&
        isSelectingLocation
      ) {
        setIsLocationDropdownOpen(false)
        setIsSelectingLocation(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isSelectingLocation])

  // Function to optimize text with AI with improved error handling
  const optimizeTextWithAI = async (field: string, text: string) => {
    if (!text || text.trim() === '') {
      toast({
        description: "Please enter some text to optimize",
        variant: "destructive"
      })
      return
    }
    
    setIsOptimizing(prev => ({ ...prev, [field]: true }))
    
    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          field,
          context: {
            location: aiPreferences.location,
            units: aiPreferences.units
          },
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        if (errorData.error === 'Not authenticated') {
          toast({
            title: "Authentication Error",
            description: "Please try logging out and back in",
            variant: "destructive"
          })
        } else {
          throw new Error(errorData.error || 'Failed to optimize text')
        }
        return
      }
      
      const data = await response.json()
      handleAiPreferenceChange(field, data.optimizedText)
      
      toast({
        description: "Text optimized by AI",
        variant: "default"
      })
    } catch (error) {
      console.error('Error optimizing text:', error)
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Failed to optimize text",
        variant: "destructive"
      })
    } finally {
      setIsOptimizing(prev => ({ ...prev, [field]: false }))
    }
  }

  // Debug log email values
  useEffect(() => {
    console.log('Email debug values:', {
      'session?.user?.email': session?.user?.email,
      'userData.email': userData.email,
      'profileChanges.email': profileChanges.email
    });
  }, [session?.user?.email, userData.email, profileChanges.email]);

  // --- Strava Sync Handler ---
  const handleSyncStrava = async () => {
    setIsSyncingStrava(true);
    setSyncStravaError(null);

    try {
      // First verify Strava connection - but don't block on it
      try {
        const stravaCheck = await fetchWithAuth('/api/strava-status');
        const stravaStatus = await stravaCheck.json();
        
        if (!stravaCheck.ok || (!stravaStatus.connected && !stravaStatus.forcedValid)) {
          // Still proceed if validation fails, just show a warning
          console.warn('Strava connection validation failed, but proceeding anyway');
          toast({ 
            title: "Warning", 
            description: "Your Strava connection validation failed, but we'll try syncing anyway",
            variant: "default"
          });
        }
      } catch (validationError) {
        console.error("Error validating Strava connection:", validationError);
        // Continue anyway - don't block
      }
      
      // Attempt the sync regardless of validation result
      const response = await fetchWithAuth('/api/strava/sync-recent', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start Strava sync');
      }

      toast({ title: "Strava Sync Started", description: "Your recent activities will be imported shortly." });

    } catch (error: any) {
      console.error("Strava sync error:", error);
      setSyncStravaError(error.message || 'An unexpected error occurred during sync.');
      toast({ title: "Strava Sync Failed", description: error.message || 'Could not start sync.', variant: "destructive" });
    } finally {
      setIsSyncingStrava(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full sm:grid-cols-3 lg:grid-cols-3 gap-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai">AI Personalization</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab Content */}
        <TabsContent value="profile">
          <div className="space-y-4 sm:space-y-8">
            <Card className="mb-4 sm:mb-8">
              <CardHeader>
                <CardTitle>Profile Image</CardTitle>
                <CardDescription>Update your profile photo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
                  <AvatarLoader 
                    name={userData.name} 
                    size="lg"
                    refreshKey={imageKey} 
                  />
                  <div>
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full sm:w-auto"
                    >
                      {isUploadingImage ? 'Uploading...' : 'Change Photo'}
                    </Button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG, PNG or GIF. 1MB max.
                    </p>
                    {fileSizeError && (
                      <p className="text-xs text-destructive mt-1">{fileSizeError}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="mb-4 sm:mb-8">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-4 sm:px-6">
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input 
                      id="first-name" 
                      value={profileChanges.firstName} 
                      onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input 
                      id="last-name" 
                      value={profileChanges.lastName} 
                      onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      className="mt-1"
                      value={profileChanges.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your email address is used for login and notifications.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname (shown in app)</Label>
                    <Input 
                      id="nickname" 
                      value={profileChanges.nickname} 
                      onChange={(e) => handleProfileChange('nickname', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Password update functionality is temporarily disabled.
                  </p>
                  <Button 
                    disabled={true}
                  >
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Personalization Tab Content */}
        <TabsContent value="ai">
          <div className="space-y-4 sm:space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>AI Personalization</CardTitle>
                <CardDescription>Customize how AI responds to you</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative" ref={locationCommandRef}>
                      <div className="flex items-center">
                        <Input 
                          id="location" 
                          placeholder="e.g. New York, USA" 
                          value={aiPreferences.location}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            handleAiPreferenceChange('location', e.target.value)
                            // Show suggestions whenever user types
                            if (e.target.value.length > 1) {
                              fetchLocationSuggestions(e.target.value)
                              setIsLocationDropdownOpen(true)
                              setIsSelectingLocation(true)
                            } else {
                              setLocationSuggestions([])
                              setIsLocationDropdownOpen(false)
                            }
                          }}
                          onFocus={() => {
                            // Show suggestions on focus if there's already text
                            if (aiPreferences.location && aiPreferences.location.length > 1) {
                              fetchLocationSuggestions(aiPreferences.location)
                              setIsLocationDropdownOpen(true)
                              setIsSelectingLocation(true)
                            }
                          }}
                          onClick={() => {
                            // Show suggestions on click if there's already text
                            if (aiPreferences.location && aiPreferences.location.length > 1) {
                              fetchLocationSuggestions(aiPreferences.location)
                              setIsLocationDropdownOpen(true)
                              setIsSelectingLocation(true)
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                      
                      {isLocationDropdownOpen && locationSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background rounded-md shadow-lg border border-border overflow-hidden">
                          <div className="max-h-[200px] overflow-y-auto p-1">
                            {locationSuggestions.map((location) => (
                              <div
                                key={location}
                                onClick={() => {
                                  handleAiPreferenceChange('location', location.replace(' (Add this location)', ''))
                                  setIsLocationDropdownOpen(false)
                                  setIsSelectingLocation(false)
                                }}
                                className="cursor-pointer hover:bg-accent rounded-sm px-2 py-1.5 text-sm"
                              >
                                {location}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Helps AI provide location-specific workout recommendations and weather context
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="units">Preferred Units</Label>
                    <Select 
                      value={aiPreferences.units} 
                      onValueChange={(value) => handleAiPreferenceChange('units', value)}
                    >
                      <SelectTrigger id="units">
                        <SelectValue placeholder="Select your preferred units" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (kg, km)</SelectItem>
                        <SelectItem value="imperial">Imperial (lb, miles)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      For workout and measurement units
                    </p>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="training-preferences">Training Preferences</Label>
                    <Textarea 
                      id="training-preferences" 
                      placeholder="e.g. I enjoy running 3x per week and doing yoga on rest days. I prefer evening workouts and outdoor activities when weather permits." 
                      className="min-h-[80px]"
                      value={aiPreferences.trainingPreferences}
                      onChange={(e) => handleAiPreferenceChange('trainingPreferences', e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Describe your preferred training style, frequency, and environment
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 h-6"
                        onClick={() => optimizeTextWithAI('trainingPreferences', aiPreferences.trainingPreferences)}
                        disabled={isOptimizing.trainingPreferences || !aiPreferences.trainingPreferences}
                      >
                        {isOptimizing.trainingPreferences ? (
                          <>
                            <span className="animate-spin mr-1">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize with AI</>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fitness-goals">Fitness Goals</Label>
                    <Textarea 
                      id="fitness-goals" 
                      placeholder="e.g. Complete a half marathon in September, build upper body strength, improve my 5K time to under 25 minutes" 
                      className="min-h-[80px]"
                      value={aiPreferences.fitnessGoals}
                      onChange={(e) => handleAiPreferenceChange('fitnessGoals', e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Describe your short and long-term fitness goals
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 h-6"
                        onClick={() => optimizeTextWithAI('fitnessGoals', aiPreferences.fitnessGoals)}
                        disabled={isOptimizing.fitnessGoals || !aiPreferences.fitnessGoals}
                      >
                        {isOptimizing.fitnessGoals ? (
                          <>
                            <span className="animate-spin mr-1">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize with AI</>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dietary-preferences">Dietary Preferences</Label>
                    <Textarea 
                      id="dietary-preferences" 
                      placeholder="e.g. I follow a vegetarian diet with occasional fish. I try to limit processed foods and focus on whole grains and vegetables." 
                      className="min-h-[80px]"
                      value={aiPreferences.dietaryPreferences}
                      onChange={(e) => handleAiPreferenceChange('dietaryPreferences', e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Any dietary restrictions, preferences, or nutrition goals
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 h-6"
                        onClick={() => optimizeTextWithAI('dietaryPreferences', aiPreferences.dietaryPreferences)}
                        disabled={isOptimizing.dietaryPreferences || !aiPreferences.dietaryPreferences}
                      >
                        {isOptimizing.dietaryPreferences ? (
                          <>
                            <span className="animate-spin mr-1">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize with AI</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab Content - NEW */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Strava Integration</CardTitle>
              <CardDescription>
                Manually sync recent activities from your connected Strava account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  onClick={handleSyncStrava} 
                  disabled={isSyncingStrava}
                  variant="default"
                  size="default"
                  className="w-full"
                >
                  {isSyncingStrava ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" /> Sync Last 30 Days from Strava</>
                  )}
                </Button>
              </div>

              {syncStravaError && (
                <p className="text-sm text-red-600 mt-2">Error: {syncStravaError}</p>
              )}
              <Separator />
               {/* Existing StravaImport component if needed */}
              <StravaImport /> 
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
