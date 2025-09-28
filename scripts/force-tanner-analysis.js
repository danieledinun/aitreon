const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function forceTannerAnalysis() {
  const tannerId = '5864ded5-edfa-4e63-b131-582fe844fa43'

  console.log('🔧 Forcing fresh speech analysis for Tanner...')

  try {
    // Delete existing analysis to force regeneration
    const { error: deleteError } = await supabase
      .from('speech_analysis')
      .delete()
      .eq('creator_id', tannerId)

    if (deleteError) {
      console.error('❌ Error deleting old analysis:', deleteError)
    } else {
      console.log('🗑️ Deleted existing speech analysis for Tanner')
    }

    // Delete existing style cards to force regeneration
    const { error: deleteStyleError } = await supabase
      .from('style_cards')
      .delete()
      .eq('creator_id', tannerId)

    if (deleteStyleError) {
      console.error('❌ Error deleting old style cards:', deleteStyleError)
    } else {
      console.log('🗑️ Deleted existing style cards for Tanner')
    }

    console.log('✅ Cleared existing analysis - now running fresh analysis...')

    // Now trigger fresh analysis using the Python service
    const spawn = require('child_process').spawn
    const path = require('path')

    const pythonPath = path.join(process.cwd(), 'services', 'speech_analysis', 'venv', 'bin', 'python')
    const scriptPath = path.join(process.cwd(), 'services', 'speech_analysis', 'main.py')

    const analysisProcess = spawn(pythonPath, ['-m', 'speech_analysis.main', 'analyze', '--creator-id', tannerId], {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
        PYTHONPATH: path.join(process.cwd(), 'services')
      },
      cwd: path.join(process.cwd(), 'services')
    })

    analysisProcess.stdout.on('data', (data) => {
      console.log(`📊 ${data.toString().trim()}`)
    })

    analysisProcess.stderr.on('data', (data) => {
      console.error(`❌ ${data.toString().trim()}`)
    })

    analysisProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Fresh speech analysis completed for Tanner!')
      } else {
        console.error(`❌ Analysis failed with code ${code}`)
      }
    })

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

forceTannerAnalysis()