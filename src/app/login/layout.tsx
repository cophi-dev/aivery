import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Aivery',
  description: 'Log in to your Aivery account',
};

// Use static rendering for login page
export const dynamic = 'force-static';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
      {children}
    </div>
  );
} 