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

    console.log('🗑️ Clearing expired tokens for user:', session.user.email)

    // Delete all Google accounts for this user to force re-authentication
    const deletedAccounts = await db.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    console.log(`✅ Deleted ${deletedAccounts.count} expired Google account(s)`)

    return NextResponse.json({ 
      success: true,
      message: `Cleared ${deletedAccounts.count} expired token(s). Please sign in again to reconnect your YouTube account.`,
      needsSignIn: true
    })

  } catch (error) {
    console.error('Error clearing tokens:', error)
    return NextResponse.json({ 
      error: 'Failed to clear tokens',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}