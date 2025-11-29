import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get creator if exists (to clean up Stripe subscriptions)
    const { data: creator } = await supabase
      .from('creators')
      .select('id, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', userId)
      .single()

    // TODO: Cancel Stripe subscription if exists
    // if (creator?.stripe_subscription_id) {
    //   await stripe.subscriptions.cancel(creator.stripe_subscription_id)
    // }

    // Delete all related data (cascading deletes should handle most)
    if (creator) {
      // Delete creator's content chunks
      await supabase
        .from('content_chunks')
        .delete()
        .eq('creator_id', creator.id)

      // Delete videos
      await supabase
        .from('videos')
        .delete()
        .eq('creator_id', creator.id)

      // Delete chat sessions and messages (cascade will handle messages)
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('creator_id', creator.id)

      // Delete creator settings
      await supabase
        .from('ai_config')
        .delete()
        .eq('creator_id', creator.id)

      await supabase
        .from('voice_settings')
        .delete()
        .eq('creator_id', creator.id)

      await supabase
        .from('creator_suggested_questions')
        .delete()
        .eq('creator_id', creator.id)

      // Delete subscriptions
      await supabase
        .from('user_subscriptions')
        .delete()
        .eq('creator_id', creator.id)

      // Finally delete creator
      await supabase
        .from('creators')
        .delete()
        .eq('user_id', userId)
    }

    // Delete user's sessions
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId)

    // Delete user's accounts (OAuth connections)
    await supabase
      .from('accounts')
      .delete()
      .eq('user_id', userId)

    // Delete user's subscriptions (as a fan)
    await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', userId)

    // Finally delete user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
