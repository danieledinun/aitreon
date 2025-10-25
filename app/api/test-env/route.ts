import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    YOUTUBE_SERVICE_URL: process.env.YOUTUBE_SERVICE_URL || 'NOT SET',
    hasVariable: !!process.env.YOUTUBE_SERVICE_URL,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('YOUTUBE'))
  })
}
