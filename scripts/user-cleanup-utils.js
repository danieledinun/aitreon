#!/usr/bin/env node

/**
 * User Cleanup and Migration Utilities
 *
 * Production-ready utilities for maintaining user data integrity:
 * - Detect and resolve duplicate users
 * - Fix orphaned creator profiles
 * - Verify authentication data consistency
 * - Generate health reports
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

export class UserCleanupUtils {

  /**
   * Generate comprehensive health report
   */
  static async generateHealthReport() {
    console.log('🔍 Generating user data health report...\n')

    const report = {
      timestamp: new Date().toISOString(),
      users: {},
      creators: {},
      sessions: {},
      accounts: {},
      issues: []
    }

    try {
      // Check users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      report.users.total = users.length
      report.users.withEmail = users.filter(u => u.email).length
      report.users.withoutEmail = users.filter(u => !u.email).length

      // Check for duplicate emails
      const emailCounts = {}
      users.forEach(user => {
        if (user.email) {
          emailCounts[user.email] = (emailCounts[user.email] || 0) + 1
        }
      })

      const duplicateEmails = Object.entries(emailCounts)
        .filter(([email, count]) => count > 1)
        .map(([email, count]) => ({ email, count }))

      report.users.duplicateEmails = duplicateEmails

      // Check creators
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id, user_id, username, created_at')
        .order('created_at', { ascending: false })

      if (creatorsError) throw creatorsError

      report.creators.total = creators.length
      report.creators.withValidUserId = creators.filter(c => c.user_id).length

      // Check for orphaned creators (user_id not in users table)
      const userIds = new Set(users.map(u => u.id))
      const orphanedCreators = creators.filter(c => c.user_id && !userIds.has(c.user_id))
      report.creators.orphaned = orphanedCreators.length

      // Check sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, user_id, expires')

      if (!sessionsError && sessions) {
        report.sessions.total = sessions.length
        report.sessions.expired = sessions.filter(s => new Date(s.expires) < new Date()).length
        report.sessions.active = sessions.filter(s => new Date(s.expires) >= new Date()).length
      }

      // Check accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, user_id, provider')

      if (!accountsError && accounts) {
        report.accounts.total = accounts.length
        const providerCounts = {}
        accounts.forEach(acc => {
          providerCounts[acc.provider] = (providerCounts[acc.provider] || 0) + 1
        })
        report.accounts.byProvider = providerCounts
      }

      // Generate issues
      if (duplicateEmails.length > 0) {
        report.issues.push({
          type: 'duplicate_emails',
          severity: 'high',
          description: `Found ${duplicateEmails.length} emails with duplicate users`,
          data: duplicateEmails
        })
      }

      if (orphanedCreators.length > 0) {
        report.issues.push({
          type: 'orphaned_creators',
          severity: 'medium',
          description: `Found ${orphanedCreators.length} creator profiles with invalid user_id`,
          data: orphanedCreators.map(c => ({ creatorId: c.id, invalidUserId: c.user_id }))
        })
      }

      // Print report
      console.log('📊 USER DATA HEALTH REPORT')
      console.log('='.repeat(50))
      console.log(`📅 Generated: ${report.timestamp}`)
      console.log(`\n👥 Users: ${report.users.total} total`)
      console.log(`   📧 With email: ${report.users.withEmail}`)
      console.log(`   ❓ Without email: ${report.users.withoutEmail}`)

      console.log(`\n🎨 Creators: ${report.creators.total} total`)
      console.log(`   ✅ With valid user_id: ${report.creators.withValidUserId}`)
      console.log(`   ⚠️ Orphaned: ${report.creators.orphaned}`)

      if (report.sessions) {
        console.log(`\n🔐 Sessions: ${report.sessions.total} total`)
        console.log(`   ✅ Active: ${report.sessions.active}`)
        console.log(`   ⏰ Expired: ${report.sessions.expired}`)
      }

      if (report.accounts) {
        console.log(`\n🔗 Accounts: ${report.accounts.total} total`)
        Object.entries(report.accounts.byProvider).forEach(([provider, count]) => {
          console.log(`   ${provider}: ${count}`)
        })
      }

      console.log(`\n🚨 Issues Found: ${report.issues.length}`)
      report.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`)
      })

      if (report.issues.length === 0) {
        console.log('✅ No issues detected - user data integrity looks good!')
      }

      return report

    } catch (error) {
      console.error('❌ Error generating health report:', error)
      throw error
    }
  }

  /**
   * Fix orphaned creator profiles
   */
  static async fixOrphanedCreators() {
    console.log('🔧 Fixing orphaned creator profiles...')

    try {
      // Find orphaned creators
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id, user_id, username, display_name')

      if (creatorsError) throw creatorsError

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')

      if (usersError) throw usersError

      const userIds = new Set(users.map(u => u.id))
      const orphanedCreators = creators.filter(c => c.user_id && !userIds.has(c.user_id))

      if (orphanedCreators.length === 0) {
        console.log('✅ No orphaned creators found')
        return
      }

      console.log(`⚠️ Found ${orphanedCreators.length} orphaned creators`)

      for (const creator of orphanedCreators) {
        console.log(`🗑️ Removing orphaned creator: ${creator.username} (${creator.id})`)

        // Delete the orphaned creator
        const { error: deleteError } = await supabase
          .from('creators')
          .delete()
          .eq('id', creator.id)

        if (deleteError) {
          console.error(`❌ Error deleting creator ${creator.id}:`, deleteError)
        } else {
          console.log(`✅ Deleted orphaned creator: ${creator.username}`)
        }
      }

    } catch (error) {
      console.error('❌ Error fixing orphaned creators:', error)
      throw error
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions() {
    console.log('🧹 Cleaning up expired sessions...')

    try {
      const { data: expiredSessions, error: selectError } = await supabase
        .from('sessions')
        .select('id, expires')
        .lt('expires', new Date().toISOString())

      if (selectError) throw selectError

      if (!expiredSessions || expiredSessions.length === 0) {
        console.log('✅ No expired sessions found')
        return
      }

      console.log(`🗑️ Found ${expiredSessions.length} expired sessions to clean up`)

      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .lt('expires', new Date().toISOString())

      if (deleteError) throw deleteError

      console.log(`✅ Deleted ${expiredSessions.length} expired sessions`)

    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error)
      throw error
    }
  }

  /**
   * Verify user-creator relationships
   */
  static async verifyUserCreatorRelationships() {
    console.log('🔍 Verifying user-creator relationships...')

    try {
      const { data: relationships, error } = await supabase
        .from('creators')
        .select(`
          id,
          user_id,
          username,
          users!inner (
            id,
            email,
            name
          )
        `)

      if (error) throw error

      console.log(`✅ Verified ${relationships.length} valid user-creator relationships`)

      const issues = []
      relationships.forEach(rel => {
        if (!rel.users) {
          issues.push(`Creator ${rel.username} (${rel.id}) has invalid user_id: ${rel.user_id}`)
        }
      })

      if (issues.length > 0) {
        console.log('⚠️ Relationship issues found:')
        issues.forEach(issue => console.log(`  - ${issue}`))
      } else {
        console.log('✅ All user-creator relationships are valid')
      }

      return issues

    } catch (error) {
      console.error('❌ Error verifying relationships:', error)
      throw error
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2]

  switch (command) {
    case 'report':
      await UserCleanupUtils.generateHealthReport()
      break
    case 'fix-orphaned':
      await UserCleanupUtils.fixOrphanedCreators()
      break
    case 'cleanup-sessions':
      await UserCleanupUtils.cleanupExpiredSessions()
      break
    case 'verify-relationships':
      await UserCleanupUtils.verifyUserCreatorRelationships()
      break
    case 'full-cleanup':
      console.log('🚀 Running full cleanup process...\n')
      await UserCleanupUtils.generateHealthReport()
      console.log('\n' + '='.repeat(50) + '\n')
      await UserCleanupUtils.fixOrphanedCreators()
      console.log('\n' + '='.repeat(50) + '\n')
      await UserCleanupUtils.cleanupExpiredSessions()
      console.log('\n' + '='.repeat(50) + '\n')
      await UserCleanupUtils.verifyUserCreatorRelationships()
      console.log('\n🎉 Full cleanup complete!')
      break
    default:
      console.log('📖 User Cleanup Utilities')
      console.log('\nUsage: node user-cleanup-utils.js <command>')
      console.log('\nCommands:')
      console.log('  report              Generate health report')
      console.log('  fix-orphaned        Fix orphaned creator profiles')
      console.log('  cleanup-sessions    Remove expired sessions')
      console.log('  verify-relationships Verify user-creator relationships')
      console.log('  full-cleanup        Run all cleanup operations')
      console.log('\nEnvironment variables required:')
      console.log('  NEXT_PUBLIC_SUPABASE_URL')
      console.log('  SUPABASE_SERVICE_ROLE_KEY')
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
}