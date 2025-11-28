-- Add updated_at column to video_processing_jobs table
ALTER TABLE video_processing_jobs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a trigger to automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_processing_jobs_updated_at
    BEFORE UPDATE ON video_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
