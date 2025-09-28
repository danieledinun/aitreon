const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addRealVideoData() {
  console.log('🚀 Adding real Air Fryer Geek video to the knowledge base...')
  
  try {
    // Find the creator "theairfryergeekhg04"
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('*')
      .eq('username', 'theairfryergeekhg04')
      .single()

    if (creatorError || !creator) {
      console.error('❌ Creator not found:', creatorError)
      return
    }

    console.log('✅ Found creator:', creator.display_name)

    // Real video data from Wendy's spicy chicken nuggets
    const realVideo = {
      creator_id: creator.id,
      youtube_id: 'KpPCIG7v158', // Real YouTube video ID
      title: "Making Wendy's Spicy Chicken Nuggets | But Air Fried",
      description: "Ciao Culinary gigs! Today is another fantastic episode of but Air Fried where we make recipes from famous fast food chains. We try to replicate it and make it in the air fryer. Today's episode is dedicated to the super hyped Wendy's spicy chicken nuggets!",
      thumbnail: 'https://img.youtube.com/vi/KpPCIG7v158/maxresdefault.jpg',
      duration: 540, // About 9 minutes
      published_at: new Date('2024-01-01'), // Approximate date
      is_processed: true,
      created_at: new Date(),
      updated_at: new Date()
    }

    // Insert video
    const { data: insertedVideo, error: videoError } = await supabase
      .from('videos')
      .insert([realVideo])
      .select()
      .single()

    if (videoError) {
      console.error('❌ Error inserting video:', videoError)
      return
    }

    console.log('✅ Added video:', insertedVideo.title)

    // Real content chunks from the transcript
    const contentChunks = [
      {
        video_id: insertedVideo.id,
        chunk_text: "Ciao Culinary gigs! Today is another fantastic episode of but Air Fried where we make recipes from famous fast food chains. We try to replicate it and make it in the air fryer. Today's episode is dedicated to the super hyped Wendy's spicy chicken nuggets!",
        start_time: 0.08,
        end_time: 21.12,
        chunk_index: 0
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "I'm starting with a pound of ground chicken breast. I bought this from the store, this is 100% chicken breast that I found at Whole Foods. I'm gonna add half tablespoon powdered sugar, one teaspoon of salt, half teaspoon of smoked paprika, half teaspoon of black pepper and half teaspoon of granulated garlic.",
        start_time: 85.52,
        end_time: 110.08,
        chunk_index: 1
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "Now I'm going to start the three-step process. First step is flour - I have half cup of all-purpose flour. I'm gonna add spices: one teaspoon of powdered sugar, half teaspoon of cayenne pepper, one-third teaspoon of black pepper, granulated garlic, onion powder, salt and smoked paprika.",
        start_time: 160.4,
        end_time: 199.44,
        chunk_index: 2
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "My second step is to prepare egg wash. This egg wash is going to be pretty spicy. I start with three thirds of a cup of water, I'm gonna add one-third of a cup of hot sauce - I love Frank's hot sauce - and one egg. The third step is gonna be panko breadcrumbs.",
        start_time: 221.44,
        end_time: 241.68,
        chunk_index: 3
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "Now I'm gonna start by preheating my air fryer. I'm using the Cosori air fryer. My tip is for the first part of cooking, don't use any oil because the surface of our chicken nuggets is cold. If we spray oil it's gonna soak up and they're gonna get soggy.",
        start_time: 276.96,
        end_time: 366.72,
        chunk_index: 4
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "I'm gonna cook at 360 degrees Fahrenheit for four minutes with no oil. After four minutes I'm gonna crank up my air fryer to 400 degrees Fahrenheit for another four minutes. I'm gonna flip it over, spray a little bit of oil, and at the two minute mark flip it over again and spray more oil.",
        start_time: 382.96,
        end_time: 411.04,
        chunk_index: 5
      },
      {
        video_id: insertedVideo.id,
        chunk_text: "These chicken nuggets look absolutely amazing! They are soft inside, very airy, much lighter than Wendy's. They're super soft inside, super moist, and outside they're super nice and crunchy. They're pretty spicy. This version is way way better than Wendy's, no question asked!",
        start_time: 427.76,
        end_time: 518.16,
        chunk_index: 6
      }
    ]

    // Insert content chunks
    const { data: insertedChunks, error: chunksError } = await supabase
      .from('content_chunks')
      .insert(contentChunks)
      .select()

    if (chunksError) {
      console.error('❌ Error inserting content chunks:', chunksError)
      return
    }

    console.log('✅ Added content chunks:', insertedChunks.length)
    
    console.log('🎉 Real video data added successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Video: ${insertedVideo.title}`)
    console.log(`   - Content Chunks: ${insertedChunks.length}`)
    console.log(`   - Creator: ${creator.display_name} (${creator.username})`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the script
addRealVideoData()