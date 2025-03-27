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

          // Find user by email with fresh data
          const user = await UserModel.findOne({ email: credentials.email }).select('+password image name').lean(false)
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
          
          return {
            id: typedUser._id.toString(),
            email: typedUser.email,
            name: typedUser.name,
            image: typedUser.image || null,
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
    maxAge: 24 * 60 * 60, // Reduce to 1 day instead of 30 days to keep tokens smaller
  },
  jwt: {
    // Make the JWT smaller with shorter expiry
    maxAge: 24 * 60 * 60, // 1 day
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // User object is only provided on sign in
        token.id = user.id
        
        // Store minimal data in the token
        token.hasImage = !!user.image
        
        // Only keep the user's name, nothing else
        if (user.name) {
          token.name = user.name
        }
        
        // Remove all unnecessary fields to keep token small
        delete token.picture
        delete token.email  // Remove email from token too
        delete token.sub    // Don't need the sub claim
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Set user ID properly
        session.user.id = token.id as string
        
        // Copy name from token if available
        if (token.name) {
          session.user.name = token.name as string
        }
        
        // Set hasImage flag rather than the actual image data
        session.user.hasImage = !!token.hasImage

        // Remove unnecessary data to reduce header size
        session.user.image = null
        delete (session.user as any).email  // Also delete email from session
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
      hasImage: boolean
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