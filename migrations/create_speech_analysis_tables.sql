-- Speech Analysis Tables Migration
-- Run this in the Supabase Dashboard SQL Editor
-- Navigate to: https://supabase.com/dashboard/project/gyuhljkilispdhetwalj/sql

-- Create speech_analysis table
CREATE TABLE speech_analysis (
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
CREATE TABLE style_cards (
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

-- Add columns to ai_config
ALTER TABLE ai_config ADD COLUMN style_card_id TEXT;
ALTER TABLE ai_config ADD COLUMN style_enabled BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_speech_analysis_creator_id ON speech_analysis(creator_id);
CREATE INDEX idx_style_cards_creator_id ON style_cards(creator_id);
CREATE INDEX idx_style_cards_active ON style_cards(creator_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE speech_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for speech_analysis
CREATE POLICY "speech_analysis_select_policy" ON speech_analysis
    FOR SELECT USING (true);

CREATE POLICY "speech_analysis_insert_policy" ON speech_analysis
    FOR INSERT WITH CHECK (true);

CREATE POLICY "speech_analysis_update_policy" ON speech_analysis
    FOR UPDATE USING (true);

-- Create RLS policies for style_cards
CREATE POLICY "style_cards_select_policy" ON style_cards
    FOR SELECT USING (true);

CREATE POLICY "style_cards_insert_policy" ON style_cards
    FOR INSERT WITH CHECK (true);

CREATE POLICY "style_cards_update_policy" ON style_cards
    FOR UPDATE USING (true);