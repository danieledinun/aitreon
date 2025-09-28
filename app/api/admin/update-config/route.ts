import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from "@/lib/database"

const SUPER_ADMIN_EMAILS = [
  'the-air-fryer-g-9837@pages.plusgoogle.com', // Your current email
  'admin@aitrion.com'
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !SUPER_ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { creatorId, config } = await request.json()

    // Update or create AI configuration
    const aiConfig = await db.aiConfig.upsert({
      where: { creatorId },
      update: config,
      create: {
        creatorId,
        ...config
      }
    })

    return NextResponse.json({ success: true, config: aiConfig })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}