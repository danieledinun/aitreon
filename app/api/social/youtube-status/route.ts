import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    const { data: account } = await supabase
      .from('accounts')
      .select('refresh_token')
      .eq('user_id', session.user.id)
      .eq('provider', 'google')
      .single()

    return NextResponse.json({
      connected: !!(account?.refresh_token),
    })
  } catch (error) {
    console.error('Error checking YouTube status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
