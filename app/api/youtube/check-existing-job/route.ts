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

    console.log('🔍 Checking for existing completed YouTube job for user:', session.user.id)

    // Get the most recent completed job for this user
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
