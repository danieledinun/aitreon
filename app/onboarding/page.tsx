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

  // If creator already exists and is complete, redirect to dashboard
  // Check if creator has essential fields like username and display_name
  if (creator && creator.username && creator.display_name) {
    console.log('🔄 Onboarding page: Complete creator profile exists')
    console.log('🔄 Creator details:', { id: creator.id, username: creator.username, display_name: creator.display_name })

    // Check if we came from dashboard to prevent infinite redirect loops
    const fromDashboard = searchParams.from === 'dashboard'
    if (fromDashboard) {
      console.log('⚠️ Preventing redirect loop - came from dashboard, staying on onboarding page')
      // Don't redirect back to dashboard - let the user complete onboarding manually to fix any data issues
    } else {
      console.log('🔄 Redirecting complete creator to dashboard')
      redirect('/creator')
    }
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}