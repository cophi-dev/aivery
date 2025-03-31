import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import UserModel from "@/lib/db/models/user"

export async function PUT(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error("Authentication failed in profile update route")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Parse request body
    const data = await request.json()
    const { firstName, lastName, email, nickname } = data

    // Connect to database
    await dbConnect()

    // Find user
    const user = await UserModel.findById(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Track changes
    const changes = []

    // Update name if both first and last name are provided
    if (firstName && lastName) {
      const fullName = `${firstName} ${lastName}`.trim()
      if (user.name !== fullName) {
        user.name = fullName
        changes.push({ field: 'name', value: fullName })
      }
    }

    // Update email if changed and not empty
    if (email && email !== user.email) {
      user.email = email
      changes.push({ field: 'email', value: email })
    }

    // Update nickname if provided
    if (nickname !== undefined) {
      user.nickname = nickname
      changes.push({ field: 'nickname', value: nickname })
    }

    // Save changes
    if (changes.length > 0) {
      await user.save()
      console.log(`Updated profile for user ${session.user.id} with ${changes.length} changes`)
    } else {
      console.log(`No changes detected for user ${session.user.id}`)
    }

    return NextResponse.json({ 
      message: "Profile updated successfully",
      user: {
        name: user.name,
        email: user.email,
        nickname: user.nickname
      },
      changes
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
} 