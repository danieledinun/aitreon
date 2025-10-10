// Test script to verify follow functionality
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testFollowFunctionality() {
  console.log('🧪 Testing follow functionality...')

  try {
    // Get a real user and creator ID from the database
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)

    const { data: creators } = await supabase
      .from('creators')
      .select('id, display_name')
      .limit(1)

    if (!users || users.length === 0) {
      console.log('❌ No users found in database')
      return
    }

    if (!creators || creators.length === 0) {
      console.log('❌ No creators found in database')
      return
    }

    const user = users[0]
    const creator = creators[0]

    console.log('👤 Test user:', user.email, 'ID:', user.id)
    console.log('👨‍💼 Test creator:', creator.display_name, 'ID:', creator.id)

    // Test 1: Insert a follow record
    console.log('\n🔄 Test 1: Creating follow record...')
    const { data: insertResult, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        creator_id: creator.id,
        subscription_type: 'follow',
        is_active: true
      })
      .select()

    if (insertError) {
      console.log('❌ Insert error:', insertError)
      return
    }

    console.log('✅ Follow record created:', insertResult)

    // Test 2: Query the follow record
    console.log('\n🔄 Test 2: Querying follow records...')
    const { data: queryResult, error: queryError } = await supabase
      .from('user_subscriptions')
      .select(`
        creator_id,
        created_at,
        subscription_type,
        is_active,
        creators (
          id,
          display_name,
          bio,
          profile_image
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (queryError) {
      console.log('❌ Query error:', queryError)
      return
    }

    console.log('✅ Follow records found:', queryResult?.length || 0)
    console.log('📄 Records:', JSON.stringify(queryResult, null, 2))

    // Test 3: Delete the follow record
    console.log('\n🔄 Test 3: Deleting follow record...')
    const { error: deleteError } = await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('creator_id', creator.id)

    if (deleteError) {
      console.log('❌ Delete error:', deleteError)
      return
    }

    console.log('✅ Follow record deleted successfully')

    console.log('\n🎉 All tests passed! Follow functionality should work.')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testFollowFunctionality()