import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Testing Supabase creator page query...')
    
    // Test the exact same query as the creator page
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select(`
        *,
        users (*),
        videos (*)
      `)
      .eq('username', 'theairfryergeekhg04')
      .single()

    console.log('📊 Creator page query result:', { creator, creatorError })

    if (creatorError) {
      console.error('❌ Creator query error:', creatorError)
      return NextResponse.json({ 
        success: false, 
        error: creatorError.message,
        details: creatorError,
        step: 'creator_query'
      })
    }

    if (!creator || !creator.is_active) {
      return NextResponse.json({ 
        success: false, 
        error: 'Creator not found or not active',
        creator,
        step: 'creator_validation'
      })
    }

    return NextResponse.json({ 
      success: true, 
      creator,
      message: 'Creator page query working!',
      step: 'success'
    })

  } catch (error) {
    console.error('❌ Test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'catch_error'
    })
  }
}