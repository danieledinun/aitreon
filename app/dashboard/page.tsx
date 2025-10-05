import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FanDashboard from '@/components/fan-dashboard'

export default async function DashboardPage() {
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

  // Default dashboard route - redirect to fan dashboard for all users
  // Users with creator profiles can access creator dashboard via direct URL
  redirect('/fan/dashboard')
}