import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"
import WeightHistory from "@/lib/db/models/weightHistory"
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error("Authentication failed in physical info GET route")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("Fetching physical info for user:", session.user.id)

    await dbConnect()

    const user = await User.findById(session.user.id)
      .select('height weight age gender activityLevel')
      .lean()
    
    if (!user) {
      console.error("User not found in physical info route")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("Found physical info:", user)

    return NextResponse.json({ 
      height: user.height,
      weight: user.weight, 
      age: user.age,
      gender: user.gender,
      activityLevel: user.activityLevel
    })
  } catch (error) {
    console.error("Error fetching physical info:", error)
    return NextResponse.json(
      { error: "Failed to fetch physical info" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error("Authentication failed in physical info PUT route")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const data = await request.json()
    const { height, weight, age, gender, activityLevel } = data

    console.log("Updating physical info for user:", session.user.id, data)

    await dbConnect()

    const user = await User.findById(session.user.id)
    
    if (!user) {
      console.error("User not found in physical info PUT route")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const changes = []

    if (height !== undefined && user.height !== height) {
      user.height = height
      changes.push({ field: 'height', value: height })
    }

    if (weight !== undefined && user.weight !== weight) {
      user.weight = weight
      changes.push({ field: 'weight', value: weight })
    }

    if (age !== undefined && user.age !== age) {
      user.age = age
      changes.push({ field: 'age', value: age })
    }

    if (gender !== undefined && user.gender !== gender) {
      user.gender = gender
      changes.push({ field: 'gender', value: gender })
    }

    if (activityLevel !== undefined && user.activityLevel !== activityLevel) {
      user.activityLevel = activityLevel
      changes.push({ field: 'activityLevel', value: activityLevel })
    }

    if (changes.length > 0) {
      await user.save()
      console.log(`Updated physical info for user ${session.user.id} with ${changes.length} changes:`, changes)
    } else {
      console.log(`No physical info changes detected for user ${session.user.id}`)
    }

    return NextResponse.json({ 
      message: "Physical info updated successfully",
      user: {
        height: user.height,
        weight: user.weight,
        age: user.age,
        gender: user.gender,
        activityLevel: user.activityLevel
      },
      changes
    })
  } catch (error) {
    console.error("Error updating physical info:", error)
    return NextResponse.json(
      { error: "Failed to update physical info" },
      { status: 500 }
    )
  }
} 