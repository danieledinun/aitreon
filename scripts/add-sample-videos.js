const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addSampleVideos() {
  console.log('🚀 Adding sample videos to the knowledge base...')
  
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

    // Sample video data
    const sampleVideos = [
      {
        creator_id: creator.id,
        video_id: 'air-fryer-chicken-wings',
        title: 'Perfect Air Fryer Chicken Wings - Crispy Every Time!',
        description: 'Learn how to make the crispiest chicken wings in your air fryer with this foolproof recipe. These wings come out perfectly crispy on the outside and juicy on the inside!',
        thumbnail_url: 'https://img.youtube.com/vi/sample1/maxresdefault.jpg',
        duration: 480,
        view_count: 125000,
        published_at: new Date('2024-01-15'),
        processed: true,
        created_at: new Date()
      },
      {
        creator_id: creator.id,
        video_id: 'air-fryer-vegetables',
        title: 'Ultimate Air Fryer Vegetable Guide',
        description: 'Everything you need to know about cooking vegetables in the air fryer! From broccoli to brussels sprouts, get perfect results every time.',
        thumbnail_url: 'https://img.youtube.com/vi/sample2/maxresdefault.jpg',
        duration: 360,
        view_count: 89000,
        published_at: new Date('2024-01-20'),
        processed: true,
        created_at: new Date()
      },
      {
        creator_id: creator.id,
        video_id: 'air-fryer-desserts',
        title: 'Amazing Air Fryer Desserts You Must Try',
        description: 'Yes, you can make desserts in your air fryer! From donuts to cookies, these sweet treats will blow your mind.',
        thumbnail_url: 'https://img.youtube.com/vi/sample3/maxresdefault.jpg',
        duration: 540,
        view_count: 67000,
        published_at: new Date('2024-01-25'),
        processed: true,
        created_at: new Date()
      }
    ]

    // Insert videos
    const { data: insertedVideos, error: videosError } = await supabase
      .from('videos')
      .insert(sampleVideos)
      .select()

    if (videosError) {
      console.error('❌ Error inserting videos:', videosError)
      return
    }

    console.log('✅ Added videos:', insertedVideos.length)

    // Sample content chunks for each video
    const contentChunks = [
      // Chicken Wings video chunks
      {
        video_id: insertedVideos[0].id,
        chunk_text: "Hey everyone! Today I'm gonna show you how to make the most incredible crispy chicken wings in your air fryer. These are gonna be absolutely perfect - crispy on the outside, juicy on the inside.",
        start_time: 5,
        end_time: 15,
        chunk_index: 0
      },
      {
        video_id: insertedVideos[0].id,
        chunk_text: "First thing you wanna do is pat your wings completely dry. This is super important for getting that crispy skin. Then we're gonna season them with salt, pepper, garlic powder, and paprika.",
        start_time: 30,
        end_time: 45,
        chunk_index: 1
      },
      {
        video_id: insertedVideos[0].id,
        chunk_text: "Set your air fryer to 380 degrees Fahrenheit. Cook for 12 minutes, flip them over, then another 12 minutes. The key is not to overcrowd the basket - give those wings some space to get crispy!",
        start_time: 60,
        end_time: 75,
        chunk_index: 2
      },
      
      // Vegetables video chunks
      {
        video_id: insertedVideos[1].id,
        chunk_text: "Air frying vegetables is a game changer! You get all that crispy goodness without tons of oil. Today we're covering everything from broccoli to brussels sprouts.",
        start_time: 0,
        end_time: 12,
        chunk_index: 0
      },
      {
        video_id: insertedVideos[1].id,
        chunk_text: "For broccoli, cut into even pieces, toss with a little olive oil and seasoning. Air fry at 375 for about 8-10 minutes until the edges are crispy and golden brown.",
        start_time: 25,
        end_time: 38,
        chunk_index: 1
      },
      {
        video_id: insertedVideos[1].id,
        chunk_text: "Brussels sprouts are amazing in the air fryer! Cut them in half, season well, and cook at 375 for about 12 minutes. They come out perfectly caramelized with crispy edges.",
        start_time: 55,
        end_time: 68,
        chunk_index: 2
      },

      // Desserts video chunks
      {
        video_id: insertedVideos[2].id,
        chunk_text: "Who says air fryers are just for savory foods? Today I'm sharing my favorite air fryer dessert recipes that will absolutely blow your mind! We're making donuts, cookies, and more.",
        start_time: 3,
        end_time: 18,
        chunk_index: 0
      },
      {
        video_id: insertedVideos[2].id,
        chunk_text: "These air fryer donuts are incredible! Mix your batter, pipe into donut shapes, and air fry at 350 for just 5-6 minutes. Top with glaze or cinnamon sugar while they're still warm.",
        start_time: 45,
        end_time: 60,
        chunk_index: 1
      },
      {
        video_id: insertedVideos[2].id,
        chunk_text: "The chocolate chip cookies come out perfectly chewy in the center with crispy edges. Just scoop your dough onto parchment, air fry at 320 for 8-10 minutes depending on size.",
        start_time: 85,
        end_time: 98,
        chunk_index: 2
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
    
    console.log('🎉 Sample data added successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Videos: ${insertedVideos.length}`)
    console.log(`   - Content Chunks: ${insertedChunks.length}`)
    console.log(`   - Creator: ${creator.display_name} (${creator.username})`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the script
addSampleVideos()