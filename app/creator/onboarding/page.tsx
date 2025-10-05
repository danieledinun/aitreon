import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CreatorOnboardingFlow from '@/components/creator-onboarding-flow'

export default async function CreatorOnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?userType=creator')
  }

  // Check if creator already exists using Supabase
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email!)
    .single()

  if (!user) {
    redirect('/auth/signin?userType=creator')
  }

  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Simple logic: if user has completed onboarding, redirect to dashboard
  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('email', session.user.email!)
    .single()

  if (userData?.onboarding_completed) {
    console.log('🔄 User has completed onboarding, redirecting to creator dashboard')
    redirect('/creator')
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}