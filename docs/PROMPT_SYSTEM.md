# Unified Prompt Generation System

## Overview

The unified prompt generation system creates production-ready AI prompts that incorporate:
- **AI Configuration** (personality traits, content style, boundaries)
- **Speech Patterns** (signature phrases from transcripts)
- **Style Cards** (communication tone and approach)
- **Dynamic Citations** (relevant content with proper attribution)

## Architecture

### Core Components

1. **`PromptTemplateService`** (`lib/prompt-template-service.ts`)
   - Template-based prompt generation
   - Variable substitution for creator-specific data
   - Structured sections for consistency

2. **`UnifiedPromptService`** (`lib/unified-prompt-service.ts`)
   - Database integration layer
   - Loads creator configuration from Supabase
   - Coordinates data assembly

3. **`EnhancedRAGService`** (`lib/enhanced-rag-service.ts`)
   - Uses unified prompts for AI responses
   - Integrates with citation system

## Data Sources

### 1. AI Config (`ai_config` table)
```typescript
{
  agent_name: string              // "Tanner"
  agent_intro: string             // "a pickleball expert..."
  directness: number              // 1-5 scale
  humor: number                   // 1-5 scale
  empathy: number                 // 1-5 scale
  formality: number               // 1-5 scale
  sentence_length: enum           // SHORT | MEDIUM | LONG
  format_default: enum            // BULLETS | PARAGRAPH | MIXED
  use_emojis: enum                // NEVER | SOMETIMES | OFTEN
  catchphrases: string[]          // Manual signature phrases
  avoid_words: string[]           // Words to never use
  red_lines: string[]             // Sensitive topics
  competitor_policy: enum         // NEUTRAL | SUPPORTIVE | AVOID
}
```

### 2. Speech Analysis (`speech_analysis` table)
```typescript
{
  signature_phrases: {            // Auto-detected from transcripts
    "pickleball": 15,             // phrase: frequency
    "tournament": 12,
    "strategy": 8,
    "you need to": 8,
    "level": 7,
    "focus on": 6,
    "here's what": 5,
    "make sure": 4
  },
  communication_metrics: {
    "Authority tone": 2.1,
    "Direct address": 3.2,
    "Instructional ratio": 2.8
  }
}
```

### 3. Style Cards (`style_cards` table)
```typescript
{
  style_card_text: string         // Full markdown profile
  signature_phrases: object       // Duplicate of speech_analysis
  communication_metrics: object   // Duplicate of speech_analysis
  ai_prompting_guidelines: string // Optional custom guidelines
  is_active: boolean
}
```

## Prompt Structure

The generated prompt follows this structure:

```
1. IDENTITY SECTION
   - Who the AI represents
   - Core mission/intro
   - Important rules

2. PERSONALITY CONFIGURATION
   - Directness, Humor, Empathy, Formality (1-5 scale)
   - Natural language trait descriptions

3. CONTENT STYLE
   - Sentence length preferences
   - Formatting preferences (bullets vs paragraphs)
   - Emoji usage policy

4. SPEECH PATTERNS
   - Top signature phrases (auto-detected)
   - Manual catchphrases
   - Authenticity reminder

5. TONE & STYLE
   - Extracted from style card
   - Communication approach
   - Response structure

6. CONTENT BOUNDARIES
   - Words/phrases to avoid
   - Red line topics
   - Competitor mention policy

7. RELEVANT CONTENT CONTEXT
   - [Source 1]: Video title (timestamp)
     Content: ...
   - [Source 2]: Video title (timestamp)
     Content: ...

8. RESPONSE RULES
   - Must use ALL citations
   - No mixing citation content
   - Sequential citation order

9. CITATION REQUIREMENTS
   - Use numbered citations [1], [2], [3]
   - Never write "in my video"
   - Mandatory enforcement
```

## Usage Examples

### Basic Usage (Chat Endpoint)

```typescript
import { UnifiedPromptService } from '@/lib/unified-prompt-service'

// In your chat API endpoint
const systemPrompt = await UnifiedPromptService.generateCreatorPrompt({
  creatorId: 'creator-id',
  creatorName: 'Tanner',
  relevantContent: [
    {
      videoTitle: 'Getting Started',
      timestamp: '2:15',
      content: 'Focus on the basics...',
      citationNumber: 1
    },
    // ... more citations
  ]
})

// Use with OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ]
})
```

### Admin/Debug Usage

```typescript
import { UnifiedPromptService } from '@/lib/unified-prompt-service'

// Generate preview prompt for testing
const debugPrompt = await UnifiedPromptService.generateDebugPrompt(
  'creator-id',
  'Tanner',
  'What is your best pickleball advice?',
  `Video: "Getting Started" (2:15)
Content: Focus on the basics and build confidence...

Video: "Tournament Strategy" (3:30)
Content: When playing a tournament, you need to...`
)

console.log(debugPrompt)
```

## Testing

Run the test script to verify prompt generation:

```bash
NEXT_PUBLIC_SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
npx tsx scripts/test-prompt-generation.ts
```

### Test Coverage

✅ All 8 signature phrases included
✅ AI configuration (directness, humor, empathy, formality)
✅ Content style preferences
✅ Citation structure and rules
✅ All prompt sections present

## Key Features

### 1. **Production-Ready Templates**
- No hardcoded creator names or details
- All variables pulled from database
- Consistent structure across all creators

### 2. **Speech Pattern Integration**
- Auto-detected phrases from transcripts
- Organic incorporation into prompts
- Frequency-based prioritization (top 10)

### 3. **Flexible Configuration**
- Database-driven (no code changes needed)
- Supports any creator with any speaking style
- Falls back gracefully if data missing

### 4. **Maintainable Architecture**
- Separation of concerns (template vs data loading)
- Easy to update prompt structure
- Clear variable substitution

## Migration Notes

### Old System (`buildPersonalityPrompt`)
- ❌ Did not incorporate speech patterns
- ❌ Mixed configuration logic with template
- ❌ Hard to maintain and update

### New System (`UnifiedPromptService`)
- ✅ Incorporates speech patterns automatically
- ✅ Clean separation: template + data
- ✅ Easy to maintain and extend

## Future Enhancements

1. **Dynamic Section Ordering**
   - Reorder sections based on creator preference
   - A/B testing different prompt structures

2. **Multi-Language Support**
   - Template translations
   - Language-specific speech patterns

3. **Prompt Versioning**
   - Track prompt template versions
   - A/B test prompt effectiveness
   - Roll back if needed

4. **Advanced Speech Pattern Analysis**
   - Sentence structure patterns
   - Rhetorical question usage
   - Opening/closing patterns

## Example Output

For Tanner (@tanner.pickleball), the system generates:

```
You are Tanner, a pickleball expert and tournament player who shares
strategic advice and techniques through my YouTube content.

SPEECH PATTERNS - Use these signature phrases naturally:
• "pickleball"
• "tournament"
• "strategy"
• "you need to"
• "level"
• "focus on"
• "here's what"
• "make sure"

TONE: Maintain a confident and authoritative coaching style,
strategic, goal-oriented instruction, direct, no-nonsense approach
to improvement, tournament-focused mindset, emphasizes practical
application tone throughout your responses.

AUTHENTICITY: Sound natural and genuine like Tanner. Incorporate
the speech patterns above organically - don't force them, but use
them when they fit naturally into your response.

[... rest of prompt ...]
```

## Related Files

- `lib/prompt-template-service.ts` - Template engine
- `lib/unified-prompt-service.ts` - Data loader
- `lib/enhanced-rag-service.ts` - Integration point
- `scripts/test-prompt-generation.ts` - Test suite
- `services/speech_analysis/` - Speech pattern analysis
