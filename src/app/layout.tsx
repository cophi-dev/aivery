import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { MainHeader } from "@/components/main-header";
import { PersistentChat } from "@/components/persistent-chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Aivery - Your AI Workout Partner",
  description: "Track your workouts and get AI-powered insights",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <MainHeader user={session?.user || null} />
          <main className="min-h-screen pt-14">
            {children}
          </main>
          {session?.user && <PersistentChat />}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
