"""
Speech Pattern Analysis System

A comprehensive system for analyzing creator speech patterns and generating
style profiles for AI replica training.

Key Components:
- Preprocessing: Text cleaning and timing alignment
- Features: Lexical, syntactic, prosodic, and persona analysis
- Profiles: Style profile generation and style cards
- Scoring: Text similarity scoring against creator profiles
- Database: Integration with Supabase for data management

Usage:
    from speech_analysis import analyze_creator_style, score_text_similarity

    # Analyze a creator
    profile = analyze_creator_style("creator_id")

    # Score text against creator style
    score = score_text_similarity("sample text", profile)
"""

from .types import (
    AnalysisConfig,
    StyleProfile,
    StyleCard,
    StyleScore,
    TranscriptSegment,
    ProcessedSegment
)

from .preprocess import create_preprocessor, TranscriptPreprocessor
from .features import FeatureExtractor
from .speech_profile import create_profile_generator, StyleProfileGenerator
from .scorer import create_style_scorer, StyleScorer
from .database import create_database_manager, DatabaseManager

__version__ = "1.0.0"
__author__ = "Aitrion Team"

# Main convenience functions
def analyze_creator_style(creator_id: str, config: AnalysisConfig = None) -> StyleProfile:
    """
    Analyze a creator's speech patterns and return a style profile.

    Args:
        creator_id: The creator's database ID
        config: Optional analysis configuration

    Returns:
        StyleProfile object containing all extracted features
    """
    if config is None:
        config = AnalysisConfig()

    # Initialize components
    db_manager = create_database_manager()
    preprocessor = create_preprocessor(config)
    profile_generator = create_profile_generator(config)

    # Get and process data
    transcript_data = db_manager.get_creator_transcript_data(creator_id)
    processed_segments = preprocessor.process_transcript_data(transcript_data.segments)

    # Generate profile
    creator_info = db_manager.get_creator_info(creator_id)
    creator_name = creator_info.get('display_name', creator_info.get('username', ''))

    return profile_generator.generate_profile(creator_id, processed_segments, creator_name)


def score_text_similarity(text: str, profile: StyleProfile, config: AnalysisConfig = None) -> StyleScore:
    """
    Score how well text matches a creator's style profile.

    Args:
        text: Text to analyze
        profile: Creator's style profile
        config: Optional analysis configuration

    Returns:
        StyleScore with similarity metrics and recommendations
    """
    if config is None:
        config = AnalysisConfig()

    scorer = create_style_scorer(config)
    return scorer.score_text_similarity(text, profile, detailed=True)


def generate_style_card(profile: StyleProfile, creator_name: str = None) -> StyleCard:
    """
    Generate a human-readable style card from a profile.

    Args:
        profile: Creator's style profile
        creator_name: Optional creator name for the card

    Returns:
        StyleCard with human-readable style description
    """
    config = AnalysisConfig()
    profile_generator = create_profile_generator(config)
    return profile_generator.generate_style_card(profile, creator_name)


# Export main classes and functions
__all__ = [
    # Types
    'AnalysisConfig',
    'StyleProfile',
    'StyleCard',
    'StyleScore',
    'TranscriptSegment',
    'ProcessedSegment',

    # Core classes
    'TranscriptPreprocessor',
    'FeatureExtractor',
    'StyleProfileGenerator',
    'StyleScorer',
    'DatabaseManager',

    # Factory functions
    'create_preprocessor',
    'create_profile_generator',
    'create_style_scorer',
    'create_database_manager',

    # Convenience functions
    'analyze_creator_style',
    'score_text_similarity',
    'generate_style_card'
]