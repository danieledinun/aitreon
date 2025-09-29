import { NextAuthOptions } from 'next-auth'
import { SupabaseAdapter } from './supabase-auth-adapter'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import AppleProvider from 'next-auth/providers/apple'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import { YouTubeService } from '@/lib/youtube'
import bcrypt from 'bcryptjs'

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function refreshAccessToken(token: any) {
  try {
    console.log('🔄 Refreshing access token...')
    
    const url = 'https://oauth2.googleapis.com/token'
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const tokens = await response.json()

    if (!response.ok) {
      console.error('❌ Token refresh failed:', tokens)
      throw tokens
    }

    console.log('✅ Access token refreshed successfully')
    return {
      ...token,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
      refreshToken: tokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('❌ Error refreshing access token:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

// Using Supabase adapter directly - handles all the custom logic we need

async function processYouTubeData(email: string, accessToken: string) {
  try {
    console.log('🎬 Processing YouTube data for:', email)
    const supabase = getSupabaseClient()

    // Find the user in the database first
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (!user) {
      console.log('❌ User not found in database:', email)
      return
    }

    // Check if user already has a creator profile
    const { data: creator } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If user already has a creator profile with recent data, skip API calls
    if (creator && creator.youtube_channel_id) {
      const lastUpdate = new Date(creator.updated_at)
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60)

      if (hoursSinceUpdate < 24) {
        console.log('✅ Using cached creator data (updated recently)')
        return
      }
    }

    // Only make API call if we need fresh channel data
    const channelData = await YouTubeService.getUserChannel(accessToken)

    if (!channelData) {
      console.log('❌ No YouTube channel found for:', email)
      return
    }

    console.log('✅ Found YouTube channel:', channelData.title)

    // Create or update creator profile
    if (!creator) {
      // Generate username from channel title
      const username = channelData.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) + Math.random().toString(36).substring(2, 6)

      const { data: newCreator } = await supabase
        .from('creators')
        .insert({
          user_id: user.id,
          username,
          display_name: channelData.title,
          bio: channelData.description.substring(0, 500),
          profile_image: channelData.thumbnail,
          youtube_channel_id: channelData.id,
          youtube_channel_url: `https://www.youtube.com/channel/${channelData.id}`,
          is_active: true,
        })
        .select()
        .single()

      console.log('✅ Created creator profile:', newCreator?.username)
    } else {
      // Update existing creator with latest channel data
      const { data: updatedCreator } = await supabase
        .from('creators')
        .update({
          youtube_channel_id: channelData.id,
          youtube_channel_url: `https://www.youtube.com/channel/${channelData.id}`,
          profile_image: channelData.thumbnail,
          bio: channelData.description.substring(0, 500) || creator.bio,
        })
        .eq('id', creator.id)
        .select()
        .single()

      console.log('✅ Updated creator profile:', updatedCreator?.username)
    }

    // Skip background processing during sign-in to reduce quota usage
    console.log(`✅ Creator profile ready. Use "Process Videos" button to build knowledge base.`)

    console.log('🎉 YouTube data processing complete!')
  } catch (error) {
    console.error('❌ Error processing YouTube data:', error)
    throw error
  }
}

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
          prompt: 'consent',
          access_type: 'offline',
          include_granted_scopes: 'true'
        }
      }
    }),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? [
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID!,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET!
      })
    ] : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET ? [
      AppleProvider({
        clientId: process.env.APPLE_ID!,
        clientSecret: process.env.APPLE_SECRET!
      })
    ] : []),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'you@example.com'
        },
        password: { 
          label: 'Password', 
          type: 'password',
          placeholder: 'Your password'
        },
        action: {
          label: 'Action',
          type: 'text',
        },
        name: {
          label: 'Name',
          type: 'text',
        }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        try {
          const supabase = getSupabaseClient()

          // Check if this is a sign-up or sign-in
          const isSignUp = credentials.action === 'signup'

          if (isSignUp) {
            // Sign Up Logic
            console.log('🔐 Credentials: Starting sign-up process for:', credentials.email)
            if (!credentials.name) {
              throw new Error('Name is required for sign-up')
            }

            // Check if user already exists
            const { data: existingUser } = await supabase
              .from('users')
              .select('*')
              .eq('email', credentials.email)
              .single()

            if (existingUser) {
              throw new Error('User already exists with this email')
            }

            // Hash password and create user
            const hashedPassword = await bcrypt.hash(credentials.password, 12)

            // Create new user directly in database
            const { data: newUser, error } = await supabase
              .from('users')
              .insert({
                email: credentials.email,
                name: credentials.name,
                password: hashedPassword,
                email_verified: new Date().toISOString(), // Auto-verify for now
              })
              .select()
              .single()

            if (error) {
              throw new Error('Failed to create user: ' + error.message)
            }

            console.log('✅ Credentials: New user created successfully:', { id: newUser.id, email: newUser.email })

            // Return user object - NextAuth will handle session creation via adapter
            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              emailVerified: newUser.email_verified,
            }
          } else {
            // Sign In Logic
            console.log('🔐 Credentials: Starting sign-in process for:', credentials.email)
            const { data: user } = await supabase
              .from('users')
              .select('*')
              .eq('email', credentials.email)
              .single()

            if (!user) {
              throw new Error('Invalid email or password')
            }

            // Verify password
            let isValidPassword = false
            if (user.password) {
              // User has a stored password, verify it
              isValidPassword = await bcrypt.compare(credentials.password, user.password)
            } else {
              // User doesn't have a password (OAuth-only user), deny access
              throw new Error('This account uses social login. Please sign in with Google, Facebook, or Apple.')
            }

            if (!isValidPassword) {
              throw new Error('Invalid email or password')
            }

            console.log('✅ Credentials: User authenticated successfully:', { id: user.id, email: user.email })

            // Return user object - NextAuth will handle session creation via adapter
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.email_verified,
            }
          }
        } catch (error) {
          console.error('❌ Credentials auth error:', error)
          throw error
        }
      }
    })
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      console.log('🔄 Redirect callback:', { url, baseUrl })
      
      // Extract userType from URL and store it for later use
      try {
        let fullUrl = url
        if (!url.startsWith('http')) {
          fullUrl = new URL(url, baseUrl).toString()
        }
        
        console.log('🔄 Full URL:', fullUrl)
        
        // Extract userType from URL parameters
        const urlObj = new URL(fullUrl)
        const userType = urlObj.searchParams.get('userType')
        
        if (userType && (userType === 'creator' || userType === 'fan')) {
          console.log('✅ UserType parameter found in URL:', userType)
          
          // Store user type for use in session callback (user-specific)
          if (typeof globalThis !== 'undefined') {
            if (!(globalThis as any).pendingUserTypes) {
              (globalThis as any).pendingUserTypes = new Map()
            }
            // Use URL as key to make it user-session specific
            (globalThis as any).pendingUserTypes.set(fullUrl, userType)
          }
          
          // For creators, check if they already exist before redirecting to onboarding
          if (userType === 'creator') {
            // Check if user already has a creator profile
            try {
              // Token not available in redirect callback
              let userId = null // token?.sub || token?.userId
              console.log('🔍 Redirect: Token not available in redirect callback')

              // Since token/userId not available in redirect callback, let session callback handle routing
              console.log('🔄 No userId available in redirect, allowing auth flow to complete naturally')
              return fullUrl
            } catch (error) {
              console.error('❌ Error checking existing creator in redirect:', error)
            }

            // Fallback: redirect to onboarding
            console.log('🔄 Fallback: redirecting creator from auth flow to onboarding')
            return `${baseUrl}/onboarding?userType=creator`
          }
          
          return fullUrl
        }
        
        // For Google OAuth sign-ins without userType parameter, check if user has creator profile
        if (url.includes('/api/auth/callback/google')) {
          try {
            // Token not available in redirect callback, skip this check
            console.log('🔄 Google OAuth callback, token not available for user lookup')
          } catch (error) {
            console.error('❌ Error checking Google OAuth creator:', error)
          }
        }
        
        // Check if URL is within our domain
        if (fullUrl.startsWith(baseUrl)) {
          return fullUrl
        }
        
        return `${baseUrl}/creator`
      } catch (error) {
        console.error('❌ Redirect callback error:', error)
        return `${baseUrl}/creator`
      }
    },
    async signIn({ user, account, profile, email, credentials }) {
      console.log('🔐 SignIn callback started:', { 
        userId: user.id, 
        email: user.email, 
        provider: account?.provider,
        hasAccessToken: !!account?.access_token 
      })
      
      try {
        // Skip automatic YouTube processing - let the dashboard handle it based on user choice
        if (account?.provider === 'google' && account.access_token) {
          console.log('📺 Google sign-in detected - access token saved for later use')
          console.log('🔑 Access token length:', account.access_token.length)
          console.log('⏰ Token expires at:', new Date(account.expires_at! * 1000))
          console.log('⏭️ Skipping automatic YouTube processing - will be handled based on user choice')
        }
        console.log('✅ SignIn callback returning true')
        return true
      } catch (error) {
        console.error('❌ SignIn callback error:', error)
        return true // Always allow sign-in to proceed
      }
    },
    async session({ session, token }) {
      console.log('📋 Session callback:', { hasToken: !!token, tokenUserId: token?.userId, tokenSub: token?.sub })
      
      if (session.user) {
        // For JWT sessions, get user ID from token
        const userId = token?.userId || token?.sub
        session.user.id = (typeof userId === 'string' ? userId : '') || ''
        
        // Get or set user type from metadata
        try {
          const supabase = getSupabaseClient()

          // Check if user already has a creator profile
          const userIdString = typeof userId === 'string' ? userId : ''
          console.log('🔍 Session Debug - User Info:', { userId: userIdString, userEmail: session.user.email })

          const { data: creator } = await supabase
            .from('creators')
            .select('*')
            .eq('user_id', userIdString)
            .single()

          console.log('🔍 Session Debug - Creator Query Result:', creator ? { creatorId: creator.id, creatorUserId: creator.user_id, creatorUsername: creator.username } : null)

          // SAFETY CHECK: If we got a creator, verify it actually exists in database
          let validCreator = creator
          if (creator) {
            try {
              const { data: verifyCreator } = await supabase
                .from('creators')
                .select('*')
                .eq('id', creator.id)
                .single()

              if (!verifyCreator) {
                console.log('❌ Session Debug - Creator verification failed! Creator does not exist:', creator.id)
                validCreator = null
              } else {
                console.log('✅ Session Debug - Creator verified:', verifyCreator.id)
              }
            } catch (error) {
              console.log('❌ Session Debug - Creator verification error:', error)
              validCreator = null
            }
          }
          
          let userType: 'creator' | 'fan' = creator ? 'creator' : 'fan'
          console.log('📋 Current user state:', { userId: userId, hasCreator: !!creator, currentType: userType })
          
          // Check for pending user type from redirect (user-specific)
          let pendingUserType = null
          if (typeof globalThis !== 'undefined' && (globalThis as any).pendingUserTypes) {
            const pendingUserTypes = (globalThis as any).pendingUserTypes as Map<string, string>
            // Look for any pending user type for creator onboarding URLs
            for (const [url, type] of pendingUserTypes.entries()) {
              if (url.includes('/onboarding?userType=creator') && type === 'creator') {
                pendingUserType = type
                // Clean up this entry
                pendingUserTypes.delete(url)
                break
              }
            }
          }
          console.log('📋 Pending user type from redirect:', pendingUserType)
          
          if (pendingUserType && (pendingUserType === 'creator' || pendingUserType === 'fan')) {
            console.log('🏷️ Processing pending user type:', pendingUserType)

            // Check if user is already a complete creator
            const isCompleteCreator = creator && creator.username && creator.display_name

            if (pendingUserType === 'creator') {
              if (isCompleteCreator) {
                console.log('✅ User is already a complete creator - respecting existing status')
                userType = 'creator' // Keep creator status but don't force onboarding
              } else {
                console.log('🏷️ User intends to be creator - will complete onboarding')
                userType = 'creator' // Set for onboarding (new or incomplete creator)
              }
            }

            // Note: Pending user type already cleaned up during lookup above
          }
          
          // Set session properties
          session.user.userType = userType
          session.user.isCreator = userType === 'creator'
          session.user.creatorId = creator?.id
          session.user.username = creator?.username
          
          console.log('📋 Final session state:', { 
            userType: session.user.userType, 
            isCreator: session.user.isCreator,
            creatorId: session.user.creatorId,
            username: session.user.username
          })
        } catch (error) {
          console.error('❌ Error handling user type in session:', error)
          // Fallback to existing logic
          const supabase = getSupabaseClient()
          const userId = token?.userId || token?.sub
          const userIdString = typeof userId === 'string' ? userId : ''

          const { data: creator } = await supabase
            .from('creators')
            .select('*')
            .eq('user_id', userIdString)
            .single()

          session.user.userType = creator ? 'creator' : 'fan'
          session.user.isCreator = !!creator
          session.user.creatorId = creator?.id
          session.user.username = creator?.username
        }
      }
      return session
    },
    async jwt({ token, account, user }) {
      console.log('🔐 JWT callback:', { hasAccount: !!account, hasUser: !!user, provider: account?.provider, userId: user?.id })
      
      // Initial sign in
      if (account && user) {
        console.log('🔐 JWT: Initial sign in')
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        token.userId = user.id // Store user ID in JWT token for credentials users
        return token
      }

      // Return previous token if the access token has not expired yet
      if (token.expiresAt && typeof token.expiresAt === 'number' && Date.now() < token.expiresAt * 1000) {
        console.log('🔐 JWT: Token still valid')
        return token
      }

      // Access token has expired, try to update it
      console.log('🔐 JWT: Token expired, attempting refresh')
      return await refreshAccessToken(token)
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt'
  },
  debug: true
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      userType: 'creator' | 'fan'
      isCreator: boolean
      creatorId?: string
      username?: string
    }
  }
}