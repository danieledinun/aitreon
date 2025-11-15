import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Checking onboarding status for user:', session.user.id)

    // First, check if user has already completed onboarding with a creator profile
    const { data: creator } = await supabase
      .from('creators')
      .select('id, username')
      .eq('user_id', session.user.id)
      .single()

    if (creator) {
      console.log('✅ Creator profile exists:', creator.username)

      // Check if they have any videos
      const { data: videos, count } = await supabase
        .from('videos')
        .select('id', { count: 'exact' })
        .eq('creator_id', creator.id)
        .limit(1)

      if (count && count > 0) {
        console.log('✅ Creator has videos, should redirect to dashboard')
        return NextResponse.json({
          shouldRedirect: true,
          redirectTo: '/creator'
        })
      }
    }

    // If no creator profile or no videos, check for completed YouTube job
    const { data: jobs, error } = await supabase
      .from('youtube_analysis_jobs')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0]
      console.log('✅ Found completed job:', job.id)

      return NextResponse.json({
        hasCompletedJob: true,
        jobId: job.id,
        channelUrl: job.channel_url,
        result: job.result
      })
    }

    console.log('ℹ️ No completed jobs found')
    return NextResponse.json({ hasCompletedJob: false })

  } catch (error) {
    console.error('Error checking for existing job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
