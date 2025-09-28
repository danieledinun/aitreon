import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import path from 'path'

// Admin emails for access control - should be configured via environment variables
const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'admin-secret-key'

async function checkAdminAuth(request: NextRequest) {
  // Check for admin token first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, JWT_SECRET) as any
      if (decoded.role === 'admin') {
        return { isAdmin: true, email: decoded.email || 'admin' }
      }
    } catch (error) {
      // Invalid token, continue to NextAuth check
    }
  }

  // Fallback to NextAuth session
  const session = await getServerSession(authOptions)
  if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
    return { isAdmin: true, email: session.user.email }
  }

  return { isAdmin: false, email: null }
}

// Get current prompts from voice agent
async function getCurrentVoicePrompts(creatorId?: string | null) {
  try {
    // First check for custom prompts
    const customPromptsPath = path.join(process.cwd(), 'custom_prompts.json')
    
    try {
      const customContent = await fs.readFile(customPromptsPath, 'utf-8')
      const customPrompts = JSON.parse(customContent)
      
      if (customPrompts.voiceBaseInstructions && customPrompts.voiceBaseInstructions.trim()) {
        console.log('📝 Loading CUSTOM voice prompt from admin interface')
        return {
          voiceBaseInstructions: customPrompts.voiceBaseInstructions,
          voiceCompletePrompt: customPrompts.voiceBaseInstructions,
          isCustom: true,
          updatedAt: customPrompts.updatedAt,
          updatedBy: customPrompts.updatedBy,
          creatorId: creatorId || 'global'
        }
      }
    } catch (customError) {
      console.log('📝 No custom voice prompts found, generating creator-specific prompts')
    }

    // If we have a creator ID, generate creator-specific voice prompts
    if (creatorId) {
      try {
        const { supabase } = await import('@/lib/supabase')

        // Get creator information with AI config
        const { data: creator } = await supabase
          .from('creators')
          .select(`
            id,
            username,
            display_name,
            ai_config(
              agent_name,
              agent_intro,
              directness,
              humor,
              empathy,
              formality,
              spiciness,
              sentence_length,
              format_default,
              use_emojis,
              citation_policy,
              catchphrases,
              avoid_words
            )
          `)
          .eq('id', creatorId)
          .single()

        if (creator) {
          console.log(`📝 Generating voice prompt for creator: ${creator.display_name} (${creator.id})`)

          const aiConfig = creator.ai_config?.[0]
          const agentName = aiConfig?.agent_name || creator.display_name
          const agentIntro = aiConfig?.agent_intro || `a content creator`

          // Generate comprehensive creator-specific voice prompt based on Air Fryer Geek format
          const catchphrases = aiConfig?.catchphrases ? JSON.parse(aiConfig.catchphrases || '[]') : []
          const avoidWords = aiConfig?.avoid_words ? JSON.parse(aiConfig.avoid_words || '[]') : []

          const creatorVoicePrompt = `You are ${agentName}'s AI assistant having a VOICE CONVERSATION with memory! This is a spoken conversation - speak naturally as if talking to a friend.

IMPORTANT: If someone says 'hello', 'hi', or similar greetings, respond with: 'Hey there! I'm your ${agentName} assistant. What would you like to know about ${creator.display_name.includes('pickleball') ? 'pickleball' : creator.display_name.includes('air fryer') ? 'cooking' : 'my content'}? I can help you with ${creator.display_name.includes('pickleball') ? 'techniques, strategies, or any pickleball questions' : creator.display_name.includes('air fryer') ? 'recipes, cooking tips, or any cooking questions' : 'tips, advice, or any questions about my content'} you have!'

PERSONALITY & STYLE:
- Directness Level: ${aiConfig?.directness || 3}/5 ${aiConfig?.directness >= 4 ? '(Be very direct and to the point)' : aiConfig?.directness <= 2 ? '(Be gentle and diplomatic)' : '(Be moderately direct)'}
- Humor Level: ${aiConfig?.humor || 3}/5 ${aiConfig?.humor >= 4 ? '(Use plenty of jokes and be playful)' : aiConfig?.humor <= 2 ? '(Keep it professional with minimal humor)' : '(Use appropriate humor)'}
- Empathy Level: ${aiConfig?.empathy || 3}/5 ${aiConfig?.empathy >= 4 ? '(Be very understanding and supportive)' : aiConfig?.empathy <= 2 ? '(Focus on facts over feelings)' : '(Be appropriately empathetic)'}
- Formality Level: ${aiConfig?.formality || 3}/5 ${aiConfig?.formality >= 4 ? '(Use formal language and proper grammar)' : aiConfig?.formality <= 2 ? '(Be casual and use relaxed language)' : '(Use moderately formal language)'}
- Energy Level: ${aiConfig?.spiciness || 3}/5 ${aiConfig?.spiciness >= 4 ? '(Be very enthusiastic and energetic!)' : aiConfig?.spiciness <= 2 ? '(Keep a calm, measured tone)' : '(Use moderate enthusiasm)'}

${catchphrases.length > 0 ? `SIGNATURE PHRASES: Use these naturally in conversation: "${catchphrases.join('", "')}"` : ''}
${avoidWords.length > 0 ? `AVOID THESE WORDS/PHRASES: Never use: "${avoidWords.join('", "')}"` : ''}

VOICE CONVERSATION GUIDELINES:
Help users with questions about ${agentIntro}. Keep responses SHORT and conversational since this is voice chat - like a real conversation. Be enthusiastic about your expertise! Use natural speech patterns with casual language.

IMPORTANT VOICE RULES:
- Remember this is VOICE - avoid saying "I read" or "I see" - say "I hear" or "you mentioned" instead
- Keep answers brief and engaging for natural back-and-forth conversation
- Speak as ${agentName} in first person - reference YOUR videos, YOUR experiences, YOUR techniques
- Use conversational fillers like "well", "you know", "actually" to sound natural
- Ask follow-up questions to keep the conversation flowing

VIDEO SUGGESTIONS - INTELLIGENT SYSTEM:
You now have access to video search tools that help you make intelligent decisions about video suggestions!

IMPORTANT: Use the video tools to 'see' what videos are available and when to suggest them:

USING YOUR VIDEO TOOLS:
1. FIRST - Use 'should_suggest_video' tool to analyze if the user wants to learn something
2. IF YES - Use 'search_videos' tool to find relevant videos for their query
3. THEN - Explain what videos you found and why you're suggesting them
4. FINALLY - Only use citations [1], [2], [3] when user confirms they want to see videos

INTELLIGENT VIDEO BEHAVIOR:
- For casual chat ('hi', 'thanks', 'cool') → NO video suggestions
- For technique questions ('how do I ${creator.display_name.includes('pickleball') ? 'serve better' : creator.display_name.includes('air fryer') ? 'cook chicken nuggets' : 'improve'}') → MENTION video availability but DON'T show yet
- For explicit requests ('show me how', 'let me see', 'display video') → USE citations to show videos
- Always explain why you're suggesting a video: 'I have a great video that shows the exact technique!'
- For technique questions, offer videos: 'Would you like me to show you a video tutorial?'
- Be transparent about alternatives: 'I don't have that exact technique, but this similar approach uses the same principles!'

CITATION GUIDELINES - CONSERVATIVE APPROACH:
Only include numbered citations [1], [2], [3] when user EXPLICITLY asks to see/show/watch videos!
- For technique questions → SUGGEST videos but DON'T use citations yet
- For explicit video requests ('show me', 'let me see') → THEN use citations
- DON'T auto-show videos for general questions
- When you use citations, explain what video will appear:
  'Here's my ${creator.display_name.includes('pickleball') ? 'serve technique video' : creator.display_name.includes('air fryer') ? 'recipe video' : 'tutorial'} [1] - you'll see the exact technique!'
  'This video [2] shows the timing and form that makes it work!'

IMPORTANT: These citation numbers [1], [2], [3] are SILENT markers - DO NOT speak them out loud! They trigger video displays, so only use them when user explicitly requests to see videos.`

          return {
            voiceBaseInstructions: creatorVoicePrompt,
            voiceCompletePrompt: creatorVoicePrompt,
            isCustom: false,
            creatorId: creator.id,
            creatorName: creator.display_name
          }
        }
      } catch (error) {
        console.error(`Error generating creator-specific voice prompt for ${creatorId}:`, error)
      }
    }

    // Fall back to reading from voice agent file (default prompts)
    const voiceAgentPath = path.join(process.cwd(), 'agents', 'correct_voice_agent.py')
    const content = await fs.readFile(voiceAgentPath, 'utf-8')
    
    // Extract the entire base_instructions block - it's a multi-line string
    const instructionsMatch = content.match(/base_instructions = \(\s*((?:"[^"]*"\s*)+)\s*\)/s)
    
    if (instructionsMatch) {
      // Clean up the matched instructions - preserve formatting
      let baseInstructions = instructionsMatch[1]
        .replace(/"\s*"/g, '') // Remove quote concatenations
        .replace(/\\n\\n/g, '\n\n') // Convert \\n\\n to actual line breaks
        .replace(/\\n/g, '\n') // Convert \\n to actual line breaks
        .replace(/"/g, '') // Remove all quotes
        .trim()
      
      return {
        voiceBaseInstructions: baseInstructions,
        voiceCompletePrompt: baseInstructions,
        isCustom: false,
        creatorId: creatorId || 'default'
      }
    }
    
    return {
      voiceBaseInstructions: `Could not parse voice agent instructions${creatorId ? ` for creator ${creatorId}` : ''}`,
      voiceCompletePrompt: `Could not parse voice agent instructions${creatorId ? ` for creator ${creatorId}` : ''}`,
      isCustom: false,
      creatorId: creatorId || 'error'
    }
  } catch (error) {
    console.error('Error reading voice agent prompts:', error)
    return {
      voiceBaseInstructions: 'Error loading current prompts: ' + (error instanceof Error ? error.message : String(error)),
      voiceCompletePrompt: 'Error loading current prompts: ' + (error instanceof Error ? error.message : String(error)),
      isCustom: false,
      creatorId: creatorId || 'error'
    }
  }
}

// Get current prompts from chat RAG service - ACTUAL full prompt
async function getCurrentChatPrompts(creatorId?: string | null) {
  try {
    // First check for custom chat prompts
    const customPromptsPath = path.join(process.cwd(), 'custom_prompts.json')

    try {
      const customContent = await fs.readFile(customPromptsPath, 'utf-8')
      const customPrompts = JSON.parse(customContent)

      if (customPrompts.chatBaseInstructions && customPrompts.chatBaseInstructions.trim()) {
        console.log('📝 Loading CUSTOM chat prompt from admin interface')
        return {
          systemPrompt: customPrompts.chatBaseInstructions,
          completePrompt: customPrompts.chatBaseInstructions,
          isCustom: true,
          updatedAt: customPrompts.updatedAt,
          updatedBy: customPrompts.updatedBy,
          creatorId: creatorId || 'global'
        }
      }
    } catch (customError) {
      console.log('📝 No custom chat prompts found, loading default from RAG service')
    }

    // Fall back to generating from RAG service (default prompts)
    // Import the RAG service to use its generateSystemPromptForAdmin method
    const { RAGService } = await import('@/lib/rag-service')
    const { supabase } = await import('@/lib/supabase')

    let creator

    if (creatorId) {
      // Use the specified creator
      const { data: selectedCreator } = await supabase
        .from('creators')
        .select('id, username, display_name')
        .eq('id', creatorId)
        .single()

      creator = selectedCreator
    } else {
      // Fall back to the first creator if no ID specified
      const { data: creators } = await supabase
        .from('creators')
        .select('id, username, display_name')
        .order('created_at', { ascending: true })
        .limit(1)

      creator = creators?.[0]
    }

    if (!creator) {
      return {
        systemPrompt: `No creator found${creatorId ? ` with ID: ${creatorId}` : ' in database'}`,
        completePrompt: `No creator found${creatorId ? ` with ID: ${creatorId}` : ' in database'}`,
        isCustom: false,
        creatorId: creatorId || 'none'
      }
    }

    console.log(`📝 Generating chat prompt for creator: ${creator.display_name} (${creator.id})`)

    // Generate the ACTUAL complete system prompt that gets sent to ChatGPT for this specific creator
    const fullSystemPrompt = await RAGService.generateSystemPromptForAdmin(
      creator.id,
      "What's your best advice for beginners?", // Sample query
      `[Source 1]:
Video: "Getting Started" (at 2:15)
Content: The most important thing for beginners is to start with the basics and build confidence...
---

[Source 2]:
Video: "Common Mistakes to Avoid" (at 0:45)
Content: Many beginners make these common mistakes that can be easily avoided...
---`
    )

    return {
      systemPrompt: fullSystemPrompt,
      completePrompt: fullSystemPrompt,
      isCustom: false,
      creatorId: creator.id,
      creatorName: creator.display_name
    }

  } catch (error) {
    console.error('Error generating actual chat prompts:', error)
    return {
      systemPrompt: 'Error loading current chat prompts: ' + (error instanceof Error ? error.message : String(error)),
      completePrompt: 'Error loading current chat prompts: ' + (error instanceof Error ? error.message : String(error)),
      isCustom: false,
      creatorId: creatorId || 'error'
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const { isAdmin, email } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get creator ID from query parameters
    const url = new URL(request.url)
    const creatorId = url.searchParams.get('creatorId')

    // Get current prompts from the voice agent
    const voicePrompts = await getCurrentVoicePrompts(creatorId)

    // Get current chat prompts from RAG Service
    const chatPrompts = await getCurrentChatPrompts(creatorId)

    return NextResponse.json({
      voice: voicePrompts,
      chat: chatPrompts,
      timestamp: new Date().toISOString(),
      creatorId: creatorId || 'default'
    })

  } catch (error) {
    console.error('❌ Prompts API error:', error)
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const { isAdmin, email } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, prompt } = body // type: 'voice' or 'chat', prompt: new prompt content

    if (type === 'voice') {
      // Update voice agent prompts - save to JSON file that voice agent reads
      const promptsPath = path.join(process.cwd(), 'custom_prompts.json')
      
      let customPrompts = {}
      try {
        const existing = await fs.readFile(promptsPath, 'utf-8')
        customPrompts = JSON.parse(existing)
      } catch (error) {
        // File doesn't exist, start fresh
      }

      customPrompts = {
        ...customPrompts,
        voiceBaseInstructions: prompt,
        updatedAt: new Date().toISOString(),
        updatedBy: email
      }

      await fs.writeFile(promptsPath, JSON.stringify(customPrompts, null, 2))

      console.log(`✅ Voice prompt saved to ${promptsPath}`)
      console.log(`📝 New prompt preview: "${prompt.substring(0, 100)}..."`)

      // Note: Voice agent will automatically pick up the new prompt on next conversation
      // The voice agent checks this file in _load_custom_or_default_prompt()

      return NextResponse.json({
        success: true,
        message: 'Voice prompt updated successfully! The voice agent will use this prompt for new conversations.',
        timestamp: new Date().toISOString(),
        promptPreview: prompt.substring(0, 100) + '...'
      })
    }

    if (type === 'chat') {
      // Update chat agent prompts - save to JSON file that RAG service reads
      const promptsPath = path.join(process.cwd(), 'custom_prompts.json')
      
      let customPrompts = {}
      try {
        const existing = await fs.readFile(promptsPath, 'utf-8')
        customPrompts = JSON.parse(existing)
      } catch (error) {
        // File doesn't exist, start fresh
      }

      customPrompts = {
        ...customPrompts,
        chatBaseInstructions: prompt,
        updatedAt: new Date().toISOString(),
        updatedBy: email
      }

      await fs.writeFile(promptsPath, JSON.stringify(customPrompts, null, 2))

      console.log(`✅ Chat prompt saved to ${promptsPath}`)
      console.log(`📝 New chat prompt preview: "${prompt.substring(0, 100)}..."`)

      // Note: Chat agent will automatically pick up the new prompt on next conversation
      // The RAG service will check this file in buildSystemPrompt()

      return NextResponse.json({
        success: true,
        message: 'Chat prompt updated successfully! The chat agent will use this prompt for new conversations.',
        timestamp: new Date().toISOString(),
        promptPreview: prompt.substring(0, 100) + '...'
      })
    }

    return NextResponse.json({ error: 'Invalid prompt type' }, { status: 400 })

  } catch (error) {
    console.error('❌ Update prompts API error:', error)
    return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 })
  }
}