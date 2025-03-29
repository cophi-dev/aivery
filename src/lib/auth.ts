import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import dbConnect from "@/lib/db/mongodb"
import UserModel from "@/lib/db/models/user"
import { serializeMongoDoc } from "@/lib/db/utils"

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
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // Also store image in token if available
        if (user.image) {
          token.picture = user.image
        }
        // Store nickname if available
        if ((user as any).nickname) {
          token.nickname = (user as any).nickname
        }
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
          
          // If we have the image in the token, use it
          if (token.picture) {
            session.user.image = token.picture as string
          }
          
          // If we have the nickname in the token, use it
          if (token.nickname) {
            session.user.nickname = token.nickname as string
          }
          
          // Verify we have an ID
          if (!session.user.id) {
            console.error("Session missing user ID after setting");
            return { ...session, user: { id: '', email: '', name: '' } };
          }

          // Verify user still exists in database and get latest image and nickname
          await dbConnect();
          const userDoc = await UserModel.findOne({ _id: session.user.id }).select("image nickname").lean();
          
          if (!userDoc) {
            console.error("User no longer exists in database:", session.user.id);
            return { ...session, user: { id: '', email: '', name: '' } };
          }
          
          // Properly serialize MongoDB document to prevent buffer warnings
          const user = serializeMongoDoc(userDoc);
          
          // Update session with latest image and nickname from database
          if (user) {
            if (user.image) {
              session.user.image = user.image;
            }
            if (user.nickname) {
              session.user.nickname = user.nickname;
            } else {
              // Check if we have a nickname in the original document
              if ((userDoc as any).nickname) {
                session.user.nickname = (userDoc as any).nickname;
              }
            }
          }
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
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' in production for cross-domain
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Secure in production
        maxAge: 30 * 24 * 60 * 60, // 30 days
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined, // Use COOKIE_DOMAIN in production if set
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' in production for cross-domain
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Secure in production
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined, // Use COOKIE_DOMAIN in production if set
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' in production for cross-domain
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Secure in production
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined, // Use COOKIE_DOMAIN in production if set
      },
    },
  },
  debug: false, // Disable debug mode to reduce console logs
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
      nickname?: string | null
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
          credentials: "include", // Always include cookies with the request
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