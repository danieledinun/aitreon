const { createClient } = require('@supabase/supabase-js')
const { spawn } = require('child_process')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getAllCreatorsWithContent() {
  const { data: creators, error } = await supabase
    .from('creators')
    .select(`
      id,
      username,
      display_name
    `)

  if (error) {
    console.error('❌ Error fetching creators:', error)
    return []
  }

  const creatorsWithContent = []

  for (const creator of creators) {
    const { count } = await supabase
      .from('content_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creator.id)

    if (count && count > 50) {
      creatorsWithContent.push({
        ...creator,
        chunkCount: count
      })
    }
  }

  return creatorsWithContent
}

async function runAnalysisForCreator(creatorId, creatorName) {
  return new Promise((resolve, reject) => {
    console.log(`🎯 Starting FORCED speech analysis for ${creatorName} (${creatorId})`)

    const pythonPath = path.join(process.cwd(), 'services', 'speech_analysis', 'venv', 'bin', 'python')
    const scriptPath = path.join(process.cwd(), 'services', 'speech_analysis', 'run_analysis.py')

    const analysisProcess = spawn(pythonPath, [scriptPath, '--creator-id', creatorId], {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseKey
      },
      cwd: path.join(process.cwd(), 'services', 'speech_analysis')
    })

    let output = ''
    let errorOutput = ''

    analysisProcess.stdout.on('data', (data) => {
      const text = data.toString().trim()
      if (text) {
        console.log(`📊 ${text}`)
        output += text + '\n'
      }
    })

    analysisProcess.stderr.on('data', (data) => {
      const text = data.toString().trim()
      if (text) {
        console.error(`❌ ${text}`)
        errorOutput += text + '\n'
      }
    })

    analysisProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully completed FORCED analysis for ${creatorName}`)
        resolve({ success: true, output })
      } else {
        console.error(`❌ Analysis failed for ${creatorName} with code ${code}`)
        console.error(`Error output: ${errorOutput}`)
        reject(new Error(`Analysis failed with code ${code}: ${errorOutput}`))
      }
    })

    analysisProcess.on('error', (error) => {
      console.error(`❌ Failed to start analysis process for ${creatorName}:`, error)
      reject(error)
    })
  })
}

async function forceSpeechAnalysis() {
  console.log('🚀 Starting FORCED speech analysis (ignoring cooldowns)...')

  try {
    const creators = await getAllCreatorsWithContent()

    if (creators.length === 0) {
      console.log('📭 No creators with sufficient content found')
      return
    }

    console.log(`📊 Found ${creators.length} creators with content to analyze:`)
    creators.forEach(creator => {
      console.log(`  - ${creator.display_name || creator.username} (${creator.chunkCount} chunks)`)
    })

    let successful = 0
    let failed = 0

    for (const creator of creators) {
      try {
        await runAnalysisForCreator(creator.id, creator.display_name || creator.username)
        successful++
      } catch (error) {
        console.error(`❌ Failed to analyze ${creator.display_name || creator.username}:`, error.message)
        failed++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 FORCED ANALYSIS SUMMARY')
    console.log('='.repeat(50))
    console.log(`Total creators: ${creators.length}`)
    console.log(`Successful: ${successful}`)
    console.log(`Failed: ${failed}`)
    console.log('✅ FORCED speech analysis process complete!')

  } catch (error) {
    console.error('❌ Script error:', error)
    process.exit(1)
  }
}

// Run the forced analysis
forceSpeechAnalysis()