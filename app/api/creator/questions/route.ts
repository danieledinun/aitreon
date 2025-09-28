import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { questions } = await request.json()

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Questions array is required' }, { status: 400 })
    }

    // Filter out empty questions
    const validQuestions = questions.filter(q => q && q.trim())

    if (validQuestions.length === 0) {
      return NextResponse.json({ error: 'At least one question is required' }, { status: 400 })
    }

    // Get user and creator
    const user = await db.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const creator = await db.creator.findFirst({
      where: { user_id: user.id }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Save questions - create or update creator_suggested_questions
    try {
      // Check if questions already exist
      const existingQuestions = await db.creatorSuggestedQuestions.findUnique({
        where: { creatorId: creator.id }
      })

      const questionsData = {
        creatorId: creator.id,
        questions: validQuestions,
        updatedAt: new Date()
      }

      if (existingQuestions) {
        // Update existing
        await db.creatorSuggestedQuestions.update({
          where: { id: existingQuestions.id },
          data: questionsData
        })
      } else {
        // Create new
        await db.creatorSuggestedQuestions.create({
          data: {
            ...questionsData,
            createdAt: new Date()
          }
        })
      }

      return NextResponse.json({ 
        success: true,
        message: `Saved ${validQuestions.length} suggested questions`,
        questionCount: validQuestions.length
      })

    } catch (dbError) {
      console.error('Database error saving questions:', dbError)
      return NextResponse.json({ 
        error: 'Failed to save questions to database' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error saving questions:', error)
    return NextResponse.json({ 
      error: 'Failed to save questions. Please try again.' 
    }, { status: 500 })
  }
}