"""
Type definitions for speech pattern analysis system.
"""

from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
from enum import Enum


class StyleMetric(Enum):
    """Enumeration of style metrics."""
    LEXICAL_DIVERSITY = "lexical_diversity"
    SENTENCE_LENGTH = "sentence_length"
    FILLER_FREQUENCY = "filler_frequency"
    REPETITION_RATE = "repetition_rate"
    CATCHPHRASE_USAGE = "catchphrase_usage"
    POV_DISTRIBUTION = "pov_distribution"
    SENTIMENT_PROFILE = "sentiment_profile"
    PROSODY_PATTERNS = "prosody_patterns"


@dataclass
class TranscriptSegment:
    """Individual transcript segment with timing and content."""
    video_id: str
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None
    chunk_index: Optional[int] = None

    @property
    def duration(self) -> float:
        """Duration of the segment in seconds."""
        return self.end_time - self.start_time


@dataclass
class ProcessedSegment:
    """Processed transcript segment with cleaned text and features."""
    original: TranscriptSegment
    cleaned_text: str
    sentences: List[str]
    word_count: int
    words_per_minute: float
    pause_before: float = 0.0
    pause_after: float = 0.0


@dataclass
class LexicalFeatures:
    """Lexical analysis features."""
    # N-gram patterns
    top_bigrams: List[Tuple[str, float]]  # (bigram, pmi_score)
    top_trigrams: List[Tuple[str, float]]
    top_4grams: List[Tuple[str, float]]
    top_5grams: List[Tuple[str, float]]
    top_6grams: List[Tuple[str, float]]

    # Function words and fillers
    filler_words: Dict[str, float]  # word -> frequency
    function_word_dist: Dict[str, float]
    discourse_markers: Dict[str, float]

    # Diversity metrics
    type_token_ratio: float
    mtld_score: float  # Measure of Textual Lexical Diversity
    vocabulary_size: int
    rare_word_frequency: float


@dataclass
class SyntaxFeatures:
    """Syntactic and discourse pattern features."""
    # Sentence structure
    mean_sentence_length: float
    sentence_length_variance: float
    sentence_length_distribution: Dict[str, float]  # "short", "medium", "long"

    # POS tag distributions
    pos_distribution: Dict[str, float]
    pronoun_frequency: float
    imperative_frequency: float
    question_frequency: float

    # Rhetorical patterns
    repetition_patterns: List[str]
    parallel_structures: List[str]
    list_usage_frequency: float


@dataclass
class RepetitionFeatures:
    """Repetition and emphasis patterns."""
    # Intra-sentence repetition
    word_repetition_rate: float
    phrase_repetition_rate: float

    # Inter-sentence repetition
    cross_sentence_repetition: float
    emphasis_patterns: List[str]

    # Segment-level patterns
    recurring_phrases: Dict[str, int]
    signature_expressions: List[str]


@dataclass
class ProsodyFeatures:
    """Prosodic patterns derived from timing data."""
    # Speaking rate
    mean_words_per_minute: float
    wpm_variance: float
    speaking_rate_distribution: Dict[str, float]  # "fast", "normal", "slow"

    # Pause patterns
    pause_frequency: float
    mean_pause_duration: float
    pause_distribution: Dict[str, float]  # by duration categories

    # Rhythm and flow
    speech_continuity_score: float
    rhythm_regularity: float


@dataclass
class PersonaFeatures:
    """Persona and communication style features."""
    # Point of view usage
    pov_distribution: Dict[str, float]  # "I", "you", "we", "they"
    direct_address_frequency: float
    inclusive_language_rate: float

    # Sentiment and emotion
    sentiment_distribution: Dict[str, float]  # "positive", "negative", "neutral"
    emotional_intensity: float
    enthusiasm_markers: List[str]

    # Engagement patterns
    question_to_audience: float
    call_to_action_frequency: float
    personal_anecdote_rate: float


@dataclass
class StyleProfile:
    """Complete style profile for a creator."""
    creator_id: str
    profile_version: str
    generation_timestamp: str

    # Core feature sets
    lexical: LexicalFeatures
    syntax: SyntaxFeatures
    repetition: RepetitionFeatures
    prosody: ProsodyFeatures
    persona: PersonaFeatures

    # Summary metrics
    dominant_patterns: List[str]
    signature_style_elements: List[str]
    communication_archetype: str  # "educator", "entertainer", "motivator", etc.

    # Metadata
    total_segments_analyzed: int
    total_words_analyzed: int
    total_duration_minutes: float
    confidence_score: float  # Overall confidence in the analysis


@dataclass
class StyleScore:
    """Style similarity scoring result."""
    overall_score: float  # 0-1 similarity score
    metric_scores: Dict[StyleMetric, float]
    detailed_breakdown: Dict[str, Union[float, str]]
    recommendations: List[str]  # Suggestions to improve style match


@dataclass
class StyleCard:
    """Human-readable style summary for AI prompts."""
    creator_name: str
    style_summary: str  # Brief 2-3 sentence overview
    key_patterns: List[str]  # Bullet points of main patterns
    catchphrases: List[str]  # Top signature phrases
    tone_description: str  # Conversational style description
    formatting_preferences: List[str]  # Structural preferences
    avoid_patterns: List[str]  # What the creator rarely does
    style_profile: Optional['StyleProfile'] = None  # Reference to full profile for detailed output

    def to_prompt_text(self) -> str:
        """Convert to text suitable for AI model prompting."""
        # If we have access to the full profile, generate comprehensive output
        if self.style_profile:
            return self._generate_comprehensive_prompt()

        # Fallback to basic format if no profile available
        return self._generate_basic_prompt()

    def _generate_comprehensive_prompt(self) -> str:
        """Generate comprehensive style card with detailed metrics."""
        profile = self.style_profile

        prompt_parts = [
            f"# {self.creator_name}'s AI Style Profile",
            "",
            f"**Profile Generated:** {profile.generation_timestamp[:19].replace('T', ' ')} UTC",
            f"**Analysis Confidence:** {profile.confidence_score:.1%}",
            f"**Content Analyzed:** {profile.total_words_analyzed:,} words from {profile.total_segments_analyzed} segments",
            f"**Total Duration:** {profile.total_duration_minutes:.1f} minutes",
            "",
            "## 🎯 Communication Archetype",
            f"**Primary Style:** {profile.communication_archetype.title()}",
            f"**Tone:** {self.tone_description}",
            "",
            self.style_summary,
            "",
            "## 📊 Speaking Metrics",
            f"- **Speaking Rate:** {profile.prosody.mean_words_per_minute:.1f} words per minute",
            f"- **Sentence Length:** {profile.syntax.mean_sentence_length:.1f} words average",
            f"- **Question Frequency:** {profile.syntax.question_frequency:.1%} of sentences",
            f"- **Lexical Diversity:** {profile.lexical.type_token_ratio:.1%} (vocabulary richness)",
            ""
        ]

        # Add signature phrases with counts
        if self.catchphrases:
            prompt_parts.extend([
                "## 🔤 Signature Phrases",
                f"**Top Expressions:** {', '.join(self.catchphrases[:5])}"
            ])

            # Add frequent words/fillers if available
            if profile.lexical.filler_words:
                top_fillers = sorted(profile.lexical.filler_words.items(), key=lambda x: x[1], reverse=True)[:3]
                filler_text = ", ".join([f"'{word}' ({freq:.1%})" for word, freq in top_fillers if freq > 0.02])
                if filler_text:
                    prompt_parts.append(f"**Frequent Words:** {filler_text}")

            prompt_parts.append("")

        # Communication patterns
        prompt_parts.extend([
            "## 💬 Communication Patterns"
        ])

        for pattern in self.key_patterns:
            prompt_parts.append(f"- {pattern}")

        # Point of view usage
        if profile.persona.pov_distribution:
            pov_items = [(pov, freq) for pov, freq in profile.persona.pov_distribution.items() if freq > 0.05]
            if pov_items:
                pov_text = ", ".join([f"'{pov}' ({freq:.1%})" for pov, freq in sorted(pov_items, key=lambda x: x[1], reverse=True)])
                prompt_parts.append(f"- **Pronoun Usage:** {pov_text}")

        prompt_parts.append("")

        # Formatting preferences
        if self.formatting_preferences:
            prompt_parts.extend([
                "## 📝 Content Structure Preferences"
            ])
            for pref in self.formatting_preferences:
                prompt_parts.append(f"- {pref}")
            prompt_parts.append("")

        # What to avoid
        if self.avoid_patterns:
            prompt_parts.extend([
                "## ❌ Patterns to Avoid"
            ])
            for pattern in self.avoid_patterns:
                prompt_parts.append(f"- {pattern}")
            prompt_parts.append("")

        # AI Prompting Guidelines
        prompt_parts.extend([
            "## 🤖 AI Response Guidelines",
            "",
            "**When responding as this creator:**",
            f"- Match the {profile.communication_archetype} archetype with {self.tone_description} tone",
            f"- Use approximately {profile.prosody.mean_words_per_minute:.0f} WPM pacing in voice responses",
            f"- Keep sentences around {profile.syntax.mean_sentence_length:.0f} words average",
            f"- Ask questions {profile.syntax.question_frequency:.1%} of the time to maintain engagement"
        ])

        # Add specific phrase usage if available
        if self.catchphrases:
            prompt_parts.append(f"- Naturally incorporate signature phrases: {', '.join(self.catchphrases[:3])}")

        # Add communication style specifics
        if profile.persona.pov_distribution.get("you", 0) > 0.1:
            prompt_parts.append("- Use direct audience engagement with 'you' language")

        if profile.syntax.imperative_frequency > 0.08:
            prompt_parts.append("- Include actionable advice and direct instructions")

        prompt_parts.extend([
            "",
            "**Voice and Delivery:**",
            f"- Energy Level: {'High' if profile.prosody.mean_words_per_minute > 160 else 'Moderate' if profile.prosody.mean_words_per_minute > 120 else 'Measured'}",
            f"- Sentence Variety: {'Concise and punchy' if profile.syntax.mean_sentence_length < 12 else 'Detailed and comprehensive'}",
            f"- Audience Interaction: {'Highly interactive' if profile.syntax.question_frequency > 0.15 else 'Moderately interactive' if profile.syntax.question_frequency > 0.08 else 'Primarily informational'}"
        ])

        return "\n".join(prompt_parts)

    def _generate_basic_prompt(self) -> str:
        """Generate basic style card format for backward compatibility."""
        prompt_parts = [
            f"**{self.creator_name}'s Communication Style:**",
            self.style_summary,
            "",
            "**Key Patterns:**"
        ]

        for pattern in self.key_patterns:
            prompt_parts.append(f"- {pattern}")

        if self.catchphrases:
            prompt_parts.extend(["", "**Signature Phrases:**"])
            prompt_parts.append(f"- {', '.join(self.catchphrases[:5])}")

        if self.formatting_preferences:
            prompt_parts.extend(["", "**Communication Style:**"])
            for pref in self.formatting_preferences:
                prompt_parts.append(f"- {pref}")

        return "\n".join(prompt_parts)


# Database integration types
@dataclass
class CreatorTranscriptData:
    """Transcript data retrieved from database for a creator."""
    creator_id: str
    segments: List[TranscriptSegment]
    total_videos: int
    total_duration: float
    date_range: Tuple[str, str]  # (earliest, latest)


# Configuration types
@dataclass
class AnalysisConfig:
    """Configuration for speech analysis."""
    min_segment_duration: float = 1.0  # Minimum segment duration in seconds
    max_segment_gap: float = 3.0  # Maximum gap to consider a pause
    min_words_for_analysis: int = 500  # Minimum words needed for reliable analysis
    top_ngrams_count: int = 20  # Number of top n-grams to extract
    rare_word_threshold: float = 0.001  # Threshold for rare words
    confidence_threshold: float = 0.7  # Minimum confidence for including segments
    enable_punctuation_restoration: bool = True
    language: str = "en"