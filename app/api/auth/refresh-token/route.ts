import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's Google account
    const account = await db.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
    }

    if (!account.refresh_token) {
      return NextResponse.json({ 
        error: 'No refresh token available. Please reconnect your Google account.',
        needsReauth: true 
      }, { status: 400 })
    }

    console.log('🔄 Manual token refresh requested')
    console.log(`   • Account ID: ${account.id}`)
    console.log(`   • Current expires at: ${account.expires_at}`)
    console.log(`   • Has refresh token: ${!!account.refresh_token}`)

    try {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: account.refresh_token,
        }),
      })

      const responseText = await refreshResponse.text()
      console.log(`🔄 Refresh response status: ${refreshResponse.status}`)
      
      if (refreshResponse.ok) {
        const tokens = JSON.parse(responseText)
        const now = Math.floor(Date.now() / 1000)

        // Update the access token in the database
        await db.account.update({
          where: { id: account.id },
          data: {
            access_token: tokens.access_token,
            expires_at: now + tokens.expires_in,
            refresh_token: tokens.refresh_token || account.refresh_token,
          }
        })

        console.log('✅ Manual token refresh successful')
        return NextResponse.json({ 
          success: true,
          newExpiresAt: now + tokens.expires_in,
          message: 'Token refreshed successfully'
        })
      } else {
        console.error('❌ Manual token refresh failed:', responseText)
        return NextResponse.json({ 
          error: 'Token refresh failed',
          details: responseText,
          needsReauth: responseText.includes('invalid_grant') || responseText.includes('invalid_token')
        }, { status: 400 })
      }
    } catch (refreshError) {
      console.error('❌ Manual token refresh error:', refreshError)
      return NextResponse.json({ 
        error: 'Token refresh error',
        details: refreshError instanceof Error ? refreshError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Manual refresh token error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}