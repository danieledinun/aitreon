import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/database'
import AutoRepliesPage from '@/components/auto-replies/auto-replies-page'

export default async function CreatorAutoRepliesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    redirect('/auth/signin')
  }

  const creator = await db.creator.findFirst({
    where: { user_id: user.id }
  })

  if (!creator) {
    redirect('/creator/setup')
  }

  return <AutoRepliesPage creatorId={creator.id} />
}
