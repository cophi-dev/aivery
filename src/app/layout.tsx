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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            storageKey="aivery-theme"
            disableTransitionOnChange
          >
            <ToastProvider>
              <MainHeader />
              <main className="min-h-screen pt-14">{children}</main>
              {session?.user && <PersistentChat />}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
