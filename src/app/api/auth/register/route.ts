import { NextResponse } from "next/server"
import { hash } from "bcrypt"
import dbConnect from "@/lib/db/mongoose"
import UserModel from "@/lib/db/models/user"

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    // Simple validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Connect to database
    await dbConnect()

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email })
    
    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists with this email" },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await hash(password, 10)

    // Create new user
    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
    })

    // Return the user without password
    const newUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }

    return NextResponse.json(
      { message: "User registered successfully", user: newUser },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error in register API:", error)
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    )
  }
} 