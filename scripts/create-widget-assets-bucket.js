const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createBucket() {
  console.log('Creating widget-assets bucket...')

  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === 'widget-assets')

  if (bucketExists) {
    console.log('✓ Bucket already exists')
    return
  }

  // Create bucket
  const { data, error } = await supabase.storage.createBucket('widget-assets', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
  })

  if (error) {
    console.error('✗ Failed to create bucket:', error)
    process.exit(1)
  }

  console.log('✓ Bucket created successfully')
}

createBucket()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
