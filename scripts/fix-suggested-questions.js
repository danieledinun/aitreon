const { supabase } = require('../lib/supabase')

async function fixSuggestedQuestions() {
  console.log('🔧 Fixing suggested questions for The Air Fryer Geek...')
  
  const creatorId = 'cmeggjlxp0015wvebg2952wcq'
  
  // Air fryer themed personalized questions based on the channel content
  const airFryerQuestions = [
    {
      "question": "Best temp for crispy air fryer wings?",
      "category": "air_fryer_tips", 
      "confidence": 0.95,
      "basedOn": ["Chicken Wings Recipe", "Air Fryer Techniques"]
    },
    {
      "question": "How to make Chick-fil-A sandwich at home?",
      "category": "recipes",
      "confidence": 0.9, 
      "basedOn": ["Chick-fil-A Spicy Chicken Sandwich", "Copycat Recipes"]
    },
    {
      "question": "Frozen vs fresh fries cooking time?",
      "category": "cooking_tips",
      "confidence": 0.9,
      "basedOn": ["French Fries Guide", "Air Fryer Basics"]
    },
    {
      "question": "What oil spray works best for air frying?",
      "category": "equipment", 
      "confidence": 0.85,
      "basedOn": ["Air Fryer Setup Tips", "Equipment Reviews"]
    },
    {
      "question": "How to avoid overcooking chicken nuggets?",
      "category": "cooking_tips",
      "confidence": 0.8,
      "basedOn": ["Wendy's Chicken Nuggets", "Cooking Techniques"]
    }
  ]
  
  try {
    // Update the existing record
    const { data, error } = await supabase
      .from('creator_suggested_questions')
      .update({
        questions: JSON.stringify(airFryerQuestions),
        updated_at: new Date().toISOString()
      })
      .eq('creator_id', creatorId)
    
    if (error) {
      console.error('❌ Error updating:', error)
      return
    }
    
    console.log('✅ Successfully updated suggested questions with Air Fryer themed content!')
    console.log('Questions updated:', airFryerQuestions.map(q => q.question))
    
  } catch (error) {
    console.error('❌ Error updating suggested questions:', error)
  }
}

fixSuggestedQuestions()