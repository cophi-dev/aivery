import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"
import WeightHistory from "@/lib/db/models/weightHistory"

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    // Get weight history for the last 6 months by default
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const weightHistory = await WeightHistory.find({
      userId: user._id,
      date: { $gte: sixMonthsAgo }
    }).sort({ date: -1 })

    return NextResponse.json({
      history: weightHistory.map(entry => ({
        weight: entry.weight,
        date: entry.date,
        note: entry.note
      }))
    })
  } catch (error) {
    console.error("Error fetching weight history:", error)
    return NextResponse.json(
      { message: "Failed to fetch weight history" },
      { status: 500 }
    )
  }
} 