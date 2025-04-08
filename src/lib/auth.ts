import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import StravaProvider from "next-auth/providers/strava"
import { compare } from "bcryptjs"
import dbConnect from "@/lib/db/mongodb"
import UserModel from "@/lib/db/models/user"
import { serializeMongoDoc } from "@/lib/db/utils"

// Add debug info about cookie domain
const cookieDomain = process.env.COOKIE_DOMAIN;
console.log('[AUTH CONFIG] Environment:', process.env.NODE_ENV);
console.log('[AUTH CONFIG] Cookie domain:', cookieDomain || 'Not set');
console.log('[AUTH CONFIG] NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'Not set');

export const authOptions: NextAuthOptions = {
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read_all,activity:read_all",
          approval_prompt: "auto",
          response_type: "code",
        },
      },
    }),
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
    async jwt({ token, trigger, user, account }) {
      try {
        if (account && user) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at;
          token.providerAccountId = account.providerAccountId;
          token.provider = account.provider;
          console.log(`[AUTH] Added OAuth account details to token for provider: ${account.provider}`);
        }
        
        if (trigger === "signIn" && user) {
          // Add user ID to token
          token.id = user.id;
          
          // Get complete user data including nickname
          await dbConnect();
          const userData = await UserModel.findById(user.id).select('nickname').lean();
          
          if (userData) {
            // Add nickname to token if it exists in the database
            if ((userData as any).nickname) {
              token.nickname = (userData as any).nickname;
              console.log(`[AUTH] Added nickname to token: ${token.nickname}`);
            }
          }
        }
        
        // Always verify/update the nickname in the token on any token update after sign-in
        if (token.id && trigger !== "signIn") {
          try {
            await dbConnect();
            const freshUserData = await UserModel.findById(token.id).select('nickname').lean();
            
            if (freshUserData && (freshUserData as any).nickname) {
              // Update nickname in token if it changed or wasn't set
              const nickname = (freshUserData as any).nickname;
              if (nickname !== token.nickname) {
                console.log(`[AUTH] Updating nickname in token from ${token.nickname} to ${nickname}`);
                token.nickname = nickname;
              }
            }
          } catch (error) {
            console.error("[AUTH] Error refreshing nickname in token:", error);
          }
        }
        
        return token;
      } catch (error) {
        console.error("[AUTH] Token callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token) {
           session.accessToken = token.accessToken as string | undefined;
           session.provider = token.provider as string | undefined;
        }
        
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
            console.log(`[AUTH] Added nickname to session from token: ${session.user.nickname}`);
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
            
            // Always use the most up-to-date nickname from the database
            if ((userDoc as any).nickname) {
              const nickname = (userDoc as any).nickname;
              if (nickname !== session.user.nickname) {
                console.log(`[AUTH] Updating nickname in session from ${session.user.nickname} to ${nickname}`);
                session.user.nickname = nickname;
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        // Temporarily test SameSite=None to diagnose cookie sending issue
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // MUST be true for SameSite=None
        maxAge: 30 * 24 * 60 * 60,
        domain: undefined, 
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax', // Keep others as lax
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // Keep others as lax
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined,
      },
    },
  },
  debug: true, // Enable debug mode temporarily to diagnose issues
  secret: process.env.NEXTAUTH_SECRET
}

// Session extension to include ID AND accessToken/provider
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: string;
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      nickname?: string | null
    }
  }
}

// Add JWT extension if using JWT strategy
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    nickname?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    providerAccountId?: string;
    provider?: string;
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

// Add a debug route to get auth session status
export function getDebugAuthStatus() {
  return {
    status: 'enabled',
    nextAuthVersion: '4.22.1',
    providers: ['google', 'credentials'],
    sessionStrategy: 'jwt',
    timestamp: new Date().toISOString(),
  };
} 