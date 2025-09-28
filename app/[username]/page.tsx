import { notFound, redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CreatorInteraction from '@/components/creator-interaction'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface CreatorPageProps {
  params: {
    username: string
  }
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  // Get creator with user and videos
  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select(`
      *,
      users (*),
      videos (*)
    `)
    .eq('username', params.username)
    .single()

  if (creatorError || !creator || !creator.is_active) {
    notFound()
  }

  // Get subscription count for this creator
  const { count: subscriptionCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', creator.id)
    .eq('status', 'ACTIVE')

  // Add count to creator object for compatibility
  creator._count = { subscriptions: subscriptionCount || 0 }

  const session = await getServerSession(authOptions)
  
  // Require authentication to access creator pages
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/${params.username}`)}`)
  }
  
  // Now we can safely fetch user-specific data since authentication is verified
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('creator_id', creator.id)
    .single()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateStr = today.toISOString().split('T')[0]

  const { data: dailyUsage } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('creator_id', creator.id)
    .eq('date', dateStr)
    .single()

  const isSubscribed = subscription?.status === 'ACTIVE'
  const messagesUsed = dailyUsage?.message_count || 0

  return (
    <CreatorInteraction
      creator={creator}
      isSubscribed={isSubscribed}
      messagesUsed={messagesUsed}
      session={session}
    />
  )
}

export async function generateStaticParams() {
  const { data: creators } = await supabase
    .from('creators')
    .select('username')
    .eq('is_active', true)

  if (!creators) return []

  return creators.map((creator) => ({
    username: creator.username,
  }))
}