"""
Style profile aggregation and generation module.
Creates comprehensive style profiles and human-readable style cards.
"""

import json
import datetime
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from speech_types import (
    ProcessedSegment, StyleProfile, StyleCard, LexicalFeatures,
    SyntaxFeatures, RepetitionFeatures, ProsodyFeatures, PersonaFeatures,
    AnalysisConfig
)
from features import FeatureExtractor
from preprocess import TranscriptPreprocessor


class StyleProfileGenerator:
    """Generates comprehensive style profiles from processed segments."""

    def __init__(self, config: AnalysisConfig):
        self.config = config
        self.preprocessor = TranscriptPreprocessor(config)
        self.feature_extractor = FeatureExtractor(config)

    def generate_profile(self, creator_id: str, segments: List[ProcessedSegment],
                        creator_name: Optional[str] = None) -> StyleProfile:
        """Generate a complete style profile from processed segments."""
        if not segments:
            raise ValueError("No segments provided for profile generation")

        # Validate minimum content requirements
        total_words = sum(seg.word_count for seg in segments)
        if total_words < self.config.min_words_for_analysis:
            raise ValueError(
                f"Insufficient content for reliable analysis. "
                f"Got {total_words} words, need at least {self.config.min_words_for_analysis}"
            )

        # Extract all feature types
        lexical, syntax, repetition, prosody, persona = self.feature_extractor.extract_all_features(segments)

        # Calculate metadata
        total_duration = sum(seg.original.duration for seg in segments) / 60.0  # minutes
        confidence_score = self._calculate_confidence_score(segments, lexical, syntax, persona)

        # Identify dominant patterns and archetype
        dominant_patterns = self._identify_dominant_patterns(lexical, syntax, repetition, persona)
        signature_elements = self._extract_signature_elements(lexical, repetition, persona)
        archetype = self._determine_communication_archetype(syntax, persona, lexical)

        return StyleProfile(
            creator_id=creator_id,
            profile_version="1.0",
            generation_timestamp=datetime.datetime.utcnow().isoformat(),
            lexical=lexical,
            syntax=syntax,
            repetition=repetition,
            prosody=prosody,
            persona=persona,
            dominant_patterns=dominant_patterns,
            signature_style_elements=signature_elements,
            communication_archetype=archetype,
            total_segments_analyzed=len(segments),
            total_words_analyzed=total_words,
            total_duration_minutes=total_duration,
            confidence_score=confidence_score
        )

    def _calculate_confidence_score(self, segments: List[ProcessedSegment],
                                  lexical: LexicalFeatures, syntax: SyntaxFeatures,
                                  persona: PersonaFeatures) -> float:
        """Calculate confidence score for the analysis."""
        factors = []

        # Content volume factor
        total_words = sum(seg.word_count for seg in segments)
        volume_factor = min(1.0, total_words / (self.config.min_words_for_analysis * 2))
        factors.append(volume_factor)

        # Lexical diversity factor (higher diversity = more reliable)
        diversity_factor = min(1.0, lexical.type_token_ratio * 2)
        factors.append(diversity_factor)

        # Syntax consistency factor
        if syntax.mean_sentence_length > 0:
            syntax_factor = min(1.0, 1.0 / (1.0 + syntax.sentence_length_variance / syntax.mean_sentence_length))
            factors.append(syntax_factor)

        # Persona consistency factor
        pov_total = sum(persona.pov_distribution.values())
        persona_factor = min(1.0, pov_total) if pov_total > 0 else 0.5
        factors.append(persona_factor)

        return sum(factors) / len(factors) if factors else 0.5

    def _identify_dominant_patterns(self, lexical: LexicalFeatures, syntax: SyntaxFeatures,
                                  repetition: RepetitionFeatures, persona: PersonaFeatures) -> List[str]:
        """Identify the most prominent patterns in the creator's style."""
        patterns = []

        # Lexical patterns
        if lexical.filler_words:
            top_filler = max(lexical.filler_words.items(), key=lambda x: x[1])
            if top_filler[1] > 0.05:  # More than 5% filler usage
                patterns.append(f"Frequent use of '{top_filler[0]}' ({top_filler[1]:.1%})")

        if lexical.type_token_ratio > 0.7:
            patterns.append("High lexical diversity")
        elif lexical.type_token_ratio < 0.3:
            patterns.append("Repetitive vocabulary")

        # Syntax patterns
        if syntax.mean_sentence_length < 10:
            patterns.append("Short, punchy sentences")
        elif syntax.mean_sentence_length > 20:
            patterns.append("Long, complex sentences")

        if syntax.question_frequency > 0.15:
            patterns.append("Frequent use of questions")

        if syntax.imperative_frequency > 0.1:
            patterns.append("Direct, imperative style")

        # Repetition patterns
        if repetition.word_repetition_rate > 0.3:
            patterns.append("Emphatic repetition")

        if repetition.signature_expressions:
            top_expression = repetition.signature_expressions[0]
            patterns.append(f"Signature phrase: '{top_expression}'")

        # Persona patterns
        if persona.pov_distribution.get("you", 0) > 0.1:
            patterns.append("Direct audience engagement")

        if persona.sentiment_distribution.get("positive", 0) > 0.7:
            patterns.append("Predominantly positive tone")

        return patterns[:8]  # Return top 8 patterns

    def _extract_signature_elements(self, lexical: LexicalFeatures,
                                  repetition: RepetitionFeatures,
                                  persona: PersonaFeatures) -> List[str]:
        """Extract elements that make this creator's style unique."""
        elements = []

        # Unique vocabulary elements
        if lexical.top_trigrams:
            unique_trigram = lexical.top_trigrams[0][0]  # Most frequent trigram
            elements.append(f"Characteristic phrase: '{unique_trigram}'")

        # Discourse markers
        if lexical.discourse_markers:
            top_marker = max(lexical.discourse_markers.items(), key=lambda x: x[1])
            if top_marker[1] > 0.02:
                elements.append(f"Frequent discourse marker: '{top_marker[0]}'")

        # Signature expressions
        for expr in repetition.signature_expressions[:3]:  # Top 3
            elements.append(f"Recurring expression: '{expr}'")

        # Enthusiasm markers
        for marker in persona.enthusiasm_markers[:2]:  # Top 2
            elements.append(f"Enthusiasm: {marker}")

        return elements[:6]  # Return top 6 elements

    def _determine_communication_archetype(self, syntax: SyntaxFeatures,
                                         persona: PersonaFeatures,
                                         lexical: LexicalFeatures) -> str:
        """Determine the creator's communication archetype."""
        # Score different archetypes based on features
        educator_score = 0
        entertainer_score = 0
        motivator_score = 0
        storyteller_score = 0

        # Educator indicators
        if syntax.question_frequency > 0.1:
            educator_score += 2
        if persona.pov_distribution.get("you", 0) > 0.15:
            educator_score += 2
        if syntax.list_usage_frequency > 0.2:
            educator_score += 1

        # Entertainer indicators
        if persona.sentiment_distribution.get("positive", 0) > 0.6:
            entertainer_score += 2
        if len(persona.enthusiasm_markers) > 2:
            entertainer_score += 2
        if lexical.filler_words.get("like", 0) > 0.05:
            entertainer_score += 1

        # Motivator indicators
        if syntax.imperative_frequency > 0.08:
            motivator_score += 2
        if persona.call_to_action_frequency > 0.01:
            motivator_score += 2
        if persona.pov_distribution.get("we", 0) > 0.1:
            motivator_score += 1

        # Storyteller indicators
        if syntax.mean_sentence_length > 15:
            storyteller_score += 1
        if persona.personal_anecdote_rate > 0.3:
            storyteller_score += 2
        if persona.pov_distribution.get("I", 0) > 0.2:
            storyteller_score += 1

        # Determine archetype
        scores = {
            "educator": educator_score,
            "entertainer": entertainer_score,
            "motivator": motivator_score,
            "storyteller": storyteller_score
        }

        return max(scores.items(), key=lambda x: x[1])[0]

    def generate_style_card(self, profile: StyleProfile,
                          creator_name: Optional[str] = None) -> StyleCard:
        """Generate a human-readable style card from a profile."""
        name = creator_name or f"Creator {profile.creator_id[:8]}"

        # Generate style summary
        summary = self._generate_style_summary(profile)

        # Extract key patterns
        key_patterns = self._extract_key_patterns_for_card(profile)

        # Extract catchphrases
        catchphrases = profile.repetition.signature_expressions[:5]

        # Generate tone description
        tone_description = self._generate_tone_description(profile)

        # Extract formatting preferences
        formatting_prefs = self._extract_formatting_preferences(profile)

        # Identify what to avoid
        avoid_patterns = self._identify_avoid_patterns(profile)

        return StyleCard(
            creator_name=name,
            style_summary=summary,
            key_patterns=key_patterns,
            catchphrases=catchphrases,
            tone_description=tone_description,
            formatting_preferences=formatting_prefs,
            avoid_patterns=avoid_patterns,
            style_profile=profile  # Pass full profile for comprehensive output
        )

    def _generate_style_summary(self, profile: StyleProfile) -> str:
        """Generate a 2-3 sentence style summary."""
        archetype = profile.communication_archetype
        sentence_style = "short, direct sentences" if profile.syntax.mean_sentence_length < 12 else "detailed explanations"

        # Identify primary communication trait
        if profile.persona.pov_distribution.get("you", 0) > 0.1:
            engagement_style = "directly engages with the audience"
        elif profile.persona.pov_distribution.get("we", 0) > 0.08:
            engagement_style = "builds community through inclusive language"
        else:
            engagement_style = "shares personal insights and experiences"

        summary = f"A {archetype} who {engagement_style} through {sentence_style}. "

        # Add dominant pattern
        if profile.dominant_patterns:
            main_pattern = profile.dominant_patterns[0].lower()
            summary += f"Known for {main_pattern}. "

        # Add speaking style
        if profile.prosody.mean_words_per_minute > 160:
            pace = "energetic, fast-paced delivery"
        elif profile.prosody.mean_words_per_minute < 120:
            pace = "thoughtful, measured delivery"
        else:
            pace = "conversational pacing"

        summary += f"Communicates with {pace}."

        return summary

    def _extract_key_patterns_for_card(self, profile: StyleProfile) -> List[str]:
        """Extract key patterns for the style card."""
        patterns = []

        # Filler word patterns
        if profile.lexical.filler_words:
            top_fillers = sorted(profile.lexical.filler_words.items(),
                               key=lambda x: x[1], reverse=True)[:2]
            for filler, freq in top_fillers:
                if freq > 0.03:  # More than 3%
                    patterns.append(f"Uses '{filler}' frequently ({freq:.1%} of speech)")

        # Sentence structure
        if profile.syntax.mean_sentence_length < 10:
            patterns.append("Prefers short, punchy sentences (avg {:.0f} words)".format(
                profile.syntax.mean_sentence_length))
        elif profile.syntax.mean_sentence_length > 18:
            patterns.append("Uses detailed, complex sentences (avg {:.0f} words)".format(
                profile.syntax.mean_sentence_length))

        # Engagement patterns
        if profile.syntax.question_frequency > 0.1:
            patterns.append(f"Frequently asks questions ({profile.syntax.question_frequency:.1%} of sentences)")

        if profile.persona.direct_address_frequency > 0.1:
            patterns.append("High audience engagement through direct address")

        # Speaking pace
        if profile.prosody.mean_words_per_minute > 0:
            if profile.prosody.mean_words_per_minute > 160:
                patterns.append(f"Fast-paced delivery ({profile.prosody.mean_words_per_minute:.0f} WPM)")
            elif profile.prosody.mean_words_per_minute < 120:
                patterns.append(f"Thoughtful pacing ({profile.prosody.mean_words_per_minute:.0f} WPM)")

        # Repetition patterns
        if profile.repetition.word_repetition_rate > 0.2:
            patterns.append("Uses repetition for emphasis")

        return patterns[:6]

    def _generate_tone_description(self, profile: StyleProfile) -> str:
        """Generate a description of the creator's tone."""
        tone_elements = []

        # Sentiment-based tone
        if profile.persona.sentiment_distribution.get("positive", 0) > 0.6:
            tone_elements.append("upbeat")
        elif profile.persona.sentiment_distribution.get("negative", 0) > 0.3:
            tone_elements.append("critical")
        else:
            tone_elements.append("balanced")

        # Engagement style
        if profile.persona.direct_address_frequency > 0.1:
            tone_elements.append("conversational")

        if profile.syntax.imperative_frequency > 0.08:
            tone_elements.append("authoritative")

        if profile.persona.pov_distribution.get("we", 0) > 0.08:
            tone_elements.append("inclusive")

        # Enthusiasm level
        if len(profile.persona.enthusiasm_markers) > 2:
            tone_elements.append("enthusiastic")
        elif profile.prosody.mean_words_per_minute < 120:
            tone_elements.append("measured")

        # Formality level
        if profile.lexical.filler_words:
            tone_elements.append("casual")
        else:
            tone_elements.append("polished")

        return ", ".join(tone_elements[:4])

    def _extract_formatting_preferences(self, profile: StyleProfile) -> List[str]:
        """Extract formatting and structural preferences."""
        preferences = []

        # List usage
        if profile.syntax.list_usage_frequency > 0.2:
            preferences.append("Frequently uses lists and bullet points")

        # Question usage
        if profile.syntax.question_frequency > 0.1:
            preferences.append("Engages audience with questions")

        # Sentence structure preference
        if profile.syntax.sentence_length_distribution.get("short", 0) > 0.5:
            preferences.append("Favors concise, digestible content")
        elif profile.syntax.sentence_length_distribution.get("long", 0) > 0.3:
            preferences.append("Provides comprehensive, detailed explanations")

        # Emphasis patterns
        if profile.repetition.word_repetition_rate > 0.2:
            preferences.append("Uses repetition for emphasis and clarity")

        # Call to action style
        if profile.persona.call_to_action_frequency > 0.01:
            preferences.append("Includes clear calls to action")

        return preferences[:4]

    def _identify_avoid_patterns(self, profile: StyleProfile) -> List[str]:
        """Identify patterns the creator rarely uses."""
        avoid_patterns = []

        # Things they don't do much
        if profile.syntax.question_frequency < 0.05:
            avoid_patterns.append("Rarely asks direct questions")

        if profile.persona.sentiment_distribution.get("negative", 0) < 0.1:
            avoid_patterns.append("Avoids negative or critical language")

        if profile.lexical.filler_words.get("um", 0) < 0.01:
            avoid_patterns.append("Minimal use of hesitation markers")

        if profile.syntax.imperative_frequency < 0.03:
            avoid_patterns.append("Rarely uses direct commands")

        if profile.persona.personal_anecdote_rate < 0.1:
            avoid_patterns.append("Limited personal storytelling")

        return avoid_patterns[:3]

    def save_profile(self, profile: StyleProfile, filepath: str) -> None:
        """Save style profile to JSON file."""
        profile_dict = asdict(profile)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(profile_dict, f, indent=2, ensure_ascii=False)

    def load_profile(self, filepath: str) -> StyleProfile:
        """Load style profile from JSON file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            profile_dict = json.load(f)

        # Reconstruct the profile object
        # Note: This is a simplified version; in production you'd want proper deserialization
        return StyleProfile(**profile_dict)

    def export_style_card_text(self, card: StyleCard) -> str:
        """Export style card as formatted text for AI prompting."""
        return card.to_prompt_text()


def create_profile_generator(config: Optional[AnalysisConfig] = None) -> StyleProfileGenerator:
    """Factory function to create a profile generator."""
    if config is None:
        config = AnalysisConfig()
    return StyleProfileGenerator(config)