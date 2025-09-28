import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, newEmail, newName } = body

    // Admin authentication check should be added here
    // For now, this is a placeholder for admin functionality

    if (action === 'update_user_email') {
      if (!userId || !newEmail) {
        return NextResponse.json({ error: 'Missing required fields: userId, newEmail' }, { status: 400 })
      }

      const { data: updatedUser } = await supabase
        .from('users')
        .update({
          email: newEmail,
          name: newName || undefined
        })
        .eq('id', userId)
        .select()
        .single()

      if (!updatedUser) {
        return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      })
    }

    if (action === 'get_user_accounts') {
      if (!userId) {
        return NextResponse.json({ error: 'Missing required field: userId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select(`
          *,
          creators:creators(*),
          accounts:accounts(provider, provider_account_id)
        `)
        .eq('id', userId)
        .single()

      return NextResponse.json({ user })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('❌ Admin operation error:', error)
    return NextResponse.json({ error: 'Failed to perform admin operation' }, { status: 500 })
  }
}