import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FanDashboard from '@/components/fan-dashboard'

export default async function FanDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?userType=fan')
  }

  // Check if user exists in database
  const { data: user } = await supabase
    .from('users')
    .select('id, onboarding_completed')
    .eq('email', session.user.email!)
    .single()

  if (!user) {
    redirect('/auth/signin?userType=fan')
  }

  // Check if this user is a creator (has creator profile)
  const { data: creator } = await supabase
    .from('creators')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // If user is a creator, redirect to creator dashboard
  if (creator) {
    redirect('/creator')
  }

  // This is a fan - show fan dashboard
  return <FanDashboard userId={user.id} />
}