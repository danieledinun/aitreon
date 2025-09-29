import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🎉 Completing onboarding for user:', session.user.email)

    // Update the user's onboarding_completed flag
    const { data, error } = await supabase
      .from('users')
      .update({ onboarding_completed: true })
      .eq('email', session.user.email)
      .select()

    if (error) {
      console.error('❌ Error updating onboarding status:', error)
      return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
    }

    console.log('✅ Onboarding completed successfully for user:', session.user.email)

    return NextResponse.json({ success: true, user: data?.[0] })
  } catch (error) {
    console.error('❌ Complete onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}