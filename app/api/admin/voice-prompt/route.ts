import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from "@/lib/database"
import fs from 'fs'
import path from 'path'

const SUPER_ADMIN_EMAILS = [
  'the-air-fryer-g-9837@pages.plusgoogle.com',
  'admin@aitrion.com'
]

// Path to the voice agent file
const VOICE_AGENT_PATH = path.join(process.cwd(), 'agents', 'correct_voice_agent.py')

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !SUPER_ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID required' }, { status: 400 })
    }

    // Get creator details
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: { aiConfig: true }
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    // Read the current voice agent file to extract the base instructions
    let voiceAgentContent = ''
    let baseInstructions = ''
    
    try {
      voiceAgentContent = fs.readFileSync(VOICE_AGENT_PATH, 'utf8')
      
      // Extract the base_instructions from the Python file
      const instructionsMatch = voiceAgentContent.match(
        /base_instructions = \(\s*"([\s\S]*?)"\s*\)/
      )
      
      if (instructionsMatch) {
        baseInstructions = instructionsMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\\"/g, '"')
          .trim()
      }
    } catch (error) {
      console.error('Error reading voice agent file:', error)
      baseInstructions = 'Error: Could not read voice agent file'
    }

    // Build the complete system prompt that would be used for this creator
    const completePrompt = buildVoiceSystemPrompt(creator, baseInstructions)

    return NextResponse.json({
      baseInstructions,
      completePrompt,
      creatorName: creator.display_name,
      hasAiConfig: !!creator.ai_config
    })

  } catch (error) {
    console.error('Error getting voice prompt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !SUPER_ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { newBaseInstructions } = await request.json()

    if (!newBaseInstructions) {
      return NextResponse.json({ error: 'New instructions required' }, { status: 400 })
    }

    // Read the current voice agent file
    let voiceAgentContent = fs.readFileSync(VOICE_AGENT_PATH, 'utf8')

    // Replace the base_instructions section
    const escapeInstructions = newBaseInstructions
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')

    const newInstructionsBlock = `base_instructions = (
            "${escapeInstructions}"
        )`

    // Replace the existing base_instructions
    voiceAgentContent = voiceAgentContent.replace(
      /base_instructions = \(\s*"[\s\S]*?"\s*\)/,
      newInstructionsBlock
    )

    // Write the updated file
    fs.writeFileSync(VOICE_AGENT_PATH, voiceAgentContent)

    return NextResponse.json({ 
      success: true, 
      message: 'Voice agent system prompt updated successfully' 
    })

  } catch (error) {
    console.error('Error updating voice prompt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildVoiceSystemPrompt(creator: any, baseInstructions: string): string {
  // Simulate the same logic as the Python agent
  let completePrompt = baseInstructions

  if (creator.ai_config) {
    const config = creator.ai_config
    
    // Add personality traits
    let personalityNotes = []
    
    if (config.directness && config.directness !== 3) {
      if (config.directness > 3) {
        personalityNotes.push(`Be direct and straightforward in responses`)
      } else {
        personalityNotes.push(`Be gentle and diplomatic in responses`)
      }
    }
    
    if (config.humor && config.humor !== 3) {
      if (config.humor > 3) {
        personalityNotes.push(`Use humor and be playful when appropriate`)
      } else {
        personalityNotes.push(`Keep responses more serious and focused`)
      }
    }

    if (config.empathy && config.empathy !== 3) {
      if (config.empathy > 3) {
        personalityNotes.push(`Show extra empathy and understanding`)
      } else {
        personalityNotes.push(`Keep responses more factual and less emotional`)
      }
    }

    if (personalityNotes.length > 0) {
      completePrompt += `\n\nPersonality Notes: ${personalityNotes.join('. ')}.`
    }

    // Add catchphrases
    if (config.catchphrases) {
      try {
        const phrases = JSON.parse(config.catchphrases)
        if (phrases.length > 0) {
          completePrompt += `\n\nYour catchphrases (use naturally): ${phrases.join(', ')}`
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    // Add words to avoid
    if (config.avoidWords) {
      try {
        const words = JSON.parse(config.avoidWords)
        if (words.length > 0) {
          completePrompt += `\n\nAvoid these words/phrases: ${words.join(', ')}`
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  }

  return completePrompt
}