import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    // Get creator by username
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('username', params.username)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Get suggested questions for this creator
    const { data: suggestedQuestions, error: questionsError } = await supabase
      .from('creator_suggested_questions')
      .select('questions')
      .eq('creator_id', creator.id)
      .single()

    if (questionsError || !suggestedQuestions?.questions) {
      // Return default questions if none configured
      return NextResponse.json({
        questions: [
          { id: '1', question: 'Hi there 👋', category: 'greeting' },
          { id: '2', question: 'What can you help me with?', category: 'general' },
          { id: '3', question: 'Tell me more about yourself', category: 'general' }
        ]
      })
    }

    return NextResponse.json({
      questions: Array.isArray(suggestedQuestions.questions)
        ? suggestedQuestions.questions
        : []
    })

  } catch (error) {
    console.error('Error fetching suggested questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggested questions' },
      { status: 500 }
    )
  }
}
