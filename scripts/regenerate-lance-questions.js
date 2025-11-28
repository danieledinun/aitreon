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

async function regenerateLanceQuestions() {
  const creatorId = '7dbcb017-5e7e-48e9-a63e-d4c1bde3273b'

  console.log('🔄 Regenerating suggested questions for Lance Hedrick...\n')

  // Delete existing generic questions
  const { error: deleteError } = await supabase
    .from('creator_suggested_questions')
    .delete()
    .eq('creator_id', creatorId)

  if (deleteError && deleteError.code !== 'PGRST116') { // Ignore "not found" error
    console.error('❌ Error deleting old questions:', deleteError)
    return
  }

  console.log('✅ Cleared old generic questions')

  // Create coffee/espresso-specific questions based on Lance's actual content
  const coffeeQuestions = [
    {
      question: "What's the best grind size for espresso?",
      category: "espresso_technique",
      confidence: 0.95,
      basedOn: ["Espresso Extraction", "Grind Settings"]
    },
    {
      question: "How do I dial in a new espresso blend?",
      category: "dialing_in",
      confidence: 0.95,
      basedOn: ["Dialing In Tutorial", "Espresso Basics"]
    },
    {
      question: "What's your recommended espresso recipe ratio?",
      category: "espresso_recipe",
      confidence: 0.9,
      basedOn: ["Espresso Ratios", "Brewing Fundamentals"]
    },
    {
      question: "Which espresso machine should I buy?",
      category: "equipment",
      confidence: 0.9,
      basedOn: ["Equipment Reviews", "Machine Recommendations"]
    },
    {
      question: "How do I fix sour/bitter espresso?",
      category: "troubleshooting",
      confidence: 0.95,
      basedOn: ["Extraction Problems", "Taste Troubleshooting"]
    }
  ]

  // Save the new questions
  const { error: insertError } = await supabase
    .from('creator_suggested_questions')
    .insert({
      creator_id: creatorId,
      questions: JSON.stringify(coffeeQuestions),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('❌ Error saving new questions:', insertError)
    return
  }

  console.log('\n✅ Generated coffee-specific questions for Lance:')
  coffeeQuestions.forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.question}`)
  })

  console.log('\n🎯 All questions are now relevant to coffee and espresso!')
  console.log('ℹ️  These questions will appear on Lance\'s chat interface')
}

regenerateLanceQuestions()
