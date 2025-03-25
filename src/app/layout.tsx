import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/components/providers/auth-provider"
import { MainHeader } from "@/components/main-header"
import { PersistentChat } from "@/components/persistent-chat"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ToastProvider } from "@/components/ui/toast"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata = {
  title: "Aivery - AI Fitness Coach",
  description: "Your personal AI fitness coach",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ToastProvider>
              <MainHeader user={session?.user || null} />
              <main className="min-h-screen pt-14">{children}</main>
              {session?.user && <PersistentChat />}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
