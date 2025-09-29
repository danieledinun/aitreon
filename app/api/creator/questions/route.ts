import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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
    const { data: user } = await supabase
      .from('user')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: creator } = await supabase
      .from('creator')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    // Save questions - create or update creator_suggested_questions
    try {
      // Check if questions already exist
      const { data: existingQuestions } = await supabase
        .from('creator_suggested_questions')
        .select('*')
        .eq('creator_id', creator.id)
        .single()

      const questionsData = {
        creator_id: creator.id,
        questions: validQuestions,
        updated_at: new Date().toISOString()
      }

      if (existingQuestions) {
        // Update existing
        await supabase
          .from('creator_suggested_questions')
          .update(questionsData)
          .eq('id', existingQuestions.id)
      } else {
        // Create new
        await supabase
          .from('creator_suggested_questions')
          .insert({
            ...questionsData,
            created_at: new Date().toISOString()
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