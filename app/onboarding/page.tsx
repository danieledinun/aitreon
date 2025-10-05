import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import CreatorOnboardingFlow from '@/components/creator-onboarding-flow'

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: { userType?: string; from?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  // If this is a fan, redirect them to the fan dashboard immediately
  if (searchParams.userType === 'fan') {
    redirect('/fan/dashboard')
  }

  // Check if creator already exists using Supabase
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email!)
    .single()

  if (!user) {
    redirect('/auth/signin')
  }

  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Only show creator onboarding if user explicitly chose to be a creator
  // AND hasn't completed onboarding yet
  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('email', session.user.email!)
    .single()

  // If user has completed onboarding AND has a creator profile, redirect to creator dashboard
  if (userData?.onboarding_completed && creator) {
    console.log('🔄 Creator has completed onboarding, redirecting to creator dashboard')
    redirect('/creator')
  }

  // If user has completed onboarding but NO creator profile, they're a fan
  if (userData?.onboarding_completed && !creator) {
    console.log('🔄 Fan user accessing onboarding - redirecting to fan dashboard')
    redirect('/fan/dashboard')
  }

  // If no userType specified or userType is fan, redirect to fan dashboard
  if (!searchParams.userType || searchParams.userType === 'fan') {
    console.log('🔄 No creator intent detected - redirecting to fan dashboard')
    redirect('/fan/dashboard')
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}