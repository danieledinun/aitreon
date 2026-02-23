import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Verify cron auth
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('⏰ Social polling cron triggered...')

  try {
    const now = new Date()

    // Step 1: Reset daily counters if past midnight
    const { data: sessions } = await supabase
      .from('social_platform_sessions')
      .select('id, day_reset_at')

    if (sessions) {
      for (const session of sessions) {
        const resetAt = new Date(session.day_reset_at)
        if (now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000) {
          await supabase
            .from('social_platform_sessions')
            .update({
              comments_fetched_today: 0,
              replies_posted_today: 0,
              day_reset_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', session.id)
        }
      }
    }

    // Step 2: Ping the Railway automation service to wake up and poll
    const automationUrl = process.env.AUTOMATION_SERVICE_URL
    if (automationUrl) {
      try {
        const response = await fetch(`${automationUrl}/poll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.AUTOMATION_API_KEY || '',
          },
          body: JSON.stringify({ triggeredAt: now.toISOString() }),
        })

        if (!response.ok) {
          console.error(`Automation service responded with ${response.status}`)
        } else {
          console.log('Pinged automation service successfully')
        }
      } catch (err) {
        console.error('Failed to ping automation service:', err)
      }
    } else {
      console.log('AUTOMATION_SERVICE_URL not configured, skipping ping')
    }

    return NextResponse.json({
      success: true,
      message: 'Social polling cron completed',
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Error in social polling cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
