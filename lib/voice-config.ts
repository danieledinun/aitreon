// Voice call configuration
export const VOICE_CALL_CONFIG = {
  // Maximum call duration in seconds (default: 5 minutes)
  MAX_CALL_DURATION: parseInt(process.env.VOICE_CALL_MAX_DURATION || '300'),
  
  // Warning time before call ends in seconds (default: 30 seconds)
  WARNING_TIME: parseInt(process.env.VOICE_CALL_WARNING_TIME || '30'),
  
  // Whether to auto-end calls when time limit is reached
  AUTO_END_CALLS: process.env.VOICE_CALL_AUTO_END === 'true',
  
  // Default message when call time is about to expire
  EXPIRY_WARNING_MESSAGE: 'Your call time is about to expire. The call will end soon.',
  
  // Get remaining time in seconds
  getRemainingTime: (elapsedSeconds: number): number => {
    return Math.max(0, VOICE_CALL_CONFIG.MAX_CALL_DURATION - elapsedSeconds)
  },
  
  // Check if call should show warning
  shouldShowWarning: (elapsedSeconds: number): boolean => {
    const remaining = VOICE_CALL_CONFIG.getRemainingTime(elapsedSeconds)
    return remaining <= VOICE_CALL_CONFIG.WARNING_TIME && remaining > 0
  },
  
  // Check if call time has expired
  isExpired: (elapsedSeconds: number): boolean => {
    return elapsedSeconds >= VOICE_CALL_CONFIG.MAX_CALL_DURATION
  },
  
  // Format remaining time for display
  formatRemainingTime: (elapsedSeconds: number): string => {
    const remaining = VOICE_CALL_CONFIG.getRemainingTime(elapsedSeconds)
    if (remaining === 0) return 'Time expired'
    
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`
    } else {
      return `${seconds} seconds remaining`
    }
  }
}

// Export for use in components
export default VOICE_CALL_CONFIG