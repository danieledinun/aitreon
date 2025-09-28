import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all users with their creators and accounts using Supabase
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        *,
        creators (*),
        accounts (
          id,
          provider,
          provider_account_id,
          access_token,
          refresh_token,
          expires_at
        )
      `)

    if (usersError) throw usersError

    // Get all accounts separately to see any orphaned accounts
    const { data: allAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select(`
        *,
        users (email, name)
      `)

    if (accountsError) throw accountsError

    return NextResponse.json({ 
      users, 
      totalUsers: users?.length || 0,
      totalAccounts: allAccounts?.length || 0,
      accountSummary: allAccounts?.map(acc => ({
        id: acc.id,
        provider: acc.provider,
        providerAccountId: acc.provider_account_id,
        userEmail: (acc.users as any)?.email,
        userName: (acc.users as any)?.name
      })) || []
    })
  } catch (error) {
    console.error('❌ Debug users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}