const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function cleanupAllGenericQuestions() {
  console.log('🔍 Scanning all creators for generic suggested questions...\n')

  // Get all creators with suggested questions
  const { data: allQuestions, error: fetchError } = await supabase
    .from('creator_suggested_questions')
    .select('id, creator_id, questions, created_at')

  if (fetchError) {
    console.error('❌ Error fetching questions:', fetchError)
    return
  }

  console.log(`📊 Found ${allQuestions?.length || 0} creators with suggested questions\n`)

  let genericCount = 0
  let deletedCount = 0
  const genericQuestionIds = []

  // Check each creator's questions for generic patterns
  for (const record of allQuestions || []) {
    try {
      const questions = typeof record.questions === 'string'
        ? JSON.parse(record.questions)
        : record.questions

      if (!Array.isArray(questions) || questions.length === 0) {
        continue
      }

      // Check if questions contain generic fallback patterns
      const hasGenericQuestions = questions.some(q =>
        q.basedOn?.includes('general') ||
        q.category === 'decision_making' ||
        q.category === 'prioritization' ||
        q.category === 'resilience' ||
        q.question?.includes("What's your framework for") ||
        q.question?.includes("How do you prioritize when") ||
        q.question?.includes("What's your process for learning")
      )

      if (hasGenericQuestions) {
        genericCount++
        genericQuestionIds.push(record.id)

        // Get creator info for logging
        const { data: creator } = await supabase
          .from('creators')
          .select('username, display_name')
          .eq('id', record.creator_id)
          .single()

        console.log(`🗑️  Generic questions found for: ${creator?.display_name || creator?.username || record.creator_id}`)
        console.log(`   Questions:`, questions.map(q => q.question).slice(0, 2))
        console.log(`   Created: ${new Date(record.created_at).toLocaleDateString()}`)
        console.log()
      }
    } catch (error) {
      console.error(`⚠️  Error parsing questions for ${record.creator_id}:`, error)
    }
  }

  if (genericCount === 0) {
    console.log('✅ No generic questions found! All creators have content-specific questions.')
    return
  }

  console.log(`\n⚠️  Found ${genericCount} creators with generic/fallback questions`)
  console.log(`\nDeleting generic questions for all ${genericCount} creators...`)

  // Delete all generic questions
  for (const id of genericQuestionIds) {
    const { error: deleteError } = await supabase
      .from('creator_suggested_questions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error(`❌ Error deleting questions ${id}:`, deleteError)
    } else {
      deletedCount++
    }
  }

  console.log(`\n✅ Deleted ${deletedCount}/${genericCount} generic question records`)
  console.log('\n📝 Summary:')
  console.log(`   • Total creators checked: ${allQuestions?.length || 0}`)
  console.log(`   • Generic questions found: ${genericCount}`)
  console.log(`   • Records deleted: ${deletedCount}`)
  console.log(`   • Creators with good questions: ${(allQuestions?.length || 0) - genericCount}`)

  console.log('\n💡 Next Steps:')
  console.log('   1. Creators can now manually set questions via /creator/suggested-questions')
  console.log('   2. Or trigger AI regeneration via the API: POST /api/creator/suggested-questions')
  console.log('   3. The updated code will NOT generate generic fallback questions anymore')
}

cleanupAllGenericQuestions()
