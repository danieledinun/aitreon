import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()

    // Find or create user
    let user = await db.user.findUnique({
      where: { email }
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name,
          emailVerified: new Date(),
        }
      })
    }

    // In a real app, you'd set up a proper session here
    // For demo purposes, we'll just return success
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}