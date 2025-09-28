import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userType } = await request.json()
    
    if (!userType || !['creator', 'fan'].includes(userType)) {
      return NextResponse.json(
        { error: 'Invalid user type' },
        { status: 400 }
      )
    }

    // For now, we'll allow all sign-ins and let the auth flow handle user type assignment
    // In a more strict implementation, you could check against existing user records
    // and prevent users from switching types

    console.log(`✅ User type validation passed: ${userType}`)
    
    return NextResponse.json({ 
      success: true, 
      message: `User type '${userType}' is valid` 
    })
    
  } catch (error) {
    console.error('❌ User type validation error:', error)
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    )
  }
}