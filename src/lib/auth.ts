import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcrypt"
import dbConnect from "./db/mongoose"
import UserModel from "./db/models/user"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        await dbConnect()
        
        const user = await UserModel.findOne({ email: credentials.email })
        
        if (!user || !user.password) {
          throw new Error("No user found with this email")
        }
        
        const passwordMatch = await compare(credentials.password, user.password)
        
        if (!passwordMatch) {
          throw new Error("Incorrect password")
        }
        
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
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

// Use this on the client side to get the current user
export async function getCurrentUser() {
  try {
    const session = await fetch("/api/auth/session");
    const data = await session.json();
    return data?.user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
} 