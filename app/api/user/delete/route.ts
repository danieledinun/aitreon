import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

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

    // Cancel Stripe subscription if exists
    if (creator?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(creator.stripe_subscription_id)
        console.log(`Canceled Stripe subscription ${creator.stripe_subscription_id} for user ${userId}`)
      } catch (stripeError) {
        console.error('Error canceling Stripe subscription during account deletion:', stripeError)
        // Continue with deletion even if Stripe fails
      }
    }

    // Optionally delete Stripe customer (to remove payment methods)
    if (creator?.stripe_customer_id) {
      try {
        await stripe.customers.del(creator.stripe_customer_id)
        console.log(`Deleted Stripe customer ${creator.stripe_customer_id} for user ${userId}`)
      } catch (stripeError) {
        console.error('Error deleting Stripe customer during account deletion:', stripeError)
        // Continue with deletion even if Stripe fails
      }
    }

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
