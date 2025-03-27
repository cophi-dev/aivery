import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongoose"
import User from "@/lib/db/models/user"
import WeightHistory from "@/lib/db/models/weightHistory"
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      )
    }

    await dbConnect()
    const user = await User.findOne({ email: session.user.email })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Track changes for response
    const changes = []

    // Check content type to determine how to parse the request
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      // Handle JSON data
      const data = await request.json()
      console.log('Received JSON data:', data)
      
      // Update physical information from JSON
      if (data.height !== undefined) {
        user.height = Number(data.height)
        changes.push({ field: 'height', value: data.height })
      }
      
      if (data.weight !== undefined) {
        const oldWeight = user.weight
        const newWeight = Number(data.weight)
        user.weight = newWeight
        changes.push({ field: 'weight', value: data.weight })

        // Store in weight history if this is the first weight entry or if weight has changed
        if (oldWeight === undefined || Math.abs(oldWeight - newWeight) > 0.01) {
          try {
            await WeightHistory.create({
              userId: user._id,
              weight: newWeight,
              date: new Date(),
            })
            console.log('Weight history entry created:', { oldWeight, newWeight })
          } catch (error) {
            console.error('Error creating weight history entry:', error)
            // Continue with the update even if weight history fails
          }
        }
      }

      if (data.age !== undefined) {
        user.age = Number(data.age)
        changes.push({ field: 'age', value: data.age })
      }

      if (data.gender !== undefined) {
        user.gender = data.gender
        changes.push({ field: 'gender', value: data.gender })
      }

      if (data.activityLevel !== undefined) {
        user.activityLevel = data.activityLevel
        changes.push({ field: 'activityLevel', value: data.activityLevel })
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await request.formData()
      
      // Handle image upload
      const image = formData.get('image') as File | null
      if (image) {
        try {
          const bytes = await image.arrayBuffer()
          const buffer = Buffer.from(bytes)

          // Create unique filename with timestamp
          const timestamp = Date.now()
          const filename = `profile-${timestamp}.png`
          
          // Save to public directory
          const publicDir = join(process.cwd(), 'public', 'uploads')
          const filepath = join(publicDir, filename)
          await writeFile(filepath, buffer)
          
          // Update user's image URL with absolute path
          const imageUrl = `/uploads/${filename}`
          user.image = imageUrl
          changes.push({ field: 'image', value: imageUrl })
        } catch (error: any) {
          console.error('Error saving image:', error)
          return NextResponse.json(
            { message: "Failed to save image" },
            { status: 500 }
          )
        }
      }

      // Update physical information
      const height = formData.get('height')
      if (height) {
        user.height = Number(height)
        changes.push({ field: 'height', value: height })
      }
      
      const weight = formData.get('weight')
      if (weight) {
        const oldWeight = user.weight
        const newWeight = Number(weight)
        user.weight = newWeight
        changes.push({ field: 'weight', value: weight })

        // Store in weight history if this is the first weight entry or if weight has changed
        if (oldWeight === undefined || Math.abs(oldWeight - newWeight) > 0.01) {
          try {
            await WeightHistory.create({
              userId: user._id,
              weight: newWeight,
              date: new Date(),
            })
            console.log('Weight history entry created:', { oldWeight, newWeight })
          } catch (error) {
            console.error('Error creating weight history entry:', error)
            // Continue with the update even if weight history fails
          }
        }
      }

      const age = formData.get('age')
      if (age) {
        user.age = Number(age)
        changes.push({ field: 'age', value: age })
      }

      const gender = formData.get('gender')
      if (gender) {
        user.gender = gender as string
        changes.push({ field: 'gender', value: gender })
      }

      const activityLevel = formData.get('activityLevel')
      if (activityLevel) {
        user.activityLevel = activityLevel as string
        changes.push({ field: 'activityLevel', value: activityLevel })
      }
    } else {
      return NextResponse.json(
        { message: "Unsupported content type" },
        { status: 400 }
      )
    }

    await user.save()

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        height: user.height,
        weight: user.weight,
        age: user.age,
        gender: user.gender,
        activityLevel: user.activityLevel,
        image: user.image
      },
      changes
    }, { status: 200 })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { message: "Failed to update profile", error: String(error) },
      { status: 500 }
    )
  }
} 