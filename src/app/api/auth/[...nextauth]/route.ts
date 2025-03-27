import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// Simple handler with explicit logging for debugging
console.log("NextAuth route handler initialized")

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 