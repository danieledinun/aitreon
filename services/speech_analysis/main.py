"""
Main CLI interface for the speech pattern analysis system.
Provides commands for analyzing creators, generating style profiles, and scoring text.
"""

import argparse
import json
import sys
import os
from typing import List, Optional
from pathlib import Path

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from speech_types import AnalysisConfig, TranscriptSegment
from database import create_database_manager, create_transcript_loader
from preprocess import create_preprocessor
from speech_profile import create_profile_generator
from scorer import create_style_scorer


def setup_analysis_environment():
    """Set up the analysis environment with necessary downloads."""
    try:
        import spacy
        import nltk

        # Check if spaCy model is available
        try:
            spacy.load("en_core_web_sm")
        except OSError:
            print("Downloading spaCy English model...")
            os.system("python -m spacy download en_core_web_sm")

        # Download NLTK data if needed
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            print("Downloading NLTK data...")
            nltk.download('punkt')
            nltk.download('stopwords')

    except ImportError as e:
        print(f"Missing required packages: {e}")
        print("Please install requirements: pip install -r requirements.txt")
        sys.exit(1)


def analyze_creator(creator_id: str, output_file: Optional[str] = None,
                   config: Optional[AnalysisConfig] = None) -> None:
    """Analyze a creator's speech patterns and generate style profile."""
    print(f"🔍 Analyzing creator: {creator_id}")

    if config is None:
        config = AnalysisConfig()

    # Initialize components
    db_manager = create_database_manager()
    preprocessor = create_preprocessor(config)
    profile_generator = create_profile_generator(config)

    try:
        # Ensure database schema is ready
        db_manager.ensure_ai_config_columns()

        # Get creator data
        transcript_data = db_manager.get_creator_transcript_data(creator_id)
        creator_info = db_manager.get_creator_info(creator_id)

        print(f"📊 Found {len(transcript_data.segments)} segments from {transcript_data.total_videos} videos")
        print(f"⏱️  Total duration: {transcript_data.total_duration/60:.1f} minutes")

        # Check if we have enough data
        total_words = sum(len(seg.text.split()) for seg in transcript_data.segments)
        if total_words < config.min_words_for_analysis:
            print(f"⚠️  Warning: Only {total_words} words found, need at least {config.min_words_for_analysis}")
            print("Analysis may be less reliable.")

        # Preprocess segments
        print("🔄 Preprocessing transcript segments...")
        processed_segments = preprocessor.process_transcript_data(transcript_data.segments)

        if not processed_segments:
            print("❌ No processable segments found after filtering")
            return

        print(f"✅ Processed {len(processed_segments)} segments")

        # Generate style profile
        print("🎯 Generating style profile...")
        creator_name = creator_info.get('display_name', creator_info.get('username', ''))
        profile = profile_generator.generate_profile(
            creator_id, processed_segments, creator_name
        )

        print(f"✅ Generated profile with {profile.confidence_score:.2f} confidence")
        print(f"📈 Communication archetype: {profile.communication_archetype}")

        # Generate style card
        print("📝 Creating style card...")
        style_card = profile_generator.generate_style_card(profile, creator_name)
        style_card_text = style_card.to_prompt_text()

        # Save to database
        print("💾 Saving to database...")
        db_manager.save_style_profile(profile)
        db_manager.save_style_card_to_ai_config(creator_id, style_card_text)

        # Save to file if specified
        if output_file:
            profile_generator.save_profile(profile, output_file)
            print(f"📁 Saved profile to: {output_file}")

        # Display style card
        print("\n" + "="*60)
        print("STYLE CARD")
        print("="*60)
        print(style_card_text)
        print("="*60)

        # Show key statistics
        print(f"\n📊 Analysis Statistics:")
        print(f"   • Total words analyzed: {profile.total_words_analyzed:,}")
        print(f"   • Segments processed: {profile.total_segments_analyzed}")
        print(f"   • Duration: {profile.total_duration_minutes:.1f} minutes")
        print(f"   • Confidence score: {profile.confidence_score:.2%}")
        print(f"   • Lexical diversity: {profile.lexical.type_token_ratio:.2f}")
        print(f"   • Avg sentence length: {profile.syntax.mean_sentence_length:.1f} words")
        print(f"   • Speaking rate: {profile.prosody.mean_words_per_minute:.0f} WPM")

        if profile.dominant_patterns:
            print(f"\n🎨 Dominant Patterns:")
            for pattern in profile.dominant_patterns[:5]:
                print(f"   • {pattern}")

        print(f"\n✅ Analysis complete for {creator_name}")

    except Exception as e:
        print(f"❌ Error analyzing creator: {e}")
        import traceback
        traceback.print_exc()


def score_text(text: str, creator_id: str, style_profile_file: Optional[str] = None) -> None:
    """Score how well text matches a creator's style."""
    print(f"📝 Scoring text similarity to creator: {creator_id}")

    config = AnalysisConfig()
    scorer = create_style_scorer(config)

    try:
        # Load style profile
        if style_profile_file:
            profile_generator = create_profile_generator(config)
            profile = profile_generator.load_profile(style_profile_file)
        else:
            db_manager = create_database_manager()
            profile = db_manager.load_style_profile(creator_id)

        if not profile:
            print("❌ No style profile found. Run analysis first.")
            return

        # Score the text
        score_result = scorer.score_text_similarity(text, profile, detailed=True)

        # Display results
        print(f"\n🎯 Style Similarity Score: {score_result.overall_score:.2%}")
        print(f"📊 Breakdown:")

        for metric, score in score_result.metric_scores.items():
            metric_name = metric.value.replace('_', ' ').title()
            print(f"   • {metric_name}: {score:.2%}")

        if score_result.detailed_breakdown:
            print(f"\n📋 Detailed Analysis:")
            for key, value in score_result.detailed_breakdown.items():
                print(f"   • {key.replace('_', ' ').title()}: {value}")

        if score_result.recommendations:
            print(f"\n💡 Recommendations:")
            for rec in score_result.recommendations:
                print(f"   • {rec}")

        # Overall assessment
        if score_result.overall_score >= 0.8:
            print("✅ Excellent style match!")
        elif score_result.overall_score >= 0.6:
            print("✅ Good style match")
        elif score_result.overall_score >= 0.4:
            print("⚠️  Moderate style match - consider improvements")
        else:
            print("❌ Poor style match - significant improvements needed")

    except Exception as e:
        print(f"❌ Error scoring text: {e}")


def generate_style_card(creator_id: str, output_file: Optional[str] = None) -> None:
    """Generate a style card from existing profile."""
    print(f"📝 Generating style card for creator: {creator_id}")

    try:
        db_manager = create_database_manager()
        profile = db_manager.load_style_profile(creator_id)

        if not profile:
            print("❌ No style profile found. Run analysis first.")
            return

        creator_info = db_manager.get_creator_info(creator_id)
        creator_name = creator_info.get('display_name', creator_info.get('username', ''))

        config = AnalysisConfig()
        profile_generator = create_profile_generator(config)
        style_card = profile_generator.generate_style_card(profile, creator_name)

        style_card_text = style_card.to_prompt_text()

        # Save to database
        db_manager.save_style_card_to_ai_config(creator_id, style_card_text)

        # Save to file if specified
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(style_card_text)
            print(f"📁 Saved style card to: {output_file}")

        # Display style card
        print("\n" + "="*60)
        print("STYLE CARD")
        print("="*60)
        print(style_card_text)
        print("="*60)

    except Exception as e:
        print(f"❌ Error generating style card: {e}")


def list_creators() -> None:
    """List all creators with available content."""
    print("📋 Creators with available content:")

    try:
        db_manager = create_database_manager()
        creators = db_manager.get_all_creators_with_content()

        if not creators:
            print("No creators found with sufficient content.")
            return

        for creator_id, name, chunk_count in creators:
            # Check if they have a style profile
            profile = db_manager.load_style_profile(creator_id)
            status = "✅ Profile exists" if profile else "⏳ No profile"

            print(f"   • {name} ({creator_id[:8]}...): {chunk_count} chunks - {status}")

        print(f"\nTotal: {len(creators)} creators")

    except Exception as e:
        print(f"❌ Error listing creators: {e}")


def analyze_from_file(input_file: str, output_file: Optional[str] = None) -> None:
    """Analyze speech patterns from a transcript file."""
    print(f"📁 Analyzing transcript file: {input_file}")

    config = AnalysisConfig()

    try:
        # Load data from file
        db_manager = create_database_manager()
        loader = create_transcript_loader(db_manager)

        if input_file.endswith('.json'):
            segments = loader.load_from_json_file(input_file)
        elif input_file.endswith('.csv'):
            segments = loader.load_from_csv_file(input_file)
        else:
            print("❌ Unsupported file format. Use JSON or CSV.")
            return

        if not segments:
            print("❌ No valid segments found in file.")
            return

        print(f"📊 Loaded {len(segments)} segments")

        # Process segments
        preprocessor = create_preprocessor(config)
        processed_segments = preprocessor.process_transcript_data(segments)

        if not processed_segments:
            print("❌ No processable segments after filtering.")
            return

        # Generate profile
        profile_generator = create_profile_generator(config)
        profile = profile_generator.generate_profile("file_analysis", processed_segments)

        # Generate style card
        style_card = profile_generator.generate_style_card(profile, "File Analysis")

        # Save results
        if output_file:
            profile_generator.save_profile(profile, output_file)
            print(f"📁 Saved profile to: {output_file}")

        # Display results
        print("\n" + "="*60)
        print("STYLE ANALYSIS RESULTS")
        print("="*60)
        print(style_card.to_prompt_text())
        print("="*60)

    except Exception as e:
        print(f"❌ Error analyzing file: {e}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Speech Pattern Analysis System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py analyze --creator-id creator123 --output profile.json
  python main.py score --creator-id creator123 --text "Hello everyone, welcome back!"
  python main.py card --creator-id creator123 --output style_card.txt
  python main.py list
  python main.py analyze-file --input transcript.json --output profile.json
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Analyze creator command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze creator speech patterns')
    analyze_parser.add_argument('--creator-id', required=True, help='Creator ID to analyze')
    analyze_parser.add_argument('--output', help='Output file for style profile (JSON)')
    analyze_parser.add_argument('--min-words', type=int, default=500,
                               help='Minimum words needed for analysis')

    # Score text command
    score_parser = subparsers.add_parser('score', help='Score text similarity to creator style')
    score_parser.add_argument('--creator-id', required=True, help='Creator ID for comparison')
    score_parser.add_argument('--text', required=True, help='Text to score')
    score_parser.add_argument('--profile', help='Style profile file (instead of database)')

    # Generate style card command
    card_parser = subparsers.add_parser('card', help='Generate style card from existing profile')
    card_parser.add_argument('--creator-id', required=True, help='Creator ID')
    card_parser.add_argument('--output', help='Output file for style card')

    # List creators command
    subparsers.add_parser('list', help='List creators with available content')

    # Analyze from file command
    file_parser = subparsers.add_parser('analyze-file', help='Analyze transcript from file')
    file_parser.add_argument('--input', required=True, help='Input transcript file (JSON/CSV)')
    file_parser.add_argument('--output', help='Output file for style profile')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Setup environment
    setup_analysis_environment()

    # Execute command
    try:
        if args.command == 'analyze':
            config = AnalysisConfig(min_words_for_analysis=args.min_words)
            analyze_creator(args.creator_id, args.output, config)

        elif args.command == 'score':
            score_text(args.text, args.creator_id, args.profile)

        elif args.command == 'card':
            generate_style_card(args.creator_id, args.output)

        elif args.command == 'list':
            list_creators()

        elif args.command == 'analyze-file':
            analyze_from_file(args.input, args.output)

    except KeyboardInterrupt:
        print("\n🛑 Analysis interrupted by user")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()