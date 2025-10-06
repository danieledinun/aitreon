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

      try {
        // Parse both the URL and any callbackUrl to check for userType
        let userType = null

        // Enhanced userType detection - check multiple sources
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

        // Method 1: Check for userType in the main URL
        if (url.includes('userType=')) {
          const urlObj = new URL(fullUrl)
          userType = urlObj.searchParams.get('userType')
          console.log('🔄 Found userType in main URL:', userType)
        }

        // Method 2: Check if there's a callbackUrl with userType
        if (!userType && url.includes('callbackUrl=')) {
          const urlObj = new URL(fullUrl)
          const callbackUrl = urlObj.searchParams.get('callbackUrl')
          if (callbackUrl) {
            try {
              const decodedCallbackUrl = decodeURIComponent(callbackUrl)
              console.log('🔄 Checking callbackUrl:', decodedCallbackUrl)

              if (decodedCallbackUrl.includes('userType=')) {
                const callbackUrlObj = new URL(decodedCallbackUrl.startsWith('http') ? decodedCallbackUrl : `${baseUrl}${decodedCallbackUrl}`)
                userType = callbackUrlObj.searchParams.get('userType')
                console.log('🔄 Found userType in callbackUrl:', userType)
              }
            } catch (e) {
              console.log('🔄 Error parsing callbackUrl:', e instanceof Error ? e.message : String(e))
            }
          }
        }

        // Method 3: Check if the URL itself indicates the target path
        if (!userType) {
          if (url.includes('/fan/dashboard') || url.includes('userType%3Dfan')) {
            userType = 'fan'
            console.log('🔄 Inferred userType from URL path: fan')
          } else if (url.includes('/creator/onboarding') || url.includes('userType%3Dcreator')) {
            userType = 'creator'
            console.log('🔄 Inferred userType from URL path: creator')
          }
        }

        console.log('🔄 Final detected userType:', userType)

        // EXPLICIT routing based on userType with logging
        if (userType === 'fan') {
          console.log('🔄 ✅ ROUTING FAN TO: /fan/dashboard')
          return `${baseUrl}/fan/dashboard`
        } else if (userType === 'creator') {
          console.log('🔄 ✅ ROUTING CREATOR TO: /creator/onboarding')
          return `${baseUrl}/creator/onboarding`
        }

        // For sign-in flows without userType, FORCE default to fan dashboard
        if (url.includes('/auth/signin') || url === '/auth/signin') {
          console.log('🔄 ✅ SIGN-IN WITHOUT USERTYPE - FORCING FAN DASHBOARD')
          return `${baseUrl}/fan/dashboard`
        }

        // If URL starts with base URL, allow it (internal navigation)
        if (url.startsWith(baseUrl) || url.startsWith('/')) {
          const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : url
          console.log('🔄 Internal redirect allowed:', fullUrl)
          return fullUrl
        }

        // ABSOLUTE fallback - ALWAYS redirect to fan dashboard
        console.log('🔄 ✅ ABSOLUTE FALLBACK - FORCING FAN DASHBOARD')
        return `${baseUrl}/fan/dashboard`

      } catch (error) {
        console.error('❌ Redirect callback error:', error)
        console.log('🔄 ✅ ERROR FALLBACK - FORCING FAN DASHBOARD')
        return `${baseUrl}/fan/dashboard`
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

        // Get user type from database - simplified logic
        try {
          const supabase = getSupabaseClient()
          const userIdString = typeof userId === 'string' ? userId : ''

          const { data: creator } = await supabase
            .from('creators')
            .select('*')
            .eq('user_id', userIdString)
            .single()

          console.log('📋 Session - Creator found:', !!creator)

          // Set session properties based on database state
          session.user.userType = creator ? 'creator' : 'fan'
          session.user.isCreator = !!creator
          session.user.creatorId = creator?.id
          session.user.username = creator?.username

          console.log('📋 Session state:', {
            userType: session.user.userType,
            isCreator: session.user.isCreator,
            creatorId: session.user.creatorId
          })
        } catch (error) {
          console.error('❌ Error in session callback:', error)
          // Safe fallback
          session.user.userType = 'fan'
          session.user.isCreator = false
          session.user.creatorId = undefined
          session.user.username = undefined
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
  debug: false
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