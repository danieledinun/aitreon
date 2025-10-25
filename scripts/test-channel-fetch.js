const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

async function testChannelFetch() {
  try {
    const scriptPath = path.join(__dirname, 'youtube_transcript_extractor.py');
    const pythonPath = path.join(__dirname, 'transcript_env', 'bin', 'python');
    const username = 'LanceHedrick';

    console.log('🔍 Testing channel fetch for @' + username);
    console.log('📝 Python path:', pythonPath);
    console.log('📝 Script path:', scriptPath);
    console.log('');

    const command = `${pythonPath} ${scriptPath} channel ${username}`;
    console.log('💻 Running command:', command);
    console.log('');

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.log('⚠️  STDERR:');
      console.log(stderr);
      console.log('');
    }

    console.log('✅ STDOUT:');
    console.log(stdout);

    // Try to parse the JSON output
    try {
      const result = JSON.parse(stdout);
      console.log('');
      console.log('📊 Parsed result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('');
      console.log('❌ Failed to parse JSON:', e.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) {
      console.log('');
      console.log('📤 stdout:', error.stdout);
    }
    if (error.stderr) {
      console.log('');
      console.log('📤 stderr:', error.stderr);
    }
  }
}

testChannelFetch();
