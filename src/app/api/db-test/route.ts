import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';

export const dynamic = 'force-dynamic'; // Ensure it runs dynamically

export async function GET() {
    console.log("--- DB Connection Test Request Received ---");
    let connectionError = null;
    let connectionSuccess = false;

    try {
        console.log("Attempting dbConnect()...");
        await dbConnect();
        console.log("dbConnect() completed successfully.");
        connectionSuccess = true;
    } catch (error) {
        console.error("!!! Error during dbConnect() test !!!");
        if (error instanceof Error) {
            console.error("Error Name:", error.name);
            console.error("Error Message:", error.message);
            console.error("Error Stack:", error.stack);
            connectionError = { name: error.name, message: error.message };
        } else {
            console.error("Non-Error Thrown:", error);
            connectionError = { message: "An unknown error occurred during connection." };
        }
    }

    if (connectionSuccess) {
        return NextResponse.json({ success: true, message: "Database connection successful." });
    } else {
        return NextResponse.json({ success: false, message: "Database connection failed.", error: connectionError }, { status: 500 });
    }
}

