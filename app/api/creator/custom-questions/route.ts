import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const suggestedQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1).max(200),
  description: z.string().max(500).optional().default('')
})

const updateSuggestedQuestionsSchema = z.object({
  creatorId: z.string(),
  questions: z.array(suggestedQuestionSchema)
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { creatorId, questions } = updateSuggestedQuestionsSchema.parse(body)

    // Verify user owns this creator
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator || creator.id !== creatorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Filter out empty questions and limit to 10
    const validQuestions = questions
      .filter(q => q.question.trim().length > 0)
      .slice(0, 10)

    // Upsert the suggested questions
    const { error } = await supabase
      .from('creator_suggested_questions')
      .upsert({
        creator_id: creatorId,
        questions: validQuestions
      })

    if (error) {
      console.error('❌ Supabase error saving suggested questions:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`✅ Updated custom suggested questions for creator ${creatorId}: ${validQuestions.length} questions`)

    return NextResponse.json({
      success: true,
      questionsCount: validQuestions.length,
      message: `Saved ${validQuestions.length} suggested questions`
    })

  } catch (error) {
    console.error('❌ Error saving custom suggested questions:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// GET endpoint to retrieve custom suggested questions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID required' }, { status: 400 })
    }

    const { data: suggestedQuestions } = await supabase
      .from('creator_suggested_questions')
      .select('*')
      .eq('creator_id', creatorId)
      .single()

    if (!suggestedQuestions) {
      return NextResponse.json({
        success: true,
        questions: [],
        message: 'No custom suggested questions found'
      })
    }

    const questions = typeof suggestedQuestions.questions === 'string' 
      ? JSON.parse(suggestedQuestions.questions) 
      : suggestedQuestions.questions

    return NextResponse.json({
      success: true,
      questions,
      questionsCount: questions.length
    })

  } catch (error) {
    console.error('❌ Error retrieving custom suggested questions:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}