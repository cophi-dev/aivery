import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import dbConnect from "@/lib/db/mongoose"
import UserModel from "@/lib/db/models/user"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          console.log('Starting authorization for:', credentials?.email)
          
          if (!credentials?.email || !credentials?.password) {
            console.log('Missing credentials')
            throw new Error("Invalid credentials")
          }

          // Connect to MongoDB - this only needs to be done once
          // The connection will be cached for subsequent calls
          await dbConnect()
          console.log('Connected to database for auth')

          // Find user by email with minimal data - only select what we need
          const user = await UserModel.findOne({ email: credentials.email }).select('+password name').lean(false)
          console.log('Found user:', user ? 'Yes' : 'No')

          // Check for user existence first, then validate password
          if (!user) {
            console.log('User not found')
            throw new Error("Invalid credentials")
          }
          
          // Ensure password exists with type safety
          const userPassword = (user as any).password
          if (!userPassword) {
            console.log('Missing password')
            throw new Error("Invalid credentials")
          }

          // Compare passwords
          const isPasswordValid = await compare(credentials.password, userPassword)
          console.log('Password valid:', isPasswordValid)

          if (!isPasswordValid) {
            console.log('Invalid password')
            throw new Error("Invalid credentials")
          }

          console.log('Authorization successful')
          
          // Type assertion for the user object to fix TypeScript errors
          const typedUser = user as any;
          
          // Return minimal user data to keep JWT small
          return {
            id: typedUser._id.toString(),
            email: typedUser.email,
            name: typedUser.name,
            // Don't include large data in the token
          }
        } catch (error) {
          console.error('Authorization error:', error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours instead of 30 days
  },
  pages: {
    signIn: "/login",
    // Don't set other custom pages to avoid redirect loops
  },
  callbacks: {
    async jwt({ token, user }) {
      // Keep the JWT content minimal - just the essential user ID and info
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // No other data that might bloat the token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Only set the essential fields to keep the session small
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        // Remove any other data that might be present
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET
}

// Extend the next-auth session type to include the user id
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

// Get the current user server-side
export async function getSession() {
  return await getServerSession(authOptions);
}

// Use this to get the current user in both client and server contexts
export async function getCurrentUser() {
  try {
    // If we're on the server side (RSC or server action)
    if (typeof window === 'undefined') {
      const session = await getServerSession(authOptions);
      return session?.user;
    } 
    // If we're on the client side
    else {
      const session = await fetch("/api/auth/session");
      const data = await session.json();
      return data?.user;
    }
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
} 