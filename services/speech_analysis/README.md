# Speech Pattern Analysis System

A modular system for analyzing creator speech patterns to generate realistic AI replica style profiles.

## Overview

This system analyzes YouTube transcript data to extract linguistic patterns, speech habits, and persona characteristics unique to each creator. The output is a style profile JSON that can be used to prompt AI models to mimic the creator's speaking style.

## Architecture

```
Transcript Data → Preprocessing → Feature Extraction → Style Profile → Style Scorer
     ↓              ↓                    ↓               ↓            ↓
Raw content    Clean text       Linguistic features   JSON card    Similarity
segments       + timing         + patterns            output       scoring
```

## Modules

- `preprocess.py` - Text cleaning, punctuation restoration, timing alignment
- `features.py` - Lexical, syntactic, prosodic feature extraction
- `profile.py` - Style profile aggregation and JSON generation
- `scorer.py` - Style similarity scoring for new text
- `main.py` - CLI interface and orchestration
- `types.py` - Type definitions and data structures

## Usage

```bash
# Analyze creator's transcripts and generate style profile
python main.py analyze --creator-id "creator123" --output style_profile.json

# Score text similarity to creator's style
python main.py score --style-profile style_profile.json --text "sample text"

# Generate style card for AI prompting
python main.py card --style-profile style_profile.json
```

## Output Style Card

The system generates a concise style card suitable for AI prompts:

```
"**Sarah's Communication Style:**
- Uses frequent discourse markers ('so', 'like', 'you know') - 15% of speech
- Conversational tone with short sentences (avg 12 words)
- High engagement through direct address ('you', 'we') - 40% of statements
- Signature catchphrases: 'That's exactly what we want', 'Here's the thing'
- Moderate enthusiasm with occasional repetition for emphasis
- Prefers bullet-style explanations over lengthy paragraphs"
```

## Installation

```bash
cd services/speech_analysis
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Integration

The system integrates with the existing Aitrion platform through:
- Database queries to `content_chunks` table
- API endpoints at `/api/creator/speech-analysis`
- Style profiles stored in `ai_config` table extensions
- Real-time style scoring for chat responses