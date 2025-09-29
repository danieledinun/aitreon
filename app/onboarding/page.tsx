import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import CreatorOnboardingFlow from '@/components/creator-onboarding-flow'

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: { userType?: string }
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

  // If creator already exists and is complete, redirect to dashboard
  // Check if creator has essential fields like username and display_name
  if (creator && creator.username && creator.display_name) {
    console.log('🔄 Onboarding page: Complete creator profile exists')
    console.log('🔄 Creator details:', { id: creator.id, username: creator.username, display_name: creator.display_name })

    // Add referer check to prevent infinite redirect loops
    // If we're being redirected from the creator dashboard, don't redirect back
    const referer = headers().get('referer')
    if (referer && referer.includes('/creator')) {
      console.log('⚠️ Preventing redirect loop - staying on onboarding page')
      // Don't redirect - let the user complete onboarding manually to fix any issues
    } else {
      console.log('🔄 Redirecting to dashboard')
      redirect('/creator')
    }
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}