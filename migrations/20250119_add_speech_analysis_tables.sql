-- Migration: Add speech analysis tables
-- Created: 2025-01-19
-- Description: Creates tables for speech pattern analysis and AI style cards

-- Create speech_analysis table
CREATE TABLE IF NOT EXISTS speech_analysis (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    signature_phrases JSONB,
    communication_metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

-- Create style_cards table
CREATE TABLE IF NOT EXISTS style_cards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL,
    style_card_text TEXT NOT NULL,
    signature_phrases JSONB,
    communication_metrics JSONB,
    ai_prompting_guidelines TEXT,
    is_active BOOLEAN DEFAULT true,
    version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

-- Add style_card_id to ai_config table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_config' AND column_name = 'style_card_id'
    ) THEN
        ALTER TABLE ai_config ADD COLUMN style_card_id TEXT;
        ALTER TABLE ai_config ADD COLUMN style_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add foreign key constraint for style_card_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ai_config_style_card_id_fkey'
    ) THEN
        ALTER TABLE ai_config ADD CONSTRAINT ai_config_style_card_id_fkey
        FOREIGN KEY (style_card_id) REFERENCES style_cards(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_speech_analysis_creator_id ON speech_analysis(creator_id);
CREATE INDEX IF NOT EXISTS idx_style_cards_creator_id ON style_cards(creator_id);
CREATE INDEX IF NOT EXISTS idx_style_cards_active ON style_cards(creator_id, is_active) WHERE is_active = true;

-- Add RLS policies for security
ALTER TABLE speech_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for speech_analysis
CREATE POLICY IF NOT EXISTS "speech_analysis_select_policy" ON speech_analysis
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "speech_analysis_insert_policy" ON speech_analysis
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "speech_analysis_update_policy" ON speech_analysis
    FOR UPDATE USING (true);

-- RLS policies for style_cards
CREATE POLICY IF NOT EXISTS "style_cards_select_policy" ON style_cards
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "style_cards_insert_policy" ON style_cards
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "style_cards_update_policy" ON style_cards
    FOR UPDATE USING (true);