import { backgroundJobService } from './background-jobs'
import { conversationTracker } from './conversation-tracker'

let servicesInitialized = false

export function initializeBackgroundServices() {
  if (servicesInitialized) {
    console.log('📋 Background services already initialized')
    return
  }

  console.log('🚀 Initializing background services...')

  try {
    // Start background job processor
    backgroundJobService.start()
    console.log('✅ Background job service started')

    // Start conversation tracker
    conversationTracker.start()
    console.log('✅ Conversation tracker started')

    servicesInitialized = true
    console.log('🎉 Background services initialization complete')

  } catch (error) {
    console.error('❌ Failed to initialize background services:', error)
    throw error
  }
}

// Auto-initialize in production environment
if (process.env.NODE_ENV === 'production') {
  initializeBackgroundServices()
}

// Export status checker
export function getBackgroundServicesStatus() {
  return {
    initialized: servicesInitialized,
    conversationStats: servicesInitialized ? conversationTracker.getStats() : null
  }
}