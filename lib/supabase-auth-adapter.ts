import type { Adapter } from "@next-auth/adapters"
import { supabase } from './supabase'

export function SupabaseAdapter(): Adapter {
  return {
    async createUser(user) {
      console.log('🔧 Supabase adapter createUser:', user)
      try {
        // First check if user already exists with this email
        const existingUser = await this.getUserByEmail(user.email!)
        if (existingUser) {
          console.log('🔄 User already exists, returning existing user:', existingUser.id)
          return existingUser
        }

        const { data, error } = await supabase
          .from('users')
          .insert({
            name: user.name,
            email: user.email,
            email_verified: user.emailVerified,
            image: user.image,
          })
          .select()
          .single()

        if (error) {
          // If we get a unique constraint error, try to fetch the existing user
          if (error.code === '23505') {
            console.log('🔄 Unique constraint error, fetching existing user')
            const existingUser = await this.getUserByEmail(user.email!)
            if (existingUser) return existingUser
          }
          throw error
        }

        console.log('✅ Supabase adapter createUser success:', data.id)
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          emailVerified: data.email_verified,
          image: data.image,
        }
      } catch (error) {
        console.error('❌ Supabase adapter createUser error:', error)
        throw error
      }
    },

    async getUser(id) {
      console.log('🔧 Supabase adapter getUser:', id)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error && error.code !== 'PGRST116') throw error
        if (!data) return null
        
        console.log('✅ Supabase adapter getUser result:', data ? 'User found' : 'User not found')
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          emailVerified: data.email_verified,
          image: data.image,
        }
      } catch (error) {
        console.error('❌ Supabase adapter getUser error:', error)
        throw error
      }
    },

    async getUserByEmail(email) {
      console.log('🔧 Supabase adapter getUserByEmail:', email)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single()
        
        if (error && error.code !== 'PGRST116') throw error
        if (!data) return null
        
        console.log('✅ Supabase adapter getUserByEmail result:', data ? 'User found' : 'User not found')
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          emailVerified: data.email_verified,
          image: data.image,
        }
      } catch (error) {
        console.error('❌ Supabase adapter getUserByEmail error:', error)
        throw error
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      console.log('🔧 Supabase adapter getUserByAccount:', { provider, providerAccountId })
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select(`
            users (
              id,
              name,
              email,
              email_verified,
              image
            )
          `)
          .eq('provider', provider)
          .eq('provider_account_id', providerAccountId)
          .single()
        
        if (error && error.code !== 'PGRST116') throw error
        if (!data?.users) return null
        
        console.log('✅ Supabase adapter getUserByAccount result:', data.users ? 'User found' : 'User not found')
        const user = Array.isArray(data.users) ? data.users[0] : data.users
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.email_verified,
          image: user.image,
        }
      } catch (error) {
        console.error('❌ Supabase adapter getUserByAccount error:', error)
        throw error
      }
    },

    async updateUser(user) {
      console.log('🔧 Supabase adapter updateUser:', user.id)
      try {
        const { data, error } = await supabase
          .from('users')
          .update({
            name: user.name,
            email: user.email,
            email_verified: user.emailVerified,
            image: user.image,
          })
          .eq('id', user.id)
          .select()
          .single()
        
        if (error) throw error
        
        console.log('✅ Supabase adapter updateUser success')
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          emailVerified: data.email_verified,
          image: data.image,
        }
      } catch (error) {
        console.error('❌ Supabase adapter updateUser error:', error)
        throw error
      }
    },

    async deleteUser(userId) {
      console.log('🔧 Supabase adapter deleteUser:', userId)
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId)
        
        if (error) throw error
        console.log('✅ Supabase adapter deleteUser success')
      } catch (error) {
        console.error('❌ Supabase adapter deleteUser error:', error)
        throw error
      }
    },

    async linkAccount(account) {
      console.log('🔧 Supabase adapter linkAccount:', { provider: account.provider })
      try {
        // Remove refresh_token_expires_in since it's not in our schema
        const { refresh_token_expires_in, ...accountData } = account as any
        
        const { data, error } = await supabase
          .from('accounts')
          .insert({
            user_id: accountData.userId,
            type: accountData.type,
            provider: accountData.provider,
            provider_account_id: accountData.providerAccountId,
            refresh_token: accountData.refresh_token,
            access_token: accountData.access_token,
            expires_at: accountData.expires_at,
            token_type: accountData.token_type,
            scope: accountData.scope,
            id_token: accountData.id_token,
            session_state: accountData.session_state,
          })
          .select()
          .single()
        
        if (error) throw error
        
        console.log('✅ Supabase adapter linkAccount success')
        return {
          id: data.id,
          userId: data.user_id,
          type: data.type,
          provider: data.provider,
          providerAccountId: data.provider_account_id,
          refresh_token: data.refresh_token,
          access_token: data.access_token,
          expires_at: data.expires_at,
          token_type: data.token_type,
          scope: data.scope,
          id_token: data.id_token,
          session_state: data.session_state,
        }
      } catch (error) {
        console.error('❌ Supabase adapter linkAccount error:', error)
        throw error
      }
    },

    async unlinkAccount({ providerAccountId, provider }) {
      console.log('🔧 Supabase adapter unlinkAccount:', { provider, providerAccountId })
      try {
        const { error } = await supabase
          .from('accounts')
          .delete()
          .eq('provider', provider)
          .eq('provider_account_id', providerAccountId)
        
        if (error) throw error
        console.log('✅ Supabase adapter unlinkAccount success')
      } catch (error) {
        console.error('❌ Supabase adapter unlinkAccount error:', error)
        throw error
      }
    },

    async createSession({ sessionToken, userId, expires }) {
      console.log('🔧 Supabase adapter createSession:', { userId })
      try {
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            session_token: sessionToken,
            user_id: userId,
            expires: expires.toISOString(),
          })
          .select()
          .single()
        
        if (error) throw error
        
        console.log('✅ Supabase adapter createSession success')
        return {
          id: data.id,
          sessionToken: data.session_token,
          userId: data.user_id,
          expires: new Date(data.expires),
        }
      } catch (error) {
        console.error('❌ Supabase adapter createSession error:', error)
        throw error
      }
    },

    async getSessionAndUser(sessionToken) {
      console.log('🔧 Supabase adapter getSessionAndUser:', sessionToken ? 'token provided' : 'no token')
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select(`
            id,
            session_token,
            user_id,
            expires,
            users (
              id,
              name,
              email,
              email_verified,
              image
            )
          `)
          .eq('session_token', sessionToken)
          .single()
        
        if (error && error.code !== 'PGRST116') throw error
        if (!data?.users) return null
        
        console.log('✅ Supabase adapter getSessionAndUser result:', data ? 'Session found' : 'Session not found')
        const user = Array.isArray(data.users) ? data.users[0] : data.users
        return {
          session: {
            id: data.id,
            sessionToken: data.session_token,
            userId: data.user_id,
            expires: new Date(data.expires),
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.email_verified,
            image: user.image,
          },
        }
      } catch (error) {
        console.error('❌ Supabase adapter getSessionAndUser error:', error)
        throw error
      }
    },

    async updateSession({ sessionToken, ...session }) {
      console.log('🔧 Supabase adapter updateSession:', sessionToken ? 'token provided' : 'no token')
      try {
        const { data, error } = await supabase
          .from('sessions')
          .update({
            expires: session.expires?.toISOString(),
          })
          .eq('session_token', sessionToken)
          .select()
          .single()
        
        if (error) throw error
        
        console.log('✅ Supabase adapter updateSession success')
        return {
          id: data.id,
          sessionToken: data.session_token,
          userId: data.user_id,
          expires: new Date(data.expires),
        }
      } catch (error) {
        console.error('❌ Supabase adapter updateSession error:', error)
        throw error
      }
    },

    async deleteSession(sessionToken) {
      console.log('🔧 Supabase adapter deleteSession:', sessionToken ? 'token provided' : 'no token')
      try {
        const { error } = await supabase
          .from('sessions')
          .delete()
          .eq('session_token', sessionToken)
        
        if (error) throw error
        console.log('✅ Supabase adapter deleteSession success')
      } catch (error) {
        console.error('❌ Supabase adapter deleteSession error:', error)
        throw error
      }
    },

    async createVerificationToken({ identifier, expires, token }) {
      console.log('🔧 Supabase adapter createVerificationToken:', identifier)
      try {
        // Note: We don't have a verification_tokens table in the current schema
        // This would need to be added if email verification is needed
        console.log('⚠️ Verification tokens not implemented - no verification_tokens table')
        return { identifier, expires, token }
      } catch (error) {
        console.error('❌ Supabase adapter createVerificationToken error:', error)
        throw error
      }
    },

    async useVerificationToken({ identifier, token }) {
      console.log('🔧 Supabase adapter useVerificationToken:', identifier)
      try {
        // Note: We don't have a verification_tokens table in the current schema
        // This would need to be added if email verification is needed
        console.log('⚠️ Verification tokens not implemented - no verification_tokens table')
        return null
      } catch (error) {
        console.error('❌ Supabase adapter useVerificationToken error:', error)
        throw error
      }
    },
  }
}