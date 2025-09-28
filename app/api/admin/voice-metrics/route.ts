import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'

// Admin emails for access control
const ADMIN_EMAILS = [
  'admin@aitrion.com',
  'the-air-fryer-g-9837@pages.plusgoogle.com'
]

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'admin-secret-key'

interface VoiceMetrics {
  room_name: string
  user_id: string
  session_start: string
  session_duration: number
  total_turns: number
  average_eou_delay: number
  total_response_time: number
  total_user_speech_time: number
  total_ai_speech_time: number
  turns: Array<{
    turn_number: number
    timestamp: string
    user_speech_duration: number
    eou_delay: number
    ai_processing_time: number
    total_turn_time: number
  }>
}

async function checkAdminAuth(request: NextRequest) {
  // Check for admin token first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, JWT_SECRET) as any
      if (decoded.role === 'admin') {
        return { isAdmin: true, email: 'admin@aitrion.com' }
      }
    } catch (error) {
      // Invalid token, continue to NextAuth check
    }
  }

  // Fallback to NextAuth session
  const session = await getServerSession(authOptions)
  if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
    return { isAdmin: true, email: session.user.email }
  }

  return { isAdmin: false, email: null }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const { isAdmin, email } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Read metrics files from /tmp directory
    const metricsDir = '/tmp'
    const allMetrics: VoiceMetrics[] = []

    try {
      const files = await fs.readdir(metricsDir)
      const metricsFiles = files.filter(file => file.startsWith('voice_metrics_') && file.endsWith('.json'))

      console.log(`📊 Found ${metricsFiles.length} voice metrics files`)

      // Read and parse metrics files
      for (const file of metricsFiles.slice(0, limit)) {
        try {
          const filePath = path.join(metricsDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const metrics = JSON.parse(content) as VoiceMetrics
          
          // Apply date filters if provided
          if (startDate && new Date(metrics.session_start) < new Date(startDate)) continue
          if (endDate && new Date(metrics.session_start) > new Date(endDate)) continue
          
          allMetrics.push(metrics)
        } catch (parseError) {
          console.error(`❌ Error parsing metrics file ${file}:`, parseError)
        }
      }

      // Sort by session start time (newest first)
      allMetrics.sort((a, b) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime())

      // Calculate aggregate metrics
      const totalSessions = allMetrics.length
      const totalTurns = allMetrics.reduce((sum, m) => sum + m.total_turns, 0)
      const avgEouDelay = allMetrics.length > 0 ? 
        allMetrics.reduce((sum, m) => sum + m.average_eou_delay, 0) / allMetrics.length : 0
      const avgSessionDuration = allMetrics.length > 0 ?
        allMetrics.reduce((sum, m) => sum + m.session_duration, 0) / allMetrics.length : 0

      const aggregateMetrics = {
        totalSessions,
        totalTurns,
        averageEouDelay: Math.round(avgEouDelay * 100) / 100,
        averageSessionDuration: Math.round(avgSessionDuration * 100) / 100,
        medianEouDelay: calculateMedian(allMetrics.map(m => m.average_eou_delay)),
        p95EouDelay: calculatePercentile(allMetrics.map(m => m.average_eou_delay), 95),
        sessionsToday: allMetrics.filter(m => 
          new Date(m.session_start).toDateString() === new Date().toDateString()
        ).length
      }

      console.log(`📊 Returning ${allMetrics.length} voice metrics sessions`)

      return NextResponse.json({
        sessions: allMetrics,
        aggregate: aggregateMetrics,
        timestamp: new Date().toISOString()
      })

    } catch (readError) {
      console.error('❌ Error reading metrics directory:', readError)
      return NextResponse.json({
        sessions: [],
        aggregate: {
          totalSessions: 0,
          totalTurns: 0,
          averageEouDelay: 0,
          averageSessionDuration: 0,
          medianEouDelay: 0,
          p95EouDelay: 0,
          sessionsToday: 0
        },
        timestamp: new Date().toISOString(),
        error: 'No metrics files found'
      })
    }

  } catch (error) {
    console.error('❌ Voice metrics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch voice metrics' }, { status: 500 })
  }
}

// Utility functions for statistical calculations
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid]
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}