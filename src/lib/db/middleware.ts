import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import dbConnect from './mongoose';

// A middleware helper for API routes to ensure DB connection
export async function withDatabase(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Ensure we have a connection to the database, reusing existing one if possible
    await dbConnect();
    
    // Process the request with the handler
    return await handler(request);
  } catch (error) {
    console.error('Database operation error:', error);
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    );
  }
}

// A decorator for repository functions to ensure DB connection
export function withDbConnection<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    // Ensure DB connection before executing the function
    await dbConnect();
    return fn(...args);
  };
} 