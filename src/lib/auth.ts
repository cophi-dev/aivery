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
            console.log("Missing credentials");
            return null;
          }

          // Connect to database
          await dbConnect()

          // Find user with minimal data
          const user = await UserModel.findOne({ email: credentials.email }).select('+password name').lean(false)

          if (!user) {
            console.log("User not found:", credentials.email);
            return null;
          }
          
          const userPassword = (user as any).password
          if (!userPassword) {
            console.log("User has no password");
            return null;
          }

          const isPasswordValid = await compare(credentials.password, userPassword)

          if (!isPasswordValid) {
            console.log("Invalid password");
            return null;
          }
          
          // Log successful login
          console.log("User authenticated successfully:", credentials.email);
          
          // Return minimal user data
          const typedUser = user as any;
          
          return {
            id: typedUser._id.toString(),
            email: typedUser.email,
            name: typedUser.name,
          }
        } catch (error) {
          console.error('Authorization error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days to match route.ts
  },
  pages: {
    signIn: "/login",
    error: "/login", // Show login page with error param on auth errors
  },
  callbacks: {
    async jwt({ token, user }) {
      // Keep token minimal
      if (user) {
        console.log("Setting JWT token with user ID:", user.id);
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      try {
        // Keep session minimal
        if (session.user && token) {
          session.user.id = token.id as string
          session.user.name = token.name as string
          session.user.email = token.email as string
          
          // Verify we have an ID
          if (!session.user.id) {
            console.error("Session missing user ID after setting");
            return { ...session, user: { id: '', email: '', name: '' } };
          }

          // Verify user still exists in database
          await dbConnect();
          const user = await UserModel.findOne({ _id: session.user.id });
          
          if (!user) {
            console.error("User no longer exists in database:", session.user.id);
            return { ...session, user: { id: '', email: '', name: '' } };
          }
          
          console.log("Session created with user ID:", session.user.id);
        }
        return session;
      } catch (error) {
        console.error("Error in session callback:", error);
        return { ...session, user: { id: '', email: '', name: '' } };
      }
    }
  },
  // Keep cookie options minimal
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to false for localhost
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to false for localhost
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to false for localhost
      },
    },
  },
  debug: true, // Enable debug mode to see what's happening
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
      if (!session?.user) {
        console.warn("No session found on server side");
        return null;
      }
      return session.user;
    } 
    // If we're on the client side - use cached data when possible
    else {
      try {
        const session = await fetch("/api/auth/session", {
          // Add cache control to prevent over-fetching
          cache: "force-cache",
          next: { revalidate: 60 } // Revalidate every minute
        });
        
        if (!session.ok) {
          console.warn("Session fetch failed:", session.statusText);
          return null;
        }
        
        const data = await session.json();
        if (!data?.user) {
          console.warn("No user data in session response");
          return null;
        }
        
        return data.user;
      } catch (fetchError) {
        console.error("Error fetching session on client side:", fetchError);
        return null;
      }
    }
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
} 