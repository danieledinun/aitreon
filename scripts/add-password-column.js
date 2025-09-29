const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function addPasswordColumn() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔧 Adding password column to users table...')

    // Since we can't execute raw SQL via RPC, let's check if the password column exists
    // by trying to select it, and if it fails, we know we need to add it manually in Supabase dashboard

    console.log('ℹ️ Note: Password column needs to be added manually in Supabase dashboard')
    console.log('ℹ️ SQL command to run: ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;')

    // For now, let's skip the schema modification and just check/update the user

    // Check if tanner@tanner.com user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', 'tanner@tanner.com')
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error checking for tanner user:', fetchError)
    } else if (user) {
      console.log('✅ Found existing user:', { id: user.id, email: user.email, hasPassword: !!user.password })

      if (!user.password) {
        // Add a default password for the existing user
        const bcrypt = require('bcryptjs')
        const hashedPassword = await bcrypt.hash('tanner', 12)

        const { error: updateError } = await supabase
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', user.id)

        if (updateError) {
          console.error('❌ Error updating user password:', updateError)
        } else {
          console.log('✅ Password set for existing user tanner@tanner.com')
        }
      } else {
        console.log('✅ User already has a password')
      }
    } else {
      console.log('ℹ️ No existing user found with email tanner@tanner.com')
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

addPasswordColumn()