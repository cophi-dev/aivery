import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongoose";
import Exercise from "@/lib/db/models/exercise";
import { FilterQuery } from "mongoose";
import { IExercise } from "@/lib/db/models/exercise";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check for authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await dbConnect();

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const tagsParam = searchParams.get('tags');

    // Build the MongoDB filter object
    const filter: FilterQuery<IExercise> = {};

    if (tagsParam) {
      const tagsArray = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (tagsArray.length > 0) {
        filter.tags = { $all: tagsArray };
      }
    }

    console.log("Fetching exercises with filter:", filter);

    // Fetch exercises using the Mongoose model and the filter
    const dbExercises = await Exercise.find(filter)
                                      .sort({ name: 1 })
                                      .lean();

    return NextResponse.json(dbExercises);

  } catch (error) {
    console.error("Error in /api/exercises route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 