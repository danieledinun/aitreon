import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import SuggestedQuestionsPage from '@/components/suggested-questions/suggested-questions-page'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function CreatorSuggestedQuestionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  // Get user info using Supabase
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', session.user.email)
    .single()

  if (!user) {
    redirect('/auth/signin')
  }

  // Get creator info using Supabase
  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!creator) {
    redirect('/creator/setup')
  }

  // Get suggested questions using Supabase
  const { data: suggestedQuestions } = await supabase
    .from('creator_suggested_questions')
    .select('*')
    .eq('creator_id', creator.id)
    .single()

  return <SuggestedQuestionsPage
    creatorId={creator.id}
    existingQuestions={suggestedQuestions || null}
  />
}