-- Add speech analysis and style card tables

-- Add speech_analysis table to store analysis results
CREATE TABLE IF NOT EXISTS speech_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    total_words INTEGER,
    total_segments INTEGER,
    speaking_rate_wpm DECIMAL(5,2),
    avg_sentence_length DECIMAL(5,2),
    analysis_version VARCHAR(10) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add style_cards table to store AI prompting style cards
CREATE TABLE IF NOT EXISTS style_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    style_card_text TEXT NOT NULL,
    signature_phrases JSONB,
    communication_metrics JSONB,
    ai_prompting_guidelines TEXT,
    version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_speech_analysis_creator_id ON speech_analysis(creator_id);
CREATE INDEX IF NOT EXISTS idx_style_cards_creator_id ON style_cards(creator_id);
CREATE INDEX IF NOT EXISTS idx_style_cards_active ON style_cards(creator_id, is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE speech_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_cards ENABLE ROW LEVEL SECURITY;

-- Creators can only access their own speech analysis
CREATE POLICY "Creators can view own speech analysis" ON speech_analysis
    FOR SELECT USING (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Creators can insert own speech analysis" ON speech_analysis
    FOR INSERT WITH CHECK (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Creators can update own speech analysis" ON speech_analysis
    FOR UPDATE USING (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );

-- Creators can only access their own style cards
CREATE POLICY "Creators can view own style cards" ON style_cards
    FOR SELECT USING (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Creators can insert own style cards" ON style_cards
    FOR INSERT WITH CHECK (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Creators can update own style cards" ON style_cards
    FOR UPDATE USING (
        creator_id IN (
            SELECT id FROM creators WHERE user_id = auth.uid()
        )
    );