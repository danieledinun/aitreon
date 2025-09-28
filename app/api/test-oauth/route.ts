import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const nextAuthUrl = process.env.NEXTAUTH_URL
  
  return NextResponse.json({
    hasGoogleClientId: !!googleClientId,
    googleClientIdLength: googleClientId?.length || 0,
    hasGoogleClientSecret: !!googleClientSecret,
    googleClientSecretLength: googleClientSecret?.length || 0,
    nextAuthUrl,
    redirectUri: `${nextAuthUrl}/api/auth/callback/google`
  })
}