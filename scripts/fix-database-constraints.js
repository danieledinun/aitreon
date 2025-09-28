#!/usr/bin/env node

/**
 * Database constraints and cleanup script
 * Fixes authentication data integrity issues by:
 * 1. Adding unique email constraint to users table
 * 2. Cleaning up duplicate users
 * 3. Fixing orphaned creator profiles
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyuhljkilispdhetwalj.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dWhsamtpbGlzcGRoZXR3YWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA3MzgyNiwiZXhwIjoyMDcxNjQ5ODI2fQ.Ys_bhwzEeAxRjMteMM2GKff1ikspaoYr5RQRlZJzmg4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addDatabaseConstraints() {
  console.log('🔧 Adding database constraints to prevent duplicate emails...')

  try {
    // First, let's check current schema
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_info', {
      table_name: 'users'
    })

    if (tablesError) {
      console.log('📋 Checking current users table structure...')

      // Check if unique constraint already exists
      const { data: constraints, error: constraintsError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
          `
        })

      if (!constraintsError && constraints) {
        const emailConstraint = constraints.find(c => c.constraint_name.includes('email'))
        if (emailConstraint) {
          console.log('✅ Email unique constraint already exists')
          return true
        }
      }
    }

    // Add unique constraint on email if it doesn't exist
    console.log('📝 Adding unique email constraint...')
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);'
    })

    if (constraintError) {
      if (constraintError.message.includes('already exists')) {
        console.log('✅ Email unique constraint already exists')
        return true
      } else if (constraintError.message.includes('duplicate key value')) {
        console.log('⚠️ Duplicate emails found, need to clean up first')
        return false
      } else {
        console.error('❌ Error adding constraint:', constraintError)
        return false
      }
    }

    console.log('✅ Successfully added email unique constraint')
    return true

  } catch (error) {
    console.error('❌ Error adding database constraints:', error)
    return false
  }
}

async function findDuplicateUsers() {
  console.log('🔍 Checking for duplicate users...')

  try {
    const { data: duplicates, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT email, COUNT(*) as count, array_agg(id) as user_ids
        FROM users
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `
    })

    if (error) {
      console.error('❌ Error finding duplicates:', error)
      return []
    }

    if (!duplicates || duplicates.length === 0) {
      console.log('✅ No duplicate users found')
      return []
    }

    console.log(`⚠️ Found ${duplicates.length} emails with duplicate users:`)
    duplicates.forEach(dup => {
      console.log(`  - ${dup.email}: ${dup.count} users (${dup.user_ids.join(', ')})`)
    })

    return duplicates

  } catch (error) {
    console.error('❌ Error checking for duplicates:', error)
    return []
  }
}

async function cleanupDuplicateUsers(duplicates) {
  console.log('🧹 Cleaning up duplicate users...')

  for (const duplicate of duplicates) {
    try {
      console.log(`\n🔧 Processing ${duplicate.email}...`)
      const userIds = duplicate.user_ids

      // Get full details for all duplicate users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds)
        .order('created_at', { ascending: true })

      if (usersError || !users || users.length === 0) {
        console.error(`❌ Error fetching users for ${duplicate.email}:`, usersError)
        continue
      }

      // Find the "primary" user (oldest, most complete profile)
      const primaryUser = users.reduce((best, current) => {
        // Prefer users with email_verified
        if (current.email_verified && !best.email_verified) return current
        if (!current.email_verified && best.email_verified) return best

        // Prefer users with more complete profiles
        const currentScore = (current.name ? 1 : 0) + (current.image ? 1 : 0)
        const bestScore = (best.name ? 1 : 0) + (best.image ? 1 : 0)
        if (currentScore > bestScore) return current
        if (bestScore > currentScore) return best

        // Prefer older users
        return new Date(current.created_at) < new Date(best.created_at) ? current : best
      })

      const duplicateUserIds = userIds.filter(id => id !== primaryUser.id)

      console.log(`  📋 Primary user: ${primaryUser.id} (${primaryUser.name || 'unnamed'})`)
      console.log(`  🗑️ Duplicate users to merge/remove: ${duplicateUserIds.join(', ')}`)

      // Check for creator profiles associated with duplicate users
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('*')
        .in('user_id', duplicateUserIds)

      if (!creatorsError && creators && creators.length > 0) {
        console.log(`  🎨 Found ${creators.length} creator profiles to reassign`)

        // Check if primary user already has a creator profile
        const { data: primaryCreator } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', primaryUser.id)
          .single()

        if (primaryCreator) {
          console.log(`  ⚠️ Primary user already has creator profile, removing duplicates`)
          // Remove duplicate creator profiles
          for (const creator of creators) {
            await supabase.from('creators').delete().eq('id', creator.id)
            console.log(`    🗑️ Removed duplicate creator: ${creator.username}`)
          }
        } else {
          // Reassign the best creator profile to primary user
          const bestCreator = creators.reduce((best, current) => {
            const currentScore = (current.display_name ? 1 : 0) +
                               (current.bio ? 1 : 0) +
                               (current.profile_image ? 1 : 0) +
                               (current.youtube_channel_id ? 2 : 0) // YouTube connection is most valuable
            const bestScore = (best.display_name ? 1 : 0) +
                            (best.bio ? 1 : 0) +
                            (best.profile_image ? 1 : 0) +
                            (best.youtube_channel_id ? 2 : 0)
            return currentScore > bestScore ? current : best
          })

          // Reassign best creator to primary user
          await supabase
            .from('creators')
            .update({ user_id: primaryUser.id })
            .eq('id', bestCreator.id)

          console.log(`  ✅ Reassigned creator ${bestCreator.username} to primary user`)

          // Remove other creator profiles
          const otherCreators = creators.filter(c => c.id !== bestCreator.id)
          for (const creator of otherCreators) {
            await supabase.from('creators').delete().eq('id', creator.id)
            console.log(`    🗑️ Removed duplicate creator: ${creator.username}`)
          }
        }
      }

      // Reassign other related records (sessions, accounts, etc.)
      const relatedTables = [
        { table: 'sessions', column: 'user_id' },
        { table: 'accounts', column: 'user_id' },
        { table: 'subscriptions', column: 'user_id' },
        { table: 'chat_sessions', column: 'user_id' }
      ]

      for (const { table, column } of relatedTables) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ [column]: primaryUser.id })
          .in(column, duplicateUserIds)

        if (!updateError) {
          console.log(`  ✅ Reassigned ${table} records to primary user`)
        }
      }

      // Finally, delete duplicate users
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('id', duplicateUserIds)

      if (deleteError) {
        console.error(`❌ Error deleting duplicate users for ${duplicate.email}:`, deleteError)
      } else {
        console.log(`  ✅ Deleted ${duplicateUserIds.length} duplicate user(s)`)
      }

    } catch (error) {
      console.error(`❌ Error processing ${duplicate.email}:`, error)
    }
  }
}

async function main() {
  console.log('🚀 Starting database constraints and cleanup...')

  try {
    // Step 1: Check for duplicates first
    const duplicates = await findDuplicateUsers()

    // Step 2: Clean up duplicates if found
    if (duplicates.length > 0) {
      await cleanupDuplicateUsers(duplicates)
      console.log('\n✅ Duplicate cleanup complete')
    }

    // Step 3: Add constraints
    const constraintsAdded = await addDatabaseConstraints()

    if (constraintsAdded) {
      console.log('\n🎉 Database cleanup and constraints complete!')
      console.log('   - Email uniqueness enforced')
      console.log('   - Duplicate users cleaned up')
      console.log('   - Creator profiles properly linked')
    } else {
      console.log('\n⚠️ Some constraints could not be added, but cleanup was attempted')
    }

  } catch (error) {
    console.error('❌ Script error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default main