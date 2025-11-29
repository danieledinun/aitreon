import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EmbeddedChat from '@/components/embedded-chat'
import CompactWidget from '@/components/compact-widget'

interface EmbedPageProps {
  params: {
    username: string
  }
  searchParams: {
    theme?: string
    color?: string
    showAvatar?: string
    greeting?: string
    welcome?: string
    avatar?: string
    logo?: string
    mode?: string
    buttonText?: string
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
  const showAvatar = searchParams.showAvatar !== 'false'
  const greetingText = searchParams.greeting
  const welcomeMessage = searchParams.welcome
  const customAvatar = searchParams.avatar
  const customLogo = searchParams.logo
  const widgetMode = searchParams.mode || 'full'
  const buttonText = searchParams.buttonText || 'Chat with me'

  const commonProps = {
    creator,
    theme,
    primaryColor,
    showAvatar,
    greetingText,
    welcomeMessage,
    customAvatar,
    customLogo,
    buttonText,
  }

  // Render compact widget or full chat based on mode
  if (widgetMode === 'compact') {
    return <CompactWidget {...commonProps} />
  }

  return <EmbeddedChat {...commonProps} />
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
