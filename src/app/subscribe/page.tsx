import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** Legacy billing URL — app is free; send users to register or dashboard */
export default async function SubscribePage() {
  const session = await getServerSession(authOptions)
  redirect(session?.user ? '/dashboard' : '/register')
}
