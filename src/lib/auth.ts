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
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Invalid credentials")
          }

          // Connect to database
          await dbConnect()

          // Find user with minimal data
          const user = await UserModel.findOne({ email: credentials.email }).select('+password name').lean(false)

          if (!user) {
            throw new Error("Invalid credentials")
          }
          
          const userPassword = (user as any).password
          if (!userPassword) {
            throw new Error("Invalid credentials")
          }

          const isPasswordValid = await compare(credentials.password, userPassword)

          if (!isPasswordValid) {
            throw new Error("Invalid credentials")
          }
          
          // Return minimal user data
          const typedUser = user as any;
          
          return {
            id: typedUser._id.toString(),
            email: typedUser.email,
            name: typedUser.name,
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
    maxAge: 8 * 60 * 60, // 8 hours (shorter session to prevent token bloat)
  },
  pages: {
    signIn: "/login",
    // No other custom pages
  },
  callbacks: {
    async jwt({ token, user }) {
      // Keep token minimal
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      // Keep session minimal
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
        session.user.email = token.email as string
      }
      return session
    }
  },
  // Keep cookie options minimal
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60, // Match session maxAge
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET
}

// Session extension to include ID
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