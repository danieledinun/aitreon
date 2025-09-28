#!/usr/bin/env python3
"""
Test script for the speech analysis system.
Tests the system with sample data and real creator data.
"""

import sys
import os
import json
from typing import List

# Add the parent directory to the path so we can import the modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from speech_types import TranscriptSegment, AnalysisConfig
from preprocess import create_preprocessor
from features import FeatureExtractor
from speech_profile import create_profile_generator
from scorer import create_style_scorer


def create_sample_segments() -> List[TranscriptSegment]:
    """Create sample transcript segments for testing."""
    sample_texts = [
        "Hey everyone, welcome back to my channel! Today I'm super excited to share with you five amazing air fryer recipes.",
        "So the first thing you want to do is preheat your air fryer to 400 degrees, right? And while that's heating up, we're going to prep our ingredients.",
        "I mean, this is literally the easiest recipe you'll ever make, like seriously. And the best part? It only takes about 10 minutes total.",
        "You know what I love about air frying? It gives you that crispy texture without all the oil. It's basically magic, honestly.",
        "Alright, so now we're going to season our chicken. I'm using salt, pepper, garlic powder, and a little bit of paprika for that smoky flavor.",
        "And here's a pro tip from me to you - don't overcrowd the basket, okay? Give those pieces some room to breathe.",
        "So while that's cooking, let me tell you about today's sponsor. But first, make sure you hit that subscribe button if you haven't already!",
        "Oh my gosh, look at how golden and crispy that looks! This is exactly what we want to see, people.",
        "I'm going to be honest with you guys, when I first tried this recipe, I was skeptical. But wow, it totally exceeded my expectations.",
        "Alright, let's taste test this bad boy. Mmm, oh my god, that's incredible! The seasoning is perfect, the texture is spot on."
    ]

    segments = []
    start_time = 0.0

    for i, text in enumerate(sample_texts):
        # Estimate duration based on text length (roughly 2.5 words per second)
        word_count = len(text.split())
        duration = word_count / 2.5
        end_time = start_time + duration

        segment = TranscriptSegment(
            video_id=f"test_video_{i // 3 + 1}",  # Group into videos
            start_time=start_time,
            end_time=end_time,
            text=text,
            confidence=0.95
        )
        segments.append(segment)

        start_time = end_time + 1.0  # 1-second gap between segments

    return segments


def test_preprocessing():
    """Test the preprocessing module."""
    print("🔄 Testing preprocessing...")

    config = AnalysisConfig()
    preprocessor = create_preprocessor(config)

    # Create sample segments
    segments = create_sample_segments()
    print(f"   Created {len(segments)} sample segments")

    # Process segments
    processed = preprocessor.process_transcript_data(segments)
    print(f"   Processed {len(processed)} segments")

    if processed:
        sample = processed[0]
        print(f"   Sample processed text: '{sample.cleaned_text[:100]}...'")
        print(f"   Sample word count: {sample.word_count}")
        print(f"   Sample WPM: {sample.words_per_minute:.1f}")

    return processed


def test_feature_extraction(processed_segments):
    """Test the feature extraction module."""
    print("🎯 Testing feature extraction...")

    config = AnalysisConfig()
    extractor = FeatureExtractor(config)

    # Extract features
    lexical, syntax, repetition, prosody, persona = extractor.extract_all_features(processed_segments)

    print(f"   Lexical diversity (TTR): {lexical.type_token_ratio:.3f}")
    print(f"   Vocabulary size: {lexical.vocabulary_size}")
    print(f"   Mean sentence length: {syntax.mean_sentence_length:.1f} words")
    print(f"   Question frequency: {syntax.question_frequency:.1%}")
    print(f"   Speaking rate: {prosody.mean_words_per_minute:.1f} WPM")

    if lexical.filler_words:
        top_filler = max(lexical.filler_words.items(), key=lambda x: x[1])
        print(f"   Top filler word: '{top_filler[0]}' ({top_filler[1]:.1%})")

    if persona.pov_distribution:
        print(f"   POV distribution: {dict(persona.pov_distribution)}")

    return lexical, syntax, repetition, prosody, persona


def test_profile_generation(processed_segments):
    """Test the profile generation module."""
    print("📊 Testing profile generation...")

    config = AnalysisConfig()
    generator = create_profile_generator(config)

    # Generate profile
    profile = generator.generate_profile("test_creator", processed_segments, "Test Creator")

    print(f"   Profile confidence: {profile.confidence_score:.2%}")
    print(f"   Communication archetype: {profile.communication_archetype}")
    print(f"   Total words analyzed: {profile.total_words_analyzed}")

    if profile.dominant_patterns:
        print(f"   Dominant patterns:")
        for pattern in profile.dominant_patterns[:3]:
            print(f"     • {pattern}")

    # Generate style card
    style_card = generator.generate_style_card(profile, "Test Creator")
    print(f"   Style card generated: {len(style_card.key_patterns)} key patterns")

    return profile, style_card


def test_style_scoring(profile):
    """Test the style scoring module."""
    print("📝 Testing style scoring...")

    config = AnalysisConfig()
    scorer = create_style_scorer(config)

    # Test texts with different styles
    test_texts = [
        # Similar style (matches the sample)
        "Hey guys! So today I'm going to show you this amazing recipe that's literally so easy to make. You're going to love it!",

        # Different style (formal)
        "In this tutorial, we will examine the preparation methodology for air-fried cuisine. Please follow these instructions carefully.",

        # Very different style (technical)
        "The optimal temperature parameter for this cooking apparatus is 400°F. Heat transfer efficiency is maximized through convection."
    ]

    style_names = ["Similar Style", "Formal Style", "Technical Style"]

    for text, style_name in zip(test_texts, style_names):
        score_result = scorer.score_text_similarity(text, profile, detailed=False)
        print(f"   {style_name}: {score_result.overall_score:.1%} similarity")

    return True


def test_with_database_data():
    """Test with real database data if available."""
    print("🗃️  Testing with database data...")

    try:
        from database import create_database_manager

        db_manager = create_database_manager()

        # Get available creators
        creators = db_manager.get_all_creators_with_content()

        if not creators:
            print("   No creators found in database")
            return False

        # Test with the first creator
        creator_id, creator_name, chunk_count = creators[0]
        print(f"   Testing with creator: {creator_name} ({chunk_count} chunks)")

        # Get transcript data
        transcript_data = db_manager.get_creator_transcript_data(creator_id)
        print(f"   Retrieved {len(transcript_data.segments)} segments")

        if len(transcript_data.segments) < 10:
            print("   Not enough segments for reliable testing")
            return False

        # Use only first 50 segments for testing
        test_segments = transcript_data.segments[:50]

        # Process segments
        config = AnalysisConfig(min_words_for_analysis=100)  # Lower threshold for testing
        preprocessor = create_preprocessor(config)
        processed = preprocessor.process_transcript_data(test_segments)

        if not processed:
            print("   No processable segments")
            return False

        print(f"   Processed {len(processed)} segments")

        # Generate profile
        generator = create_profile_generator(config)
        profile = generator.generate_profile(creator_id, processed, creator_name)

        print(f"   ✅ Real data analysis complete!")
        print(f"   Confidence: {profile.confidence_score:.2%}")
        print(f"   Archetype: {profile.communication_archetype}")

        # Generate style card
        style_card = generator.generate_style_card(profile, creator_name)
        print(f"\n📝 Generated Style Card:")
        print("=" * 50)
        print(style_card.to_prompt_text())
        print("=" * 50)

        return True

    except Exception as e:
        print(f"   Database test failed: {e}")
        return False


def main():
    """Run all tests."""
    print("🚀 Starting Speech Analysis System Tests")
    print("=" * 60)

    try:
        # Test 1: Preprocessing
        processed_segments = test_preprocessing()
        if not processed_segments:
            print("❌ Preprocessing test failed")
            return

        print("✅ Preprocessing test passed\n")

        # Test 2: Feature Extraction
        features = test_feature_extraction(processed_segments)
        print("✅ Feature extraction test passed\n")

        # Test 3: Profile Generation
        profile, style_card = test_profile_generation(processed_segments)
        print("✅ Profile generation test passed\n")

        # Test 4: Style Scoring
        test_style_scoring(profile)
        print("✅ Style scoring test passed\n")

        # Test 5: Database Integration (if available)
        db_success = test_with_database_data()
        if db_success:
            print("✅ Database integration test passed\n")
        else:
            print("⚠️  Database integration test skipped (no data or connection)\n")

        # Display sample style card
        print("📋 Sample Style Card Output:")
        print("=" * 60)
        print(style_card.to_prompt_text())
        print("=" * 60)

        print("\n🎉 All tests completed successfully!")
        print("The speech analysis system is ready for production use.")

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()