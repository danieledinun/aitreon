import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/database'
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

  // Check if creator already exists
  const user = await db.user.findUnique({
    where: { email: session.user.email! }
  })

  if (!user) {
    redirect('/auth/signin')
  }

  const creator = await db.creator.findUnique({
    where: { userId: user.id }
  })

  // If creator already exists, redirect to dashboard regardless of userType parameter
  // The creator profile is complete, no need for onboarding
  if (creator) {
    console.log('🔄 Onboarding page: Creator already exists, redirecting to dashboard')
    redirect('/creator')
  }

  return <CreatorOnboardingFlow userId={session.user.id} />
}