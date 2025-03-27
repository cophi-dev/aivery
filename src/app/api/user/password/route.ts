import { NextResponse } from "next/server"
import { hash, compare } from "bcryptjs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongoose"
import UserModel from "@/lib/db/models/user"

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('Session user:', session?.user)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()
    console.log('Attempting to update password for:', session.user.email)

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "New password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    await dbConnect()
    console.log('Connected to database')

    // Find user with fresh data
    const user = await UserModel.findOne({ email: session.user.email }).select('+password').lean(false)
    console.log('Found user:', user ? 'Yes' : 'No')
    
    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Verify current password
    const isPasswordValid = await compare(currentPassword, user.password)
    console.log('Current password valid:', isPasswordValid)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 400 }
      )
    }

    // Hash and update new password
    const hashedPassword = await hash(newPassword, 10)
    console.log('New hashed password:', hashedPassword)
    
    try {
      // Use findOneAndUpdate for atomic operation
      const updateResult = await UserModel.findOneAndUpdate(
        { email: session.user.email },
        { $set: { password: hashedPassword } },
        { 
          new: true,          // Return the updated document
          runValidators: true // Run schema validations
        }
      ).select('+password')
      
      console.log('Update operation result:', {
        success: !!updateResult,
        oldPassword: user.password,
        newPassword: updateResult?.password,
        email: session.user.email
      })

      if (!updateResult) {
        console.error('Password update failed - no document returned')
        return NextResponse.json(
          { message: "Failed to update password" },
          { status: 500 }
        )
      }

      // Double check the update
      const verifyUser = await UserModel.findOne({ email: session.user.email }).select('+password')
      console.log('Verification check:', {
        passwordMatches: verifyUser?.password === hashedPassword,
        verifyPassword: verifyUser?.password,
        expectedPassword: hashedPassword
      })

      if (verifyUser?.password !== hashedPassword) {
        console.error('Password verification failed - passwords do not match')
        return NextResponse.json(
          { message: "Password update could not be verified" },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { message: "Password updated successfully" },
        { status: 200 }
      )
    } catch (updateError) {
      console.error('Error during password update:', updateError)
      return NextResponse.json(
        { message: "Failed to update password" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error updating password:", error)
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    )
  }
} 