import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/database'
import VoiceCloneInterface from '@/components/voice-clone-interface'

export default async function VoiceSettingsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  // Get user info
  const user = await db.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    redirect('/auth/signin')
  }

  // Get creator info separately
  const creator = await db.creator.findFirst({
    where: { user_id: user.id }
  })

  if (!creator) {
    redirect('/creator/setup')
  }

  // Get voice settings
  const voiceSettings = await db.voiceSettings.findUnique({
    where: { creatorId: creator.id }
  })

  // Attach voice settings to creator object for compatibility
  const creatorWithVoiceSettings = {
    ...creator,
    displayName: creator.display_name, // Map database field to component interface
    voiceSettings: voiceSettings ? {
      isEnabled: voiceSettings.is_enabled,
      elevenlabsVoiceId: voiceSettings.elevenlabs_voice_id
    } : null
  }

  return <VoiceCloneInterface creator={creatorWithVoiceSettings} />
}