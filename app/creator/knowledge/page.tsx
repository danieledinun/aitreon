import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/database'
import KnowledgeBasePage from '@/components/knowledge-base/knowledge-base-page'

export default async function KnowledgePage() {
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

  // Get creator info
  const creator = await db.creator.findFirst({
    where: { userId: user.id }
  })

  if (!creator) {
    redirect('/creator/setup')
  }

  return (
    <KnowledgeBasePage 
      creator={creator}
    />
  )
}