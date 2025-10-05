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

  // Fan dashboard should always be accessible to any user
  // Users can be both fans AND creators - they choose which experience to use
  return <FanDashboard userId={user.id} />
}