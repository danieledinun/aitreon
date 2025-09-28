import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './database'

export async function requireUserType(
  userType: 'creator' | 'fan' | 'both',
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Get user type from database
      const actualUserType = await db.user.getUserType(session.user.id)
      
      // Check if user type is allowed
      if (userType !== 'both' && actualUserType !== userType) {
        return NextResponse.json(
          { 
            error: `Access denied. This feature requires ${userType} account.`,
            requiredType: userType,
            actualType: actualUserType
          },
          { status: 403 }
        )
      }

      // Add user type to session for handler
      const enrichedSession = {
        ...session,
        user: {
          ...session.user,
          userType: actualUserType
        }
      }

      return handler(req, enrichedSession)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }
}

export async function requireCreator(handler: (req: NextRequest, session: any) => Promise<NextResponse>) {
  return requireUserType('creator', handler)
}

export async function requireFan(handler: (req: NextRequest, session: any) => Promise<NextResponse>) {
  return requireUserType('fan', handler)
}

export async function requireAuth(handler: (req: NextRequest, session: any) => Promise<NextResponse>) {
  return requireUserType('both', handler)
}