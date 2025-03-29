"use client"

import { useState, useEffect, useRef } from "react"
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

  // Split the name into first and last name
  const [firstName, lastName] = userData.name?.split(' ') || ['', '']

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

  // Update initial profile changes state to match current values
  useEffect(() => {
    setProfileChanges({
      firstName: firstName || '',
      lastName: lastName || '',
      email: userData.email || '',
      phone: '',
      nickname: userData.nickname || '',
    })
  }, [firstName, lastName, userData.email, userData.nickname])

  // Load user data and set initial physical info
  useEffect(() => {
    // Set hasChanges to false during initial loading
    setHasChanges(false)
    
    const loadUserData = async () => {
      try {
        setIsLoadingUserData(true)
        const response = await fetchWithAuth('/api/user')
        const data = await response.json()
        if (data.user) {
          // Set the full user object to access _id
          setUser(data.user)
          
          const newPhysicalInfo = {
            height: data.user.height?.toString() || "",
            weight: data.user.weight?.toString() || "",
            age: data.user.age?.toString() || "",
            gender: data.user.gender || "",
            activityLevel: data.user.activityLevel || ""
          }
          setPhysicalInfo(newPhysicalInfo)
          // Store initial values for comparison
          setInitialPhysicalInfo(newPhysicalInfo)
          
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
    loadUserData()
  }, [])

  useEffect(() => {
    if (session?.user) {
      console.log('Updating userData from session:', session.user)
      setUserData({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || '',
        nickname: (session.user as any).nickname || '',
      })
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
    try {
      // Handle image changes if there are any
      if (userData.image !== session?.user?.image) {
        console.log('Image has changed - ensuring it is saved properly');
        // The image is already uploaded in the handleCropComplete function
        // but we need to make sure the session is updated with the new image
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
      
      // Show success state
      setSaveSuccess(true)
      setHasChanges(false)
      
      // Force a session refresh to update the UI
      if (session) {
        try {
          await updateSession({
            ...session,
            user: {
              ...session.user,
              image: userData.image, // Make sure we have the latest image
              nickname: userData.nickname // Add nickname to session
            }
          })
          console.log('Session updated with latest user data including nickname')
          
          // Broadcast session update event
          const event = new Event('session-update')
          window.dispatchEvent(event)
        } catch (sessionError) {
          console.error('Failed to update session:', sessionError)
        }
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold mb-2">Settings</h1>
      <p className="text-xl text-muted-foreground mb-8">Manage your account preferences</p>

      <Tabs defaultValue="profile">
        <TabsList className="mb-8">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-6">
                <AvatarLoader 
                  name={userData.name}
                  size="lg"
                  refreshKey={imageKey}
                />
                <div className="ml-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mb-2"
                      onClick={() => {
                        setFileSizeError(null)
                        fileInputRef.current?.click()
                      }}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? "Uploading..." : "Upload Photo"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      JPG, GIF or PNG. Maximum size: 1MB. For best results, use a square image.
                    </p>
                    {fileSizeError && (
                      <p className="text-sm text-destructive">{fileSizeError}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Simple display of base64 data presence */}
              {userData.image && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground">
                    ✓ Profile image stored ({Math.round(userData.image.length / 1024)}KB)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" defaultValue={firstName} onChange={(e) => handleProfileChange('firstName', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" defaultValue={lastName} onChange={(e) => handleProfileChange('lastName', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input 
                    id="nickname" 
                    placeholder="Your display name"
                    value={profileChanges.nickname} 
                    onChange={(e) => handleProfileChange('nickname', e.target.value)} 
                  />
                  <p className="text-xs text-muted-foreground">This will be displayed across the dashboard and AI chats</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={userData.email} onChange={(e) => handleProfileChange('email', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="Enter your phone number" onChange={(e) => handleProfileChange('phone', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Add Nickname Debug Component */}
          <div className="mb-8">
            <UserNicknameDisplay />
          </div>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Physical Information</CardTitle>
              <CardDescription>Update your physical details for better tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUserData ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input 
                      id="height" 
                      type="number" 
                      value={physicalInfo.height}
                      onChange={(e) => setPhysicalInfo(prev => ({ ...prev, height: e.target.value }))}
                      placeholder="180" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input 
                      id="weight" 
                      type="number" 
                      value={physicalInfo.weight}
                      onChange={(e) => setPhysicalInfo(prev => ({ ...prev, weight: e.target.value }))}
                      placeholder="75" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input 
                      id="age" 
                      type="number" 
                      value={physicalInfo.age}
                      onChange={(e) => setPhysicalInfo(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="30" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select 
                      value={physicalInfo.gender} 
                      onValueChange={(value) => setPhysicalInfo(prev => ({ ...prev, gender: value }))}
                    >
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
                    <Select 
                      value={physicalInfo.activityLevel} 
                      onValueChange={(value) => setPhysicalInfo(prev => ({ ...prev, activityLevel: value }))}
                    >
                      <SelectTrigger id="activity-level">
                        <SelectValue placeholder="Select activity level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentary</SelectItem>
                        <SelectItem value="lightly-active">Lightly Active</SelectItem>
                        <SelectItem value="moderately-active">Moderately Active</SelectItem>
                        <SelectItem value="very-active">Very Active</SelectItem>
                        <SelectItem value="extra-active">Extra Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
                  <Input 
                    id="current-password" 
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
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

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
              <CardDescription>Manage your connected apps and services</CardDescription>
            </CardHeader>
            <CardContent>
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
        </TabsContent>
      </Tabs>

      {/* Add save button at the bottom, only when there are changes */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 animate-in slide-in-from-bottom duration-300">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="text-sm text-green-600">Changes saved successfully!</p>
              )}
            </div>
            <Button 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save All Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Add padding to prevent content from being hidden behind the fixed save button, only when the button is shown */}
      {hasChanges && <div className="h-16" />}

      <ImageCropDialog
        isOpen={showCropDialog}
        onClose={() => setShowCropDialog(false)}
        onSave={handleCropComplete}
        imageUrl={previewUrl || ''}
      />
    </div>
  )
}

