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
import { LucideBell, LucideLogOut, LucideMoon, LucideSun, LucideUser } from "lucide-react"
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

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [physicalInfo, setPhysicalInfo] = useState({
    height: "",
    weight: "",
    age: "",
    gender: "",
    activityLevel: ""
  })

  const [isUpdatingPhysical, setIsUpdatingPhysical] = useState(false)
  const [isLoadingUserData, setIsLoadingUserData] = useState(true)
  const [physicalError, setPhysicalError] = useState('')
  const [physicalSuccess, setPhysicalSuccess] = useState('')
  const [showSavedMessage, setShowSavedMessage] = useState(false)

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

  // Add state for initial values
  const [initialPhysicalInfo, setInitialPhysicalInfo] = useState({
    height: "",
    weight: "",
    age: "",
    gender: "",
    activityLevel: ""
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

  // Update hasChanges calculation to be more accurate
  const calculateHasChanges = useCallback(() => {
    // Check AI preferences changes
    const hasAiChanges = 
      (initialAiPreferences.location !== aiPreferences.location && aiPreferences.location !== "") ||
      (initialAiPreferences.trainingPreferences !== aiPreferences.trainingPreferences && aiPreferences.trainingPreferences !== "") ||
      (initialAiPreferences.fitnessGoals !== aiPreferences.fitnessGoals && aiPreferences.fitnessGoals !== "") ||
      (initialAiPreferences.dietaryPreferences !== aiPreferences.dietaryPreferences && aiPreferences.dietaryPreferences !== "");
      
    // Check physical info changes
    const hasPhysicalChanges = 
      (initialPhysicalInfo.height !== physicalInfo.height && physicalInfo.height !== "") ||
      (initialPhysicalInfo.weight !== physicalInfo.weight && physicalInfo.weight !== "") ||
      (initialPhysicalInfo.age !== physicalInfo.age && physicalInfo.age !== "") ||
      (initialPhysicalInfo.gender !== physicalInfo.gender && physicalInfo.gender !== "") ||
      (initialPhysicalInfo.activityLevel !== physicalInfo.activityLevel && physicalInfo.activityLevel !== "");
      
    // Check profile changes
    const hasProfileChanges =
      (firstName !== profileChanges.firstName && profileChanges.firstName !== "") ||
      (lastName !== profileChanges.lastName && profileChanges.lastName !== "") ||
      (userData.email !== profileChanges.email && profileChanges.email !== "") ||
      (userData.nickname !== profileChanges.nickname && profileChanges.nickname !== "");
      
    return hasAiChanges || hasPhysicalChanges || hasProfileChanges;
  }, [
    initialAiPreferences, aiPreferences,
    initialPhysicalInfo, physicalInfo,
    firstName, lastName, userData, profileChanges
  ]);

  // Add useEffect to calculate hasChanges when dependencies change
  useEffect(() => {
    setHasChanges(calculateHasChanges());
  }, [
    aiPreferences, 
    physicalInfo, 
    profileChanges,
    calculateHasChanges
  ]);

  // Add this useEffect to update hasChanges when relevant values change
  useEffect(() => {
    // Check if any AI preferences have changed
    const aiPrefsChanged = 
      (initialAiPreferences.location !== aiPreferences.location && aiPreferences.location !== "") || 
      (initialAiPreferences.trainingPreferences !== aiPreferences.trainingPreferences && aiPreferences.trainingPreferences !== "") ||
      (initialAiPreferences.fitnessGoals !== aiPreferences.fitnessGoals && aiPreferences.fitnessGoals !== "") ||
      (initialAiPreferences.dietaryPreferences !== aiPreferences.dietaryPreferences && aiPreferences.dietaryPreferences !== "");
      
    // Check if any physical info has changed
    const physicalInfoChanged = 
      (initialPhysicalInfo.height !== physicalInfo.height && physicalInfo.height !== "") ||
      (initialPhysicalInfo.weight !== physicalInfo.weight && physicalInfo.weight !== "") ||
      (initialPhysicalInfo.age !== physicalInfo.age && physicalInfo.age !== "") ||
      (initialPhysicalInfo.gender !== physicalInfo.gender && physicalInfo.gender !== "") ||
      (initialPhysicalInfo.activityLevel !== physicalInfo.activityLevel && physicalInfo.activityLevel !== "");
      
    // Check if any profile info has changed
    const profileChanged = 
      (profileChanges.firstName !== firstName && profileChanges.firstName !== "") ||
      (profileChanges.lastName !== lastName && profileChanges.lastName !== "") ||
      (profileChanges.email !== userData.email && profileChanges.email !== "") ||
      (profileChanges.nickname !== userData.nickname && profileChanges.nickname !== "");
      
    // Update hasChanges state only if we're not currently loading data
    if (!isLoadingUserData) {
      setHasChanges(aiPrefsChanged || physicalInfoChanged || profileChanged);
    }
  }, [
    aiPreferences, initialAiPreferences, 
    physicalInfo, initialPhysicalInfo,
    profileChanges, firstName, lastName, userData, 
    isLoadingUserData
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
          };
          
          setAiPreferences(prefs);
          setInitialAiPreferences(prefs);
        }
        
        // Fetch physical info separately
        try {
          const physicalResponse = await fetch('/api/user/physical', {
            method: 'GET',
            credentials: 'include'
          })
          
          if (physicalResponse.ok) {
            const physicalData = await physicalResponse.json()
            console.log("Loaded physical info:", physicalData)
            
            const newPhysicalInfo = {
              height: physicalData.height?.toString() || "",
              weight: physicalData.weight?.toString() || "",
              age: physicalData.age?.toString() || "",
              gender: physicalData.gender || "",
              activityLevel: physicalData.activityLevel || ""
            }
            
            console.log("Setting physical info:", newPhysicalInfo)
            
            setPhysicalInfo(newPhysicalInfo)
            // Store initial values for comparison
            setInitialPhysicalInfo(newPhysicalInfo)
          } else {
            console.error("Failed to load physical info:", await physicalResponse.text())
          }
        } catch (physicalError) {
          console.error("Error fetching physical info:", physicalError)
        }
        
        // Fetch avatar image directly from database
        try {
          const avatarResponse = await fetchWithAuth('/api/user/avatar')
          const avatarData = await avatarResponse.json()
          if (avatarData.image) {
            console.log("Got avatar image directly from database:", 
              avatarData.image.substring(0, 30) + "... " + 
              `(${Math.round(avatarData.image.length / 1024)}KB)`
            )
            setUserData(prev => ({
              ...prev,
              image: avatarData.image
            }))
          }
        } catch (avatarError) {
          console.error("Error fetching avatar:", avatarError)
        }

        // Update nickname if available
        if (data.user.nickname) {
          setUserData(prev => ({
            ...prev,
            nickname: data.user.nickname
          }))
          setProfileChanges(prev => ({
            ...prev,
            nickname: data.user.nickname
          }))
        }
        
        // Update profile changes with name data
        if (data.user.name) {
          const nameParts = data.user.name.split(' ');
          const userFirstName = nameParts[0] || '';
          const userLastName = nameParts.slice(1).join(' ') || '';
          
          setProfileChanges(prev => ({
            ...prev,
            firstName: userFirstName,
            lastName: userLastName
          }))
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      toast({
        variant: "destructive",
        description: "Failed to load user data",
      })
    } finally {
      setIsLoadingUserData(false)
    }
  }

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

    // Only consider changes if values are non-empty and different from initial values
    const hasPhysicalChanges = 
      (physicalInfo.height !== initialPhysicalInfo.height && physicalInfo.height !== "") ||
      (physicalInfo.weight !== initialPhysicalInfo.weight && physicalInfo.weight !== "") ||
      (physicalInfo.age !== initialPhysicalInfo.age && physicalInfo.age !== "") ||
      (physicalInfo.gender !== initialPhysicalInfo.gender && physicalInfo.gender !== "") ||
      (physicalInfo.activityLevel !== initialPhysicalInfo.activityLevel && physicalInfo.activityLevel !== "");

    console.log('Checking for changes:', {
      hasImageChanged,
      hasProfileChanges,
      hasPhysicalChanges,
      'userData.image.length': userData.image?.length,
      'session.image.length': session?.user?.image?.length,
      'physicalInfo': physicalInfo,
      'initialPhysicalInfo': initialPhysicalInfo
    });

    setHasChanges(hasProfileChanges || hasPhysicalChanges);
  }, [profileChanges, physicalInfo, firstName, lastName, userData, session?.user?.image, initialPhysicalInfo]);

  // Handle profile changes
  const handleProfileChange = (field: string, value: string) => {
    setProfileChanges(prev => ({ ...prev, [field]: value }))
  }

  const handlePasswordUpdate = async () => {
    setIsUpdatingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')

    if (currentPassword === '' || newPassword === '' || confirmPassword === '') {
      setPasswordError('All fields are required')
      setIsUpdatingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      setIsUpdatingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      setIsUpdatingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong')
      }

      setPasswordSuccess('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handlePhysicalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingPhysical(true)
    setPhysicalError('')
    setPhysicalSuccess('')
    try {
      const response = await fetch('/api/user/physical', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          height: physicalInfo.height ? Number(physicalInfo.height) : undefined,
          weight: physicalInfo.weight ? Number(physicalInfo.weight) : undefined,
          age: physicalInfo.age ? Number(physicalInfo.age) : undefined,
          gender: physicalInfo.gender || undefined,
          activityLevel: physicalInfo.activityLevel || undefined,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to update physical information')
      }

      const data = await response.json()

      // Show success message
      setPhysicalSuccess('Physical information updated successfully')
      setShowSavedMessage(true)
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setShowSavedMessage(false)
      }, 3000)

      // Show changes in toast
      if (data.changes && data.changes.length > 0) {
        const changeMessages = data.changes.map((change: { field: string, value: any }) => {
          switch (change.field) {
            case 'weight':
              return `Weight: ${change.value}kg`
            case 'height':
              return `Height: ${change.value}cm`
            case 'age':
              return `Age: ${change.value}`
            case 'gender':
              return `Gender: ${change.value}`
            case 'activityLevel':
              return `Activity Level: ${change.value}`
            default:
              return `${change.field}: ${change.value}`
          }
        })
        
        toast({
          description: `Updated: ${changeMessages.join(', ')}`
        })
      }
    } catch (error) {
      console.error('Error updating physical information:', error)
      setPhysicalError('Failed to update physical information')
    } finally {
      setIsUpdatingPhysical(false)
      // Clean up the object URL
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage)
        setSelectedImage(null)
      }
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Reset previous errors
    setFileSizeError(null)

    // Check file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type)
      setFileSizeError('Please upload an image file')
      return
    }

    // Check file size (1MB limit)
    const maxSize = 1 * 1024 * 1024 // 1MB in bytes
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
      console.error('File too large:', sizeMB, 'MB')
      setFileSizeError(`Image size (${sizeMB}MB) exceeds 1MB limit`)
      return
    }

    setImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    console.log('Created object URL:', objectUrl)
    setPreviewUrl(objectUrl)
    setShowCropDialog(true)
    setHasChanges(true)
  }

  const compressImage = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          
          // Calculate dimensions while maintaining aspect ratio
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }
          
          // Draw image to canvas with new dimensions
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Failed to get canvas context');
            resolve(blob);
            return;
          }
          
          // Set high quality
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob with reduced quality
          canvas.toBlob(
            (result) => {
              if (!result) {
                console.error('Failed to compress image');
                resolve(blob);
                return;
              }
              
              console.log(`Original size: ${Math.round(blob.size / 1024)}KB, Compressed size: ${Math.round(result.size / 1024)}KB, Reduction: ${Math.round((1 - result.size / blob.size) * 100)}%`);
              resolve(result);
            },
            'image/png',
            0.8
          );
        };
        
        img.onerror = () => {
          console.error('Failed to load image for compression');
          resolve(blob);
        };
        
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        console.error('Error compressing image:', err);
        resolve(blob);
      }
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploadingImage(true);
    
    // Close the crop dialog first
    setShowCropDialog(false);
    
    try {
      // Optimize the image size before upload
      const optimizedBlob = await compressImage(croppedBlob);
      
      // Convert to base64 for upload
      const base64Image = await blobToBase64(optimizedBlob);
      
      try {
        const response = await fetch('/api/user/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64Image,
            email: userData.email // Include email for fallback authentication
          }),
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }
        
        const data = await response.json();
        
        // Update user data with the new image
        setUserData(prev => ({
          ...prev,
          image: base64Image
        }));
        
        // Refresh the session to update the image in navbar
        await updateSession();
        
        // Force refresh avatar by updating the key
        setImageKey(`image-${Date.now()}`);
        
        // Success notification
        toast({
          description: "Profile image updated successfully!",
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Failed to upload image",
        });
      } finally {
        setIsUploadingImage(false);
      }
    } catch (error) {
      console.error('Error handling crop:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error processing image",
      });
      setIsUploadingImage(false);
    }
  };

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
      
      // Handle physical info updates if changed
      if (
        physicalInfo.height !== initialPhysicalInfo.height ||
        physicalInfo.weight !== initialPhysicalInfo.weight ||
        physicalInfo.age !== initialPhysicalInfo.age ||
        physicalInfo.gender !== initialPhysicalInfo.gender ||
        physicalInfo.activityLevel !== initialPhysicalInfo.activityLevel
      ) {
        console.log('Saving physical info changes')

        try {
          const response = await fetch('/api/user/physical', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              height: physicalInfo.height ? Number(physicalInfo.height) : undefined,
              weight: physicalInfo.weight ? Number(physicalInfo.weight) : undefined,
              age: physicalInfo.age ? Number(physicalInfo.age) : undefined,
              gender: physicalInfo.gender || undefined,
              activityLevel: physicalInfo.activityLevel || undefined,
            }),
            credentials: 'include',
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to update physical info')
          }

          const { user: updatedUser, changes } = await response.json()

          // Update states
          setInitialPhysicalInfo({
            height: updatedUser.height?.toString() || "",
            weight: updatedUser.weight?.toString() || "",
            age: updatedUser.age?.toString() || "",
            gender: updatedUser.gender || "",
            activityLevel: updatedUser.activityLevel || ""
          })
          setPhysicalInfo({
            height: updatedUser.height?.toString() || "",
            weight: updatedUser.weight?.toString() || "",
            age: updatedUser.age?.toString() || "",
            gender: updatedUser.gender || "",
            activityLevel: updatedUser.activityLevel || ""
          })
          
          successCount++
          
          // Show success toast with details of what was updated
          if (changes && changes.length > 0) {
            const changeMessages = changes.map((change: Change) => {
              switch (change.field) {
                case 'weight':
                  return `Weight: ${change.value}kg`
                case 'height':
                  return `Height: ${change.value}cm`
                case 'age':
                  return `Age: ${change.value}`
                case 'gender':
                  return `Gender: ${change.value}`
                case 'activityLevel':
                  return `Activity Level: ${change.value}`
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
          console.error('Error updating physical info:', error)
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to update physical info"
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

  const [isPending, startTransition] = useTransition();

  const handleDeleteWorkoutsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(e.currentTarget);
    const types = formData.getAll('workoutTypes').map(t => t.toString());
    const confirmation = formData.get('confirmation')?.toString() || '';
    
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
          const successMessage = result.deletedCount === 0 
            ? `No workouts found matching the selected types: ${workoutTypesList}.`
            : `Successfully deleted ${result.deletedCount} ${result.deletedCount === 1 ? 'workout' : 'workouts'} ` +
              `of type${types.length > 1 ? 's' : ''}: ${workoutTypesList}.`;
          
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
      const response = await fetchWithAuth('/api/optimize-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          text, 
          field,
          context: {
            height: physicalInfo.height,
            weight: physicalInfo.weight,
            age: physicalInfo.age,
            gender: physicalInfo.gender,
            activityLevel: physicalInfo.activityLevel,
            location: aiPreferences.location,
            units: aiPreferences.units
          }
        })
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

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="space-y-8"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 p-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai-personalization">AI</TabsTrigger>
          <TabsTrigger value="danger-zone">Danger Zone</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
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
            
            <Card className="mb-4 sm:mb-8">
              <CardHeader>
                <CardTitle>Physical Information</CardTitle>
                <CardDescription>Used for workout and nutrition recommendations</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <form className="space-y-4">
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (cm)</Label>
                      <Input 
                        id="height" 
                        type="number" 
                        value={physicalInfo.height} 
                        onChange={(e) => setPhysicalInfo({...physicalInfo, height: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input 
                        id="weight" 
                        type="number" 
                        value={physicalInfo.weight} 
                        onChange={(e) => setPhysicalInfo({...physicalInfo, weight: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input 
                        id="age" 
                        type="number" 
                        value={physicalInfo.age} 
                        onChange={(e) => setPhysicalInfo({...physicalInfo, age: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select 
                        value={physicalInfo.gender} 
                        onValueChange={(value) => setPhysicalInfo({...physicalInfo, gender: value})}
                      >
                        <SelectTrigger id="gender">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="non-binary">Non-binary</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="activity-level">Activity Level</Label>
                      <Select 
                        value={physicalInfo.activityLevel} 
                        onValueChange={(value) => setPhysicalInfo({...physicalInfo, activityLevel: value})}
                      >
                        <SelectTrigger id="activity-level">
                          <SelectValue placeholder="Select your activity level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                          <SelectItem value="light">Lightly active (light exercise/sports 1-3 days/week)</SelectItem>
                          <SelectItem value="moderately-active">Moderately active (moderate exercise/sports 3-5 days/week)</SelectItem>
                          <SelectItem value="active">Very active (hard exercise/sports 6-7 days a week)</SelectItem>
                          <SelectItem value="extra-active">Extra active (very hard exercise, physical job or training twice a day)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {physicalError && (
                    <p className="text-sm text-destructive mb-2">{physicalError}</p>
                  )}
                  {physicalSuccess && (
                    <p className="text-sm text-green-600 mb-2">{physicalSuccess}</p>
                  )}
                </form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input 
                      id="current-password" 
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {passwordError && (
                    <div className="text-sm text-destructive">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="text-sm text-green-600">{passwordSuccess}</div>
                  )}

                  <Button 
                    onClick={handlePasswordUpdate}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Personalization Tab */}
        <TabsContent value="ai-personalization">
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
                    <div className="relative">
                      <Textarea 
                        id="training-preferences" 
                        placeholder="e.g. I enjoy running 3x per week and doing yoga on rest days. I prefer evening workouts and outdoor activities when weather permits." 
                        className="min-h-[80px] pr-[110px]"
                        value={aiPreferences.trainingPreferences}
                        onChange={(e) => handleAiPreferenceChange('trainingPreferences', e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-2 bottom-2 text-xs sm:text-sm px-2 sm:px-3 h-8"
                        onClick={() => optimizeTextWithAI('trainingPreferences', aiPreferences.trainingPreferences)}
                        disabled={isOptimizing.trainingPreferences || !aiPreferences.trainingPreferences}
                      >
                        {isOptimizing.trainingPreferences ? (
                          <>
                            <span className="animate-spin mr-1 sm:mr-2">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize<span className="hidden sm:inline"> with AI</span></>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Describe your preferred training style, frequency, and environment
                    </p>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fitness-goals">Fitness Goals</Label>
                    <div className="relative">
                      <Textarea 
                        id="fitness-goals" 
                        placeholder="e.g. Complete a half marathon in September, build upper body strength, improve my 5K time to under 25 minutes" 
                        className="min-h-[80px] pr-[110px]"
                        value={aiPreferences.fitnessGoals}
                        onChange={(e) => handleAiPreferenceChange('fitnessGoals', e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-2 bottom-2 text-xs sm:text-sm px-2 sm:px-3 h-8"
                        onClick={() => optimizeTextWithAI('fitnessGoals', aiPreferences.fitnessGoals)}
                        disabled={isOptimizing.fitnessGoals || !aiPreferences.fitnessGoals}
                      >
                        {isOptimizing.fitnessGoals ? (
                          <>
                            <span className="animate-spin mr-1 sm:mr-2">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize<span className="hidden sm:inline"> with AI</span></>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Describe your short and long-term fitness goals
                    </p>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dietary-preferences">Dietary Preferences</Label>
                    <div className="relative">
                      <Textarea 
                        id="dietary-preferences" 
                        placeholder="e.g. I follow a vegetarian diet with occasional fish. I try to limit processed foods and focus on whole grains and vegetables." 
                        className="min-h-[80px] pr-[110px]"
                        value={aiPreferences.dietaryPreferences}
                        onChange={(e) => handleAiPreferenceChange('dietaryPreferences', e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-2 bottom-2 text-xs sm:text-sm px-2 sm:px-3 h-8"
                        onClick={() => optimizeTextWithAI('dietaryPreferences', aiPreferences.dietaryPreferences)}
                        disabled={isOptimizing.dietaryPreferences || !aiPreferences.dietaryPreferences}
                      >
                        {isOptimizing.dietaryPreferences ? (
                          <>
                            <span className="animate-spin mr-1 sm:mr-2">⟳</span>
                            Optimizing...
                          </>
                        ) : (
                          <>Optimize<span className="hidden sm:inline"> with AI</span></>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Any dietary restrictions, preferences, or nutrition goals
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger-zone">
          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Actions that can't be undone</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-6 sm:space-y-8">
                {/* Delete Workouts Section */}
                <div>
                  <p className="text-lg font-semibold mb-2">Delete Workout Data</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This will permanently delete all selected workout types. This cannot be undone.
                  </p>
                  
                  <form onSubmit={handleDeleteWorkoutsSubmit}>
                    <div className="mb-4">
                      <Label className="mb-2 block">Select workout types to delete</Label>
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                        {["strength", "running", "swimming", "Swim", "cycling", "hiit", "flexibility", "other"].map((type) => (
                          <div key={type} className="flex items-center space-x-2 p-1.5 hover:bg-muted/50 rounded-md">
                            <Checkbox 
                              id={`workout-type-${type}`} 
                              name="workoutTypes"
                              value={type}
                              defaultChecked={selectedWorkoutTypes.includes(type)}
                            />
                            <label
                              htmlFor={`workout-type-${type}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                            >
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <Label htmlFor="confirm-delete">Type 'delete' to confirm</Label>
                      <Input
                        id="confirm-delete"
                        name="confirmation"
                        type="text"
                        className="mt-1"
                        placeholder="Type 'delete' to confirm"
                      />
                    </div>

                    {deleteWorkoutsError && (
                      <div className="text-sm text-destructive mb-2">{deleteWorkoutsError}</div>
                    )}
                    {deleteWorkoutsSuccess && (
                      <div className="text-sm text-green-600 mb-2">{deleteWorkoutsSuccess}</div>
                    )}

                    <Button 
                      type="submit"
                      variant="destructive"
                      disabled={isDeletingWorkouts}
                    >
                      {isDeletingWorkouts ? "Deleting..." : "Delete Selected Workout Types"}
                    </Button>
                  </form>
                </div>
                
                {/* Delete Account Section */}
                <div>
                  <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <Button variant="destructive">
                    <LucideLogOut className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="space-y-4 sm:space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>Manage your connected apps and services</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Strava</h3>
                    <div className="space-y-4">
                      <StravaImport />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add save button at the bottom, only when there are changes */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 sm:p-4 animate-in slide-in-from-bottom duration-300 shadow-lg z-50">
          <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <div className="flex flex-col space-y-1 sm:space-y-2 w-full sm:w-auto">
              <div className="flex items-center space-x-2 text-sm justify-center sm:justify-start">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="font-medium">Unsaved changes</p>
              </div>
              
              {/* Only show checkboxes for items that actually changed */}
              <div className="text-xs text-muted-foreground text-center sm:text-left flex flex-wrap justify-center sm:justify-start gap-x-2">
                {initialAiPreferences.location !== aiPreferences.location && aiPreferences.location && 
                  <span>✓ Location</span>}
                {initialAiPreferences.trainingPreferences !== aiPreferences.trainingPreferences && aiPreferences.trainingPreferences && 
                  <span>✓ Training</span>}
                {initialAiPreferences.fitnessGoals !== aiPreferences.fitnessGoals && aiPreferences.fitnessGoals && 
                  <span>✓ Goals</span>}
                {initialAiPreferences.dietaryPreferences !== aiPreferences.dietaryPreferences && aiPreferences.dietaryPreferences && 
                  <span>✓ Diet</span>}
                
                {initialPhysicalInfo.height !== physicalInfo.height && physicalInfo.height && 
                  <span>✓ Height</span>}
                {initialPhysicalInfo.weight !== physicalInfo.weight && physicalInfo.weight && 
                  <span>✓ Weight</span>}
                {initialPhysicalInfo.age !== physicalInfo.age && physicalInfo.age && 
                  <span>✓ Age</span>}
                {initialPhysicalInfo.gender !== physicalInfo.gender && physicalInfo.gender && 
                  <span>✓ Gender</span>}
                {initialPhysicalInfo.activityLevel !== physicalInfo.activityLevel && physicalInfo.activityLevel && 
                  <span>✓ Activity</span>}
              </div>
              
              {saveError && (
                <p className="text-sm text-destructive font-medium text-center sm:text-left">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="text-sm text-green-600 font-medium flex items-center justify-center sm:justify-start">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Changes saved successfully!
                </p>
              )}
            </div>
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              size="lg"
              className="transition-all w-full sm:w-auto mt-2 sm:mt-0"
            >
              {isSaving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : saveSuccess ? (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Saved!
                </span>
              ) : "Save All Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Add padding to prevent content from being hidden behind the fixed save button, only when the button is shown */}
      {hasChanges && <div className="h-24 sm:h-16" />}

      <ImageCropDialog
        isOpen={showCropDialog}
        onClose={() => setShowCropDialog(false)}
        onSave={handleCropComplete}
        imageUrl={previewUrl || ''}
      />
    </div>
  )
}
