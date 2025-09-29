import { supabase } from './supabase'
import type { 
  User, 
  Creator, 
  Video, 
  Account, 
  Subscription, 
  ChatSession, 
  VoiceSettings, 
  AiConfig, 
  CreatorSuggestedQuestions 
} from './supabase'

// Database service that provides Prisma-like interface using Supabase
export class DatabaseService {
  // User operations
  user = {
    findMany: async (options?: { 
      where?: any, 
      include?: any, 
      orderBy?: any,
      take?: number,
      skip?: number 
    }) => {
      let query = supabase.from('users').select('*')
      
      if (options?.where?.email) {
        query = query.eq('email', options.where.email)
      }
      if (options?.where?.id) {
        query = query.eq('id', options.where.id)
      }
      if (options?.orderBy) {
        const orderField = Object.keys(options.orderBy)[0]
        const orderDirection = options.orderBy[orderField]
        query = query.order(orderField, { ascending: orderDirection === 'asc' })
      }
      if (options?.take) {
        query = query.limit(options.take)
      }
      if (options?.skip) {
        query = query.range(options.skip, options.skip + (options.take || 1000) - 1)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data as User[]
    },

    findUnique: async (options: { where: { id?: string, email?: string }, include?: any }) => {
      let query = supabase.from('users').select('*')
      
      if (options.where.id) {
        query = query.eq('id', options.where.id)
      } else if (options.where.email) {
        query = query.eq('email', options.where.email)
      }
      
      const { data, error } = await query.single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "not found"
      return data as User | null
    },

    findFirst: async (options: { where?: any, include?: any }) => {
      let query = supabase.from('users').select('*').limit(1)
      
      if (options.where?.email) {
        query = query.eq('email', options.where.email)
      }
      if (options.where?.id) {
        query = query.eq('id', options.where.id)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data?.[0] as User | null
    },

    create: async (options: { data: Partial<User> }) => {
      const { data, error } = await supabase
        .from('users')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as User
    },

    update: async (options: { where: { id: string }, data: Partial<User> }) => {
      const { data, error } = await supabase
        .from('users')
        .update(options.data)
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as User
    },

    // Helper function to get user type based on creator profile existence
    getUserType: async (userId: string): Promise<'creator' | 'fan'> => {
      try {
        const { data: creator } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', userId)
          .single()
        return creator ? 'creator' : 'fan'
      } catch (error) {
        console.error('Error getting user type:', error)
        return 'fan'
      }
    },

    // Helper function to set user type by managing creator profile
    setUserType: async (userId: string, userType: 'creator' | 'fan') => {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        if (!user) throw new Error('User not found')

        const { data: existingCreator } = await supabase
          .from('creators')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (userType === 'creator' && !existingCreator) {
          // Create a basic creator profile - will be enhanced during YouTube setup
          const username = (user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'creator') + Math.random().toString(36).substring(2, 6)

          await supabase
            .from('creators')
            .insert({
              user_id: userId,
              username: username,
              display_name: user.name || 'New Creator',
              bio: 'Setting up creator profile...',
              is_active: false // Will be activated after YouTube setup
            })
        }
        // Note: We don't delete creator profiles when switching to fan - they keep both roles

        return user
      } catch (error) {
        console.error('Error setting user type:', error)
        throw error
      }
    },

    // Helper function to check if user can access creator features
    canAccessCreatorFeatures: async (userId: string): Promise<boolean> => {
      try {
        const { data: creator } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', userId)
          .single()
        return !!creator
      } catch (error) {
        return false
      }
    },

    // Helper function to find users by type
    findByUserType: async (userType: 'creator' | 'fan', options?: { take?: number, skip?: number }) => {
      if (userType === 'creator') {
        // Find users who have creator profiles
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            creators!creators_user_id_fkey (id)
          `)
          .not('creators.id', 'is', null)
          .limit(options?.take || 100)
          .range(options?.skip || 0, (options?.skip || 0) + (options?.take || 100) - 1)
        
        if (error) throw error
        return data as User[]
      } else {
        // Find users who don't have creator profiles
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            creators!creators_user_id_fkey (id)
          `)
          .is('creators.id', null)
          .limit(options?.take || 100)
          .range(options?.skip || 0, (options?.skip || 0) + (options?.take || 100) - 1)
        
        if (error) throw error
        return data as User[]
      }
    },

    upsert: async (options: { where: { id?: string, email?: string }, create: Partial<User>, update: Partial<User> }) => {
      const existing = await this.user.findUnique({ where: options.where })
      
      if (existing) {
        return await this.user.update({ where: { id: existing.id }, data: options.update })
      } else {
        return await this.user.create({ data: { ...options.create, ...options.where } })
      }
    }
  }

  // Creator operations
  creator = {
    findMany: async (options?: { 
      where?: any, 
      include?: any, 
      orderBy?: any,
      take?: number 
    }) => {
      let query = supabase.from('creators').select('*')
      
      if (options?.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options?.where?.username) {
        query = query.eq('username', options.where.username)
      }
      if (options?.where?.isActive !== undefined) {
        query = query.eq('is_active', options.where.isActive)
      }
      if (options?.orderBy) {
        const orderField = Object.keys(options.orderBy)[0]
        const orderDirection = options.orderBy[orderField]
        query = query.order(orderField, { ascending: orderDirection === 'asc' })
      }
      if (options?.take) {
        query = query.limit(options.take)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data as Creator[]
    },

    findUnique: async (options: { where: { id?: string, userId?: string, username?: string }, include?: any }) => {
      // Build select clause based on includes
      let selectClause = '*'
      if (options.include) {
        const includes = []
        if (options.include.ai_config) includes.push('ai_config(*)')
        if (options.include.voice_settings) includes.push('voice_settings(*)')
        if (options.include.creator_suggested_questions) includes.push('creator_suggested_questions(*)')
        if (options.include._count) {
          // Handle _count separately - we'll fetch these manually after the main query
        }
        if (includes.length > 0) {
          selectClause = `*, ${includes.join(', ')}`
        }
      }
      
      let query = supabase.from('creators').select(selectClause)
      
      if (options.where.id) {
        query = query.eq('id', options.where.id)
      } else if (options.where.userId) {
        query = query.eq('user_id', options.where.userId)
      } else if (options.where.username) {
        query = query.eq('username', options.where.username)
      }
      
      const { data, error } = await query.single()
      if (error && error.code !== 'PGRST116') throw error
      
      // Handle _count if requested
      if (data && options.include?._count && typeof data === 'object' && 'id' in data) {
        const counts: any = {}

        if (options.include._count.select?.subscriptions) {
          const { count } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', (data as any).id)
            .eq('status', 'ACTIVE')
          counts.subscriptions = count || 0
        }
        
        if (options.include._count.select?.videos) {
          const { count } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', (data as any).id)
            .eq('is_processed', true)
          counts.videos = count || 0
        }
        
        if (options.include._count.select?.chat_sessions) {
          const { count } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', (data as any).id)
          counts.chat_sessions = count || 0
        }

        (data as any)._count = counts
      }
      
      return data as Creator | null
    },

    findFirst: async (options: { where?: any, include?: any }) => {
      let query = supabase.from('creators').select('*').limit(1)
      
      if (options.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options.where?.username) {
        query = query.eq('username', options.where.username)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data?.[0] as Creator | null
    },

    create: async (options: { data: Partial<Creator> }) => {
      const { data, error } = await supabase
        .from('creators')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as Creator
    },

    update: async (options: { where: { id: string }, data: Partial<Creator> }) => {
      const { data, error } = await supabase
        .from('creators')
        .update(options.data)
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as Creator
    }
  }

  // Video operations
  video = {
    findMany: async (options?: {
      where?: any,
      include?: any,
      orderBy?: any,
      take?: number
    }) => {
      console.log('🔍 Database Debug - Video findMany called with options:', JSON.stringify(options, null, 2))
      console.log('🔍 Database Debug - THIS IS THE CUSTOM DATABASE SERVICE!')
      let query = supabase.from('videos').select('*')

      if (options?.where?.creatorId) {
        console.log('🔍 Database Debug - Filtering by creatorId (camelCase):', options.where.creatorId)
        query = query.eq('creator_id', options.where.creatorId)
      }
      if (options?.where?.youtubeId) {
        query = query.eq('youtube_id', options.where.youtubeId)
      }
      if (options?.where?.isProcessed !== undefined) {
        query = query.eq('is_processed', options.where.isProcessed)
      }
      if (options?.orderBy) {
        const orderField = Object.keys(options.orderBy)[0]
        const orderDirection = options.orderBy[orderField]
        // Convert camelCase to snake_case for database fields
        const dbField = orderField === 'createdAt' ? 'created_at' :
                       orderField === 'updatedAt' ? 'updated_at' :
                       orderField === 'isProcessed' ? 'is_processed' :
                       orderField === 'youtubeId' ? 'youtube_id' :
                       orderField === 'viewCount' ? 'view_count' :
                       orderField === 'chunkIndex' ? 'chunk_index' :
                       orderField
        console.log('🔍 Database Debug - OrderBy field mapping:', orderField, '->', dbField)
        query = query.order(dbField, { ascending: orderDirection === 'asc' })
      }
      if (options?.take) {
        query = query.limit(options.take)
      }
      
      const { data, error } = await query
      if (error) throw error
      console.log('🔍 Database Debug - Video findMany result count:', data?.length)
      console.log('🔍 Database Debug - First few results:', data?.slice(0, 3).map(v => ({ id: v.id, title: v.title, creator_id: v.creator_id })))
      return data as Video[]
    },

    findUnique: async (options: { where: { id?: string, youtubeId?: string }, include?: any }) => {
      let query = supabase.from('videos').select('*')
      
      if (options.where.id) {
        query = query.eq('id', options.where.id)
      } else if (options.where.youtubeId) {
        query = query.eq('youtube_id', options.where.youtubeId)
      }
      
      const { data, error } = await query.single()
      if (error && error.code !== 'PGRST116') throw error
      return data as Video | null
    },

    create: async (options: { data: Partial<Video> }) => {
      const { data, error } = await supabase
        .from('videos')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as Video
    },

    count: async (options?: { where?: any }) => {
      let query = supabase.from('videos').select('*', { count: 'exact', head: true })
      
      if (options?.where?.creatorId) {
        query = query.eq('creator_id', options.where.creatorId)
      }
      if (options?.where?.is_processed !== undefined) {
        query = query.eq('is_processed', options.where.is_processed)
      }
      if (options?.where?.isProcessed !== undefined) {
        query = query.eq('is_processed', options.where.isProcessed)
      }
      
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },

    update: async (options: { where: { id: string }, data: Partial<Video> }) => {
      const { data, error } = await supabase
        .from('videos')
        .update(options.data)
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as Video
    },

    delete: async (options: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('videos')
        .delete()
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as Video
    }
  }

  // Account operations
  account = {
    create: async (options: { data: Partial<Account> }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as Account
    },

    findUnique: async (options: { where: { provider_providerAccountId?: { provider: string, providerAccountId: string } } }) => {
      if (!options.where.provider_providerAccountId) return null
      
      const { provider, providerAccountId } = options.where.provider_providerAccountId
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('provider', provider)
        .eq('provider_account_id', providerAccountId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data as Account | null
    },

    findFirst: async (options: { where?: { userId?: string, provider?: string } }) => {
      let query = supabase.from('accounts').select('*').limit(1)
      
      if (options.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options.where?.provider) {
        query = query.eq('provider', options.where.provider)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data?.[0] as Account | null
    },

    update: async (options: { where: { id: string }, data: Partial<Account> }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(options.data)
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as Account
    },

    deleteMany: async (options: { where: { userId?: string, provider?: string } }) => {
      let query = supabase.from('accounts').delete()
      
      if (options.where.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options.where.provider) {
        query = query.eq('provider', options.where.provider)
      }
      
      const { data, error } = await query
      if (error) throw error
      
      // Supabase doesn't return count for delete operations, so we'll return a mock structure
      return { count: (data as any)?.length || 0 }
    }
  }

  // Session operations  
  session = {
    create: async (options: { data: any }) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data
    },

    findUnique: async (options: { where: { sessionToken: string } }) => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_token', options.where.sessionToken)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    },

    update: async (options: { where: { sessionToken: string }, data: any }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update(options.data)
        .eq('session_token', options.where.sessionToken)
        .select()
        .single()
      
      if (error) throw error
      return data
    },

    delete: async (options: { where: { sessionToken: string } }) => {
      const { data, error } = await supabase
        .from('sessions')
        .delete()
        .eq('session_token', options.where.sessionToken)
        .select()
        .single()
      
      if (error) throw error
      return data
    }
  }

  // Chat session operations
  chatSession = {
    findMany: async (options?: { where?: any, include?: any, orderBy?: any, take?: number }) => {
      // Build select string based on include options
      let selectString = '*'
      if (options?.include) {
        let selects = ['*']
        if (options.include.messages) {
          selects.push('messages(*)')
        }
        if (options.include.user) {
          selects.push('users(*)')
        }
        selectString = selects.join(', ')
      }
      
      let query = supabase.from('chat_sessions').select(selectString)
      
      if (options?.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options?.where?.creatorId) {
        query = query.eq('creator_id', options.where.creatorId)
      }
      if (options?.orderBy) {
        const orderField = Object.keys(options.orderBy)[0]
        const orderDirection = options.orderBy[orderField]
        // Convert camelCase to snake_case for database fields
        const dbField = orderField === 'createdAt' ? 'created_at' : orderField
        query = query.order(dbField, { ascending: orderDirection === 'asc' })
      }
      if (options?.take) {
        query = query.limit(options.take)
      }
      
      const { data, error } = await query
      if (error) throw error
      
      // Transform the data to match expected structure
      const transformedData = (data || []).map((session: any) => ({
        ...session,
        messages: session.messages || [],
        user: session.users || null
      }))
      
      return transformedData as ChatSession[]
    },

    create: async (options: { data: Partial<ChatSession> }) => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as ChatSession
    }
  }

  // Voice settings operations
  voiceSettings = {
    findUnique: async (options: { where: { creatorId: string } }) => {
      const { data, error } = await supabase
        .from('voice_settings')
        .select('*')
        .eq('creator_id', options.where.creatorId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data as VoiceSettings | null
    },

    create: async (options: { data: Partial<VoiceSettings> }) => {
      const { data, error } = await supabase
        .from('voice_settings')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as VoiceSettings
    },

    update: async (options: { where: { creatorId: string }, data: Partial<VoiceSettings> }) => {
      const { data, error } = await supabase
        .from('voice_settings')
        .update(options.data)
        .eq('creator_id', options.where.creatorId)
        .select()
        .single()
      
      if (error) throw error
      return data as VoiceSettings
    },

    upsert: async (options: { where: { creatorId: string }, create: Partial<VoiceSettings>, update: Partial<VoiceSettings> }) => {
      const existing = await this.voiceSettings.findUnique({ where: options.where })
      
      if (existing) {
        return await this.voiceSettings.update({ where: options.where, data: options.update })
      } else {
        return await this.voiceSettings.create({ data: { ...options.create, creator_id: options.where.creatorId } })
      }
    },

    delete: async (options: { where: { creatorId: string } }) => {
      const { data, error } = await supabase
        .from('voice_settings')
        .delete()
        .eq('creator_id', options.where.creatorId)
        .select()
        .single()
      
      if (error) throw error
      return data as VoiceSettings
    }
  }

  // AI Config operations
  aiConfig = {
    findUnique: async (options: { where: { creatorId: string } }) => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('creator_id', options.where.creatorId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data as AiConfig | null
    },

    create: async (options: { data: Partial<AiConfig> }) => {
      const { data, error } = await supabase
        .from('ai_config')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as AiConfig
    },

    update: async (options: { where: { creatorId: string }, data: Partial<AiConfig> }) => {
      const { data, error } = await supabase
        .from('ai_config')
        .update(options.data)
        .eq('creator_id', options.where.creatorId)
        .select()
        .single()
      
      if (error) throw error
      return data as AiConfig
    },

    upsert: async (options: { where: { creatorId: string }, create: Partial<AiConfig>, update: Partial<AiConfig> }) => {
      const existing = await this.aiConfig.findUnique({ where: options.where })
      
      if (existing) {
        return await this.aiConfig.update({ where: options.where, data: options.update })
      } else {
        return await this.aiConfig.create({ data: { ...options.create, creator_id: options.where.creatorId } })
      }
    }
  }

  // Suggested questions operations
  creatorSuggestedQuestions = {
    findUnique: async (options: { where: { creatorId: string } }) => {
      const { data, error } = await supabase
        .from('creator_suggested_questions')
        .select('*')
        .eq('creator_id', options.where.creatorId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data as CreatorSuggestedQuestions | null
    },

    findFirst: async (options?: { where?: { creatorId?: string } }) => {
      let query = supabase.from('creator_suggested_questions').select('*').limit(1)

      if (options?.where?.creatorId) {
        query = query.eq('creator_id', options.where.creatorId)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data?.[0] as CreatorSuggestedQuestions | null
    },

    create: async (options: { data: Partial<CreatorSuggestedQuestions> }) => {
      const { data, error } = await supabase
        .from('creator_suggested_questions')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as CreatorSuggestedQuestions
    },

    update: async (options: { where: { creatorId: string }, data: Partial<CreatorSuggestedQuestions> }) => {
      const { data, error } = await supabase
        .from('creator_suggested_questions')
        .update(options.data)
        .eq('creator_id', options.where.creatorId)
        .select()
        .single()
      
      if (error) throw error
      return data as CreatorSuggestedQuestions
    },

    upsert: async (options: { where: { creatorId: string }, create: Partial<CreatorSuggestedQuestions>, update: Partial<CreatorSuggestedQuestions> }) => {
      const existing = await this.creatorSuggestedQuestions.findUnique({ where: options.where })
      
      if (existing) {
        return await this.creatorSuggestedQuestions.update({ where: options.where, data: options.update })
      } else {
        return await this.creatorSuggestedQuestions.create({ data: { ...options.create, creator_id: options.where.creatorId } })
      }
    },

    deleteMany: async (options: { where: { creatorId: string } }) => {
      const { error } = await supabase
        .from('creator_suggested_questions')
        .delete()
        .eq('creator_id', options.where.creatorId)
      
      if (error) throw error
      return { count: 0 } // Supabase doesn't return count for delete operations
    }
  }

  // Message operations
  message = {
    findMany: async (options?: { where?: any, include?: any, orderBy?: any }) => {
      let query = supabase.from('messages').select('*')
      
      if (options?.where?.sessionId) {
        query = query.eq('session_id', options.where.sessionId)
      }
      if (options?.orderBy) {
        const orderField = Object.keys(options.orderBy)[0]
        const orderDirection = options.orderBy[orderField]
        query = query.order(orderField, { ascending: orderDirection === 'asc' })
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },

    create: async (options: { data: any }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data
    }
  }

  // Citation operations
  citation = {
    createMany: async (options: { data: any[] }) => {
      const { data, error } = await supabase
        .from('citations')
        .insert(options.data)
        .select()
      
      if (error) throw error
      return data
    }
  }

  // Daily usage operations
  dailyUsage = {
    findUnique: async (options: { where: { userId_creatorId_date: { userId: string, creatorId: string, date: Date } } }) => {
      const { userId, creatorId, date } = options.where.userId_creatorId_date
      const dateStr = date.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('daily_usage')
        .select('*')
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
        .eq('date', dateStr)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    },

    upsert: async (options: { where: any, create: any, update: any }) => {
      const existing = await this.dailyUsage.findUnique({ where: options.where })
      
      if (existing) {
        const { userId, creatorId, date } = options.where.userId_creatorId_date
        const dateStr = date.toISOString().split('T')[0]
        
        const { data, error } = await supabase
          .from('daily_usage')
          .update(options.update)
          .eq('user_id', userId)
          .eq('creator_id', creatorId)
          .eq('date', dateStr)
          .select()
          .single()
        
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('daily_usage')
          .insert({ ...options.create, date: options.create.date.toISOString().split('T')[0] })
          .select()
          .single()
        
        if (error) throw error
        return data
      }
    }
  }

  // Subscription operations
  subscription = {
    findMany: async (options?: { where?: any, include?: any }) => {
      let query = supabase.from('subscriptions').select('*')
      
      if (options?.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options?.where?.creatorId) {
        query = query.eq('creator_id', options.where.creatorId)
      }
      if (options?.where?.status) {
        query = query.eq('status', options.where.status)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data as Subscription[]
    },

    findFirst: async (options: { where?: any }) => {
      let query = supabase.from('subscriptions').select('*').limit(1)
      
      if (options.where?.userId) {
        query = query.eq('user_id', options.where.userId)
      }
      if (options.where?.creatorId) {
        query = query.eq('creator_id', options.where.creatorId)
      }
      if (options.where?.stripeSubscriptionId) {
        query = query.eq('stripe_subscription_id', options.where.stripeSubscriptionId)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data?.[0] as Subscription | null
    },

    create: async (options: { data: Partial<Subscription> }) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(options.data)
        .select()
        .single()
      
      if (error) throw error
      return data as Subscription
    },

    update: async (options: { where: { id: string }, data: Partial<Subscription> }) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(options.data)
        .eq('id', options.where.id)
        .select()
        .single()
      
      if (error) throw error
      return data as Subscription
    }
  }

  // Transaction support (limited - Supabase doesn't have full transaction support like Prisma)
  $transaction = async <T>(queries: Promise<T>[]): Promise<T[]> => {
    // Execute all queries in parallel since Supabase doesn't have transaction support
    // This is not a true transaction but provides similar functionality for most use cases
    return Promise.all(queries)
  }

  // Connect/disconnect methods for compatibility
  // Content chunks operations
  contentChunk = {
    findMany: async (options?: any) => {
      let query = supabase.from('content_chunks').select('*')
      
      if (options?.where) {
        if (options.where.video_id) {
          query = query.eq('video_id', options.where.video_id)
        }
        if (options.where.video?.creator_id) {
          // Join with videos table to filter by creator_id
          query = supabase.from('content_chunks')
            .select(`
              *,
              video:videos!content_chunks_video_id_fkey (
                title
              )
            `)
            .eq('videos.creator_id', options.where.video.creator_id)
        }
      }
      
      if (options?.orderBy?.chunk_index) {
        query = query.order('chunk_index', { ascending: options.orderBy.chunk_index === 'asc' })
      }
      if (options?.orderBy?.created_at) {
        query = query.order('created_at', { ascending: options.orderBy.created_at === 'asc' })
      }
      
      if (options?.take) {
        query = query.limit(options.take)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    count: async (options?: any) => {
      let query = supabase.from('content_chunks').select('*', { count: 'exact', head: true })

      if (options?.where?.video?.creator_id) {
        // This is a complex query, might need to be handled differently
        // For now, return 0
        return 0
      }

      const { count, error } = await query
      if (error) throw error
      return count || 0
    },

    create: async (options: any) => {
      const { data, error } = await supabase
        .from('content_chunks')
        .insert(options.data)
        .select()
        .single()

      if (error) throw error
      return data
    }
  }


  $connect = async () => {
    // Supabase handles connections automatically
  }

  $disconnect = async () => {
    // Supabase handles disconnections automatically
  }
}

// Create and export the database instance
export const db = new DatabaseService()

// All database operations use Supabase