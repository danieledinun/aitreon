import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Get the creator
    const { data: creator } = await supabase
      .from('creator')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'ElevenLabs API not configured' }, { status: 500 })
    }

    console.log('🎵 Creating voice clone for creator:', creator.display_name)
    console.log('🎵 Audio file size:', audioFile.size, 'bytes')
    console.log('🎵 Audio file type:', audioFile.type)

    // Create FormData for ElevenLabs API
    const elevenlabsFormData = new FormData()
    elevenlabsFormData.append('files', audioFile)
    elevenlabsFormData.append('name', name || `${creator.display_name} Clone`)
    elevenlabsFormData.append('description', description || `Voice clone for ${creator.display_name}`)

    // Optional: Add labels for better voice characteristics
    const labels = JSON.stringify({
      accent: 'neutral',
      age: 'adult',
      gender: 'neutral',
      use_case: 'conversational'
    })
    elevenlabsFormData.append('labels', labels)

    // Call ElevenLabs Voice Clone API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
      },
      body: elevenlabsFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs API error:', response.status, errorText)
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.detail?.message) {
          return NextResponse.json({ error: errorData.detail.message }, { status: response.status })
        }
      } catch (parseError) {
        // Fallback to generic error
      }
      
      return NextResponse.json({ 
        error: 'Failed to create voice clone. Please ensure your audio is clear and try again.' 
      }, { status: response.status })
    }

    const voiceData = await response.json()
    console.log('✅ Voice clone created:', voiceData.voice_id)

    // Store voice settings in database
    const { data: existingVoiceSettings } = await supabase
      .from('voice_settings')
      .select('*')
      .eq('creator_id', creator.id)
      .single()

    const voiceSettingsData = {
      creator_id: creator.id,
      is_enabled: true,
      elevenlabs_voice_id: voiceData.voice_id,
      voice_name: name || `${creator.display_name} Clone`
    }

    let voiceSettings
    if (existingVoiceSettings) {
      const { data } = await supabase
        .from('voice_settings')
        .update(voiceSettingsData)
        .eq('creator_id', creator.id)
        .select()
        .single()
      voiceSettings = data
    } else {
      const { data } = await supabase
        .from('voice_settings')
        .insert(voiceSettingsData)
        .select()
        .single()
      voiceSettings = data
    }

    console.log('✅ Voice settings saved to database')

    return NextResponse.json({
      success: true,
      voiceId: voiceData.voice_id,
      voiceName: voiceSettings.voiceName,
      message: 'Voice clone created successfully'
    })

  } catch (error) {
    console.error('❌ Voice clone API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error while creating voice clone' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Get the creator
    const { data: creator } = await supabase
      .from('creator')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const { data: voiceSettings } = await supabase
      .from('voice_settings')
      .select('*')
      .eq('creator_id', creator.id)
      .single()

    if (!voiceSettings?.elevenlabs_voice_id) {
      return NextResponse.json({ error: 'No voice clone found' }, { status: 404 })
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'ElevenLabs API not configured' }, { status: 500 })
    }

    // Delete voice from ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceSettings.elevenlabs_voice_id}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': elevenLabsApiKey,
      },
    })

    if (!response.ok) {
      console.error('❌ Failed to delete voice from ElevenLabs:', response.status, await response.text())
      // Continue with database cleanup even if ElevenLabs deletion fails
    }

    // Delete voice settings from database
    await supabase
      .from('voice_settings')
      .delete()
      .eq('creator_id', creator.id)

    console.log('✅ Voice clone deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Voice clone deleted successfully'
    })

  } catch (error) {
    console.error('❌ Voice clone deletion error:', error)
    return NextResponse.json({ 
      error: 'Internal server error while deleting voice clone' 
    }, { status: 500 })
  }
}