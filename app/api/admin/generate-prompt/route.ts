import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from "@/lib/database"
import { RAGService } from '@/lib/rag-service'

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

    const { creatorId, sampleQuery } = await request.json()

    // Generate the complete system prompt using the actual RAG service logic
    const prompt = await RAGService.generateSystemPromptForAdmin(
      creatorId,
      sampleQuery || "What's your best advice?",
      `Sample context from your videos:

Video: "How to Build a Successful YouTube Channel" (2:15-3:45)
Content: "The key to growing on YouTube is consistency and providing real value to your audience. I've seen creators grow from zero to millions by focusing on solving specific problems for their viewers..."

Video: "My Top 5 Creator Tips" (0:30-1:20)
Content: "First tip - authenticity always wins. Don't try to be someone you're not. Your unique perspective is what makes you valuable. Second, invest in good audio quality..."

Video: "Dealing with Creator Burnout" (5:20-6:10)
Content: "Burnout is real, and I've experienced it multiple times. The solution isn't to push through it - it's to recognize the signs early and take strategic breaks..."

[Additional context would be dynamically inserted based on search results for the user's query: "${sampleQuery || "What's your best advice?"}"]`
    )

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Error generating prompt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}