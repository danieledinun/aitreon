import { createClient } from '@supabase/supabase-js'
import { backgroundJobService } from './background-jobs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConversationActivity {
  sessionId: string
  creatorId: string
  lastActivity: Date
  hasUserMessages: boolean
}

export class ConversationTracker {
  private static instance: ConversationTracker
  private activeConversations = new Map<string, ConversationActivity>()
  private inactivityThreshold = 5 * 60 * 1000 // 5 minutes of inactivity
  private checkInterval = 60 * 1000 // Check every minute
  private intervalId: NodeJS.Timeout | null = null

  static getInstance(): ConversationTracker {
    if (!ConversationTracker.instance) {
      ConversationTracker.instance = new ConversationTracker()
    }
    return ConversationTracker.instance
  }

  // Track a new message in a conversation
  async trackMessage(sessionId: string, creatorId: string, role: string) {
    const now = new Date()

    // Get existing or create new conversation activity
    const existing = this.activeConversations.get(sessionId)
    const hasUserMessage = role === 'user' || role === 'USER' || (existing?.hasUserMessages ?? false)

    this.activeConversations.set(sessionId, {
      sessionId,
      creatorId,
      lastActivity: now,
      hasUserMessages: hasUserMessage
    })

    console.log(`💬 Tracked message in session ${sessionId} (role: ${role}, hasUserMessages: ${hasUserMessage})`)
  }

  // Start monitoring for inactive conversations
  start() {
    if (this.intervalId) {
      console.log('📊 Conversation tracker already running')
      return
    }

    console.log('🚀 Starting conversation tracker...')
    this.intervalId = setInterval(() => {
      this.checkInactiveConversations()
    }, this.checkInterval)

    // Initial check
    this.checkInactiveConversations()
  }

  // Stop monitoring
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('⏹️ Conversation tracker stopped')
  }

  // Check for conversations that have become inactive
  private checkInactiveConversations() {
    const now = new Date()
    const inactiveConversations: ConversationActivity[] = []

    for (const [sessionId, activity] of this.activeConversations) {
      const timeSinceLastActivity = now.getTime() - activity.lastActivity.getTime()

      if (timeSinceLastActivity >= this.inactivityThreshold) {
        // Only schedule sentiment analysis if there were user messages
        if (activity.hasUserMessages) {
          inactiveConversations.push(activity)
          console.log(`⏰ Conversation ${sessionId} has been inactive for ${Math.round(timeSinceLastActivity / 1000)}s`)
        }

        // Remove from active tracking
        this.activeConversations.delete(sessionId)
      }
    }

    // Schedule sentiment analysis for inactive conversations
    for (const conversation of inactiveConversations) {
      this.scheduleConversationAnalysis(conversation)
    }
  }

  // Schedule sentiment analysis for an ended conversation
  private async scheduleConversationAnalysis(conversation: ConversationActivity) {
    try {
      console.log(`📋 Scheduling sentiment analysis for ended conversation ${conversation.sessionId}`)

      await backgroundJobService.scheduleSentimentAnalysis(
        conversation.sessionId,
        conversation.creatorId,
        conversation.lastActivity
      )
    } catch (error) {
      console.error(`❌ Error scheduling sentiment analysis for ${conversation.sessionId}:`, error)
    }
  }

  // Manually trigger conversation end (for testing or explicit end events)
  async endConversation(sessionId: string, creatorId: string) {
    const activity = this.activeConversations.get(sessionId)

    if (activity && activity.hasUserMessages) {
      console.log(`🔚 Manually ending conversation ${sessionId}`)
      await this.scheduleConversationAnalysis(activity)
    }

    // Remove from active tracking
    this.activeConversations.delete(sessionId)
  }

  // Get stats about active conversations
  getStats() {
    return {
      activeConversations: this.activeConversations.size,
      conversations: Array.from(this.activeConversations.values()).map(conv => ({
        sessionId: conv.sessionId,
        creatorId: conv.creatorId,
        lastActivity: conv.lastActivity,
        minutesInactive: Math.round((new Date().getTime() - conv.lastActivity.getTime()) / 60000),
        hasUserMessages: conv.hasUserMessages
      }))
    }
  }
}

// Export singleton instance
export const conversationTracker = ConversationTracker.getInstance()

// Auto-start in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_JOBS === 'true') {
  conversationTracker.start()
}