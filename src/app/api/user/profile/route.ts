import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"
import { toClientData } from "@/lib/db/utils"
import mongoose from "mongoose"

export async function PUT(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Connect to database
    await dbConnect()
    
    // Find the user by ID
    const user = await User.findById(session.user.id)

    // If user not found, return 404
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Track changes for response
    const changes = []

    // Get data from request
    const data = await request.json()
    console.log('Received profile update data:', data)
    
    // Update fields if they exist in the request
    if (data.firstName !== undefined || data.lastName !== undefined) {
      // Construct the full name
      const firstName = data.firstName || user.name.split(' ')[0]
      const lastName = data.lastName || (user.name.split(' ').length > 1 ? user.name.split(' ').slice(1).join(' ') : '')
      const fullName = `${firstName} ${lastName}`.trim()
      
      if (fullName !== user.name) {
        user.name = fullName
        changes.push({ field: 'name', value: fullName })
      }
    }
    
    if (data.nickname !== undefined && data.nickname !== user.nickname) {
      user.nickname = data.nickname
      changes.push({ field: 'nickname', value: data.nickname })
    }
    
    if (data.email !== undefined && data.email !== user.email) {
      // Note: In a real app, you would probably want to verify this email first
      user.email = data.email
      changes.push({ field: 'email', value: data.email })
    }
    
    // Only save if there are changes
    if (changes.length > 0) {
      await user.save()
      
      // As a fallback, try a direct MongoDB update
      if (data.nickname && changes.some(c => c.field === 'nickname')) {
        try {
          // Get connection and use type assertion for TypeScript
          const conn = mongoose.connection;
          const db = conn.db as any;
          
          if (!db) {
            console.error('Database not available for direct update')
            return
          }
          
          const collection = db.collection('users')
          
          // Update using direct MongoDB command
          await collection.updateOne(
            { _id: new mongoose.Types.ObjectId(session.user.id) },
            { $set: { nickname: data.nickname } }
          )
        } catch (directUpdateError) {
          console.error('Error in direct MongoDB update:', directUpdateError)
        }
      }
    }
    
    // Return updated user data and changes
    return NextResponse.json({
      message: "Profile updated successfully",
      user: toClientData(user),
      changes
    }, { status: 200 })
    
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    )
  }
} 