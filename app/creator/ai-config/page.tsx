import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/database'
import AiConfigPage from '@/components/ai-config/ai-config-page'

export default async function CreatorAiConfigPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  // Get user info
  const user = await db.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    redirect('/auth/signin')
  }

  // Get creator info separately
  const creator = await db.creator.findFirst({
    where: { user_id: user.id }
  })

  if (!creator) {
    redirect('/creator/setup')
  }

  return <AiConfigPage creatorId={creator.id} />
}