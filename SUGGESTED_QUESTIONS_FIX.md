# Suggested Questions - Production Fix

## Problem

Creators were receiving generic, unrelated suggested questions when the AI generation system failed:
- "What's your framework for making important decisions?"
- "How do you prioritize when everything seems important?"
- "What's your process for learning new skills quickly?"
- etc.

These questions had **no relationship** to the creator's actual content, providing a poor user experience.

## Root Cause

The `SuggestedQuestionsGenerator` class in `/lib/suggested-questions-generator.ts` had a `getFallbackQuestions()` method that returned hardcoded generic questions when AI generation failed.

This was triggered when:
- Creator had no processed videos
- OpenAI API calls failed
- Database errors occurred
- Any exception in the generation pipeline

## Production-Ready Solution

### 1. Fixed Fallback Behavior

**Before:**
```typescript
private static getFallbackQuestions(): SuggestedQuestion[] {
  return [
    {
      question: "What's your framework for making important decisions?",
      category: "decision_making",
      confidence: 0.7,
      basedOn: ["general"]
    },
    // ... more generic questions
  ]
}
```

**After:**
```typescript
private static getFallbackQuestions(): SuggestedQuestion[] {
  console.warn('⚠️  CRITICAL: getFallbackQuestions() called - AI generation failed!')
  console.warn('⚠️  This means suggested questions could not be generated from creator content')
  console.warn('⚠️  Returning empty array - creator should manually set questions or fix AI generation')

  // Return empty array - no questions is better than irrelevant generic questions
  return []
}
```

### 2. Improved Error Logging

Added comprehensive logging to track when and why generation fails:

```typescript
// Creator not found
console.error(`❌ Creator not found: ${creatorId}`)
console.error('Cannot generate questions for non-existent creator')

// No processed videos
console.warn('⚠️  PRODUCTION ISSUE: No processed videos found for creator:', creatorId)
console.warn('Creator needs to sync their YouTube content before AI questions can be generated')

// General errors
console.error('❌ Error generating suggested questions:', error)
console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
console.error(`Creator ID: ${creatorId}`)
```

### 3. Database Cleanup Script

Created `/scripts/cleanup-all-generic-questions.js` to identify and remove all generic questions for all creators:

```bash
NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/cleanup-all-generic-questions.js
```

The script:
- Scans all creators for generic question patterns
- Identifies questions with `basedOn: ["general"]` or generic categories
- Deletes all generic question records
- Provides detailed logging and statistics

### 4. Content-Specific Example Script

Created `/scripts/regenerate-lance-questions.js` as a template for manually creating content-specific questions when needed.

## How It Works Now

1. **AI Generation First**: System attempts to generate questions from actual video content
2. **Creator-Specific Fallback**: If no videos, uses creator profile info (better than generic)
3. **Empty Array Last Resort**: If all else fails, returns `[]` instead of generic questions
4. **Manual Override**: Creators can always set custom questions via `/creator/suggested-questions`

## Benefits

✅ **No More Generic Questions**: System will never show irrelevant fallback questions
✅ **Better UX**: Empty questions is better than misleading generic ones
✅ **Visibility**: Enhanced logging makes failures obvious and debuggable
✅ **Scalable**: Works for all creators, not just one-off fixes
✅ **Production Ready**: Proper error handling and monitoring

## Migration Path

### For Existing Creators

1. Run cleanup script to remove generic questions:
   ```bash
   node scripts/cleanup-all-generic-questions.js
   ```

2. Creators with processed videos: Questions will regenerate automatically on next access
3. Creators without videos: Need to sync YouTube content first
4. Manual option: Creators can set questions at `/creator/suggested-questions`

### For New Creators

1. Sync YouTube content first
2. AI will automatically generate content-specific questions
3. If generation fails, creator sees empty state with prompt to add manual questions

## API Endpoints

### GET /api/creator/suggested-questions
Query parameters:
- `creatorId` (required): Creator ID
- `refresh` (optional): Force regenerate questions
- `debug` (optional): Include debug information

### POST /api/creator/suggested-questions
Manually trigger question regeneration for a creator.

### POST /api/creator/custom-questions
Save creator-defined custom questions.

## Monitoring

Watch for these log messages in production:

**🚨 Critical - AI Generation Failed:**
```
⚠️  CRITICAL: getFallbackQuestions() called - AI generation failed!
```

**⚠️  Warning - No Videos:**
```
⚠️  PRODUCTION ISSUE: No processed videos found for creator
```

**❌ Error - System Failure:**
```
❌ Error generating suggested questions: [error details]
```

## Testing

1. **Test AI generation works**:
   ```bash
   curl "http://localhost:3000/api/creator/suggested-questions?creatorId=<id>&refresh=true"
   ```

2. **Test fallback returns empty array**:
   - Create creator with no videos
   - Check questions endpoint returns `{ questions: [], count: 0 }`

3. **Test manual questions**:
   - Visit `/creator/suggested-questions`
   - Add custom questions
   - Verify they appear in chat interface

## Files Modified

- `/lib/suggested-questions-generator.ts` - Fixed fallback logic, improved logging
- `/scripts/cleanup-all-generic-questions.js` - Database cleanup utility
- `/scripts/regenerate-lance-questions.js` - Example content-specific questions

## Build Status

✅ Production build completed successfully with updated code
✅ All tests passing
✅ No breaking changes to API

## Next Steps

1. Deploy updated code to production
2. Run cleanup script to remove existing generic questions
3. Monitor logs for AI generation failures
4. Consider adding:
   - Admin dashboard to view/manage questions
   - Analytics on question click-through rates
   - A/B testing different question formats
   - Automatic regeneration on content sync
