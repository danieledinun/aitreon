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

  // Simple logic: if user has completed onboarding, redirect to dashboard
  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('email', session.user.email!)
    .single()

  if (userData?.onboarding_completed) {
    console.log('🔄 User has completed onboarding, redirecting to dashboard')
    redirect('/creator')
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}