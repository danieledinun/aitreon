const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetPassword() {
  try {
    const email = 'lanceh@lanceh.com'
    const newPassword = 'lanceh'

    console.log(`🔐 Resetting password for: ${email}`)
    console.log(`🔑 New password: ${newPassword}`)

    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update the user's password
    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email)
      .select()

    if (error) {
      console.error('❌ Error updating password:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      console.error('❌ User not found with email:', email)
      process.exit(1)
    }

    console.log('✅ Password reset successful!')
    console.log(`\n📋 Login credentials:`)
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${newPassword}`)
    console.log(`\n🔗 Login at: https://aitreon.vercel.app/auth/signin`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

resetPassword()
