'use client';

import { useSession } from 'next-auth/react';

interface UserNicknameDisplayProps {
  fallback?: string;
}

export default function UserNicknameDisplay({ fallback }: UserNicknameDisplayProps) {
  const { data: session } = useSession();
  
  if (!session?.user) {
    return fallback || null;
  }

  return session.user.nickname || session.user.name || fallback || 'User';
} 