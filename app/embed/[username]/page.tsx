import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EmbeddedChat from '@/components/embedded-chat'

interface EmbedPageProps {
  params: {
    username: string
  }
  searchParams: {
    theme?: string
    color?: string
  }
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
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

  // Theme configuration from URL params
  const theme = searchParams.theme || 'light'
  const primaryColor = searchParams.color ? `#${searchParams.color}` : '#6366f1'

  return (
    <EmbeddedChat
      creator={creator}
      theme={theme}
      primaryColor={primaryColor}
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
