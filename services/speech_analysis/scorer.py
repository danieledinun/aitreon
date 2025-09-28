"""
Style similarity scoring module.
Compares new text against creator style profiles to measure similarity.
"""

import math
from typing import Dict, List, Tuple, Optional
from collections import Counter
import numpy as np
from scipy.stats import entropy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from speech_types import StyleProfile, StyleScore, StyleMetric, AnalysisConfig
from preprocess import TranscriptPreprocessor
from features import FeatureExtractor


class StyleScorer:
    """Scores text similarity to creator style profiles."""

    def __init__(self, config: AnalysisConfig):
        self.config = config
        self.preprocessor = TranscriptPreprocessor(config)

    def score_text_similarity(self, text: str, profile: StyleProfile,
                            detailed: bool = True) -> StyleScore:
        """Score how well text matches a creator's style profile."""
        if not text.strip():
            return self._create_empty_score()

        # Create a mock segment for processing
        from speech_types import TranscriptSegment, ProcessedSegment
        mock_segment = TranscriptSegment(
            video_id="scorer_temp",
            start_time=0.0,
            end_time=len(text.split()) / 2.5,  # Rough duration estimate
            text=text,
            confidence=1.0
        )

        processed = self.preprocessor.process_segment(mock_segment)
        segments = [processed]

        # Extract features from the text
        feature_extractor = FeatureExtractor(self.config)
        text_lexical, text_syntax, text_repetition, text_prosody, text_persona = \
            feature_extractor.extract_all_features(segments)

        # Score each feature category
        metric_scores = {}

        # Lexical similarity
        metric_scores[StyleMetric.LEXICAL_DIVERSITY] = self._score_lexical_features(
            text_lexical, profile.lexical)

        # Syntax similarity
        metric_scores[StyleMetric.SENTENCE_LENGTH] = self._score_sentence_length(
            text_syntax, profile.syntax)

        # Filler word similarity
        metric_scores[StyleMetric.FILLER_FREQUENCY] = self._score_filler_usage(
            text_lexical, profile.lexical)

        # POV similarity
        metric_scores[StyleMetric.POV_DISTRIBUTION] = self._score_pov_distribution(
            text_persona, profile.persona)

        # Sentiment similarity
        metric_scores[StyleMetric.SENTIMENT_PROFILE] = self._score_sentiment_profile(
            text_persona, profile.persona)

        # Catchphrase usage
        metric_scores[StyleMetric.CATCHPHRASE_USAGE] = self._score_catchphrase_usage(
            text, profile.repetition.signature_expressions)

        # Calculate overall score
        overall_score = self._calculate_overall_score(metric_scores)

        # Generate detailed breakdown if requested
        detailed_breakdown = {}
        recommendations = []

        if detailed:
            detailed_breakdown = self._generate_detailed_breakdown(
                text_lexical, text_syntax, text_persona, profile, metric_scores)
            recommendations = self._generate_recommendations(
                metric_scores, profile, text)

        return StyleScore(
            overall_score=overall_score,
            metric_scores=metric_scores,
            detailed_breakdown=detailed_breakdown,
            recommendations=recommendations
        )

    def _create_empty_score(self) -> StyleScore:
        """Create empty score for invalid input."""
        return StyleScore(
            overall_score=0.0,
            metric_scores={metric: 0.0 for metric in StyleMetric},
            detailed_breakdown={},
            recommendations=["No text provided for analysis"]
        )

    def _score_lexical_features(self, text_lexical, profile_lexical) -> float:
        """Score lexical diversity and vocabulary similarity."""
        scores = []

        # Type-token ratio similarity
        if profile_lexical.type_token_ratio > 0:
            ttr_diff = abs(text_lexical.type_token_ratio - profile_lexical.type_token_ratio)
            ttr_score = max(0.0, 1.0 - (ttr_diff / 0.5))  # Normalize by reasonable range
            scores.append(ttr_score)

        # Vocabulary sophistication (using vocabulary size as proxy)
        if profile_lexical.vocabulary_size > 0 and text_lexical.vocabulary_size > 0:
            vocab_ratio = min(text_lexical.vocabulary_size, profile_lexical.vocabulary_size) / \
                         max(text_lexical.vocabulary_size, profile_lexical.vocabulary_size)
            scores.append(vocab_ratio)

        return sum(scores) / len(scores) if scores else 0.5

    def _score_sentence_length(self, text_syntax, profile_syntax) -> float:
        """Score sentence length similarity."""
        if profile_syntax.mean_sentence_length <= 0:
            return 0.5

        length_diff = abs(text_syntax.mean_sentence_length - profile_syntax.mean_sentence_length)
        # Normalize by reasonable sentence length range (5-30 words)
        normalized_diff = length_diff / 25.0
        return max(0.0, 1.0 - normalized_diff)

    def _score_filler_usage(self, text_lexical, profile_lexical) -> float:
        """Score filler word usage similarity."""
        if not profile_lexical.filler_words:
            return 0.8  # Neutral score if profile has no filler data

        scores = []
        for filler, profile_freq in profile_lexical.filler_words.items():
            text_freq = text_lexical.filler_words.get(filler, 0.0)
            freq_diff = abs(text_freq - profile_freq)
            # Normalize by reasonable filler frequency range (0-0.2)
            normalized_diff = freq_diff / 0.2
            filler_score = max(0.0, 1.0 - normalized_diff)
            scores.append(filler_score)

        return sum(scores) / len(scores) if scores else 0.5

    def _score_pov_distribution(self, text_persona, profile_persona) -> float:
        """Score point-of-view distribution similarity."""
        if not profile_persona.pov_distribution:
            return 0.5

        pov_categories = ["I", "you", "we", "they"]
        scores = []

        for pov in pov_categories:
            profile_freq = profile_persona.pov_distribution.get(pov, 0.0)
            text_freq = text_persona.pov_distribution.get(pov, 0.0)
            freq_diff = abs(text_freq - profile_freq)
            # Normalize by reasonable POV frequency range (0-0.5)
            normalized_diff = freq_diff / 0.5
            pov_score = max(0.0, 1.0 - normalized_diff)
            scores.append(pov_score)

        return sum(scores) / len(scores)

    def _score_sentiment_profile(self, text_persona, profile_persona) -> float:
        """Score sentiment distribution similarity."""
        if not profile_persona.sentiment_distribution:
            return 0.5

        sentiment_categories = ["positive", "negative", "neutral"]
        scores = []

        for sentiment in sentiment_categories:
            profile_freq = profile_persona.sentiment_distribution.get(sentiment, 0.0)
            text_freq = text_persona.sentiment_distribution.get(sentiment, 0.0)
            freq_diff = abs(text_freq - profile_freq)
            # Normalize by sentiment range (0-1.0)
            normalized_diff = freq_diff / 1.0
            sentiment_score = max(0.0, 1.0 - normalized_diff)
            scores.append(sentiment_score)

        return sum(scores) / len(scores)

    def _score_catchphrase_usage(self, text: str, signature_expressions: List[str]) -> float:
        """Score usage of creator's signature phrases."""
        if not signature_expressions:
            return 0.7  # Neutral score if no signature phrases

        text_lower = text.lower()
        matches = 0
        total_expressions = len(signature_expressions)

        for expression in signature_expressions:
            if expression.lower() in text_lower:
                matches += 1

        # Score based on presence of signature expressions
        if total_expressions == 0:
            return 0.7
        elif matches == 0:
            return 0.3  # Low score for no signature phrases
        else:
            # Bonus for using signature phrases, but don't penalize too much for not using all
            return min(1.0, 0.7 + (matches / total_expressions) * 0.3)

    def _calculate_overall_score(self, metric_scores: Dict[StyleMetric, float]) -> float:
        """Calculate weighted overall similarity score."""
        # Define weights for different metrics
        weights = {
            StyleMetric.LEXICAL_DIVERSITY: 0.15,
            StyleMetric.SENTENCE_LENGTH: 0.20,
            StyleMetric.FILLER_FREQUENCY: 0.15,
            StyleMetric.POV_DISTRIBUTION: 0.20,
            StyleMetric.SENTIMENT_PROFILE: 0.15,
            StyleMetric.CATCHPHRASE_USAGE: 0.15
        }

        weighted_sum = 0.0
        total_weight = 0.0

        for metric, score in metric_scores.items():
            weight = weights.get(metric, 0.1)
            weighted_sum += score * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    def _generate_detailed_breakdown(self, text_lexical, text_syntax, text_persona,
                                   profile: StyleProfile,
                                   metric_scores: Dict[StyleMetric, float]) -> Dict[str, str]:
        """Generate detailed breakdown of scoring."""
        breakdown = {}

        # Lexical breakdown
        if text_lexical.type_token_ratio > 0 and profile.lexical.type_token_ratio > 0:
            breakdown["lexical_diversity"] = (
                f"Text diversity: {text_lexical.type_token_ratio:.2f}, "
                f"Profile diversity: {profile.lexical.type_token_ratio:.2f}"
            )

        # Syntax breakdown
        breakdown["sentence_length"] = (
            f"Text avg: {text_syntax.mean_sentence_length:.1f} words, "
            f"Profile avg: {profile.syntax.mean_sentence_length:.1f} words"
        )

        # Filler word breakdown
        if profile.lexical.filler_words:
            top_filler = max(profile.lexical.filler_words.items(), key=lambda x: x[1])
            text_filler_freq = text_lexical.filler_words.get(top_filler[0], 0.0)
            breakdown["filler_usage"] = (
                f"'{top_filler[0]}' - Text: {text_filler_freq:.1%}, "
                f"Profile: {top_filler[1]:.1%}"
            )

        # POV breakdown
        for pov in ["I", "you", "we"]:
            text_freq = text_persona.pov_distribution.get(pov, 0.0)
            profile_freq = profile.persona.pov_distribution.get(pov, 0.0)
            breakdown[f"pov_{pov.lower()}"] = (
                f"Text: {text_freq:.1%}, Profile: {profile_freq:.1%}"
            )

        # Sentiment breakdown
        for sentiment in ["positive", "negative", "neutral"]:
            text_freq = text_persona.sentiment_distribution.get(sentiment, 0.0)
            profile_freq = profile.persona.sentiment_distribution.get(sentiment, 0.0)
            breakdown[f"sentiment_{sentiment}"] = (
                f"Text: {text_freq:.1%}, Profile: {profile_freq:.1%}"
            )

        return breakdown

    def _generate_recommendations(self, metric_scores: Dict[StyleMetric, float],
                                profile: StyleProfile, text: str) -> List[str]:
        """Generate recommendations to improve style match."""
        recommendations = []

        # Low sentence length score
        if metric_scores.get(StyleMetric.SENTENCE_LENGTH, 1.0) < 0.6:
            target_length = profile.syntax.mean_sentence_length
            if target_length < 12:
                recommendations.append("Use shorter, more punchy sentences")
            elif target_length > 18:
                recommendations.append("Provide more detailed, comprehensive explanations")

        # Low filler frequency score
        if metric_scores.get(StyleMetric.FILLER_FREQUENCY, 1.0) < 0.6:
            if profile.lexical.filler_words:
                top_filler = max(profile.lexical.filler_words.items(), key=lambda x: x[1])
                if top_filler[1] > 0.05:
                    recommendations.append(f"Incorporate '{top_filler[0]}' more frequently")

        # Low POV score
        if metric_scores.get(StyleMetric.POV_DISTRIBUTION, 1.0) < 0.6:
            if profile.persona.pov_distribution.get("you", 0) > 0.1:
                recommendations.append("Address the audience more directly using 'you'")
            elif profile.persona.pov_distribution.get("we", 0) > 0.08:
                recommendations.append("Use more inclusive language with 'we' and 'us'")
            elif profile.persona.pov_distribution.get("I", 0) > 0.15:
                recommendations.append("Share more personal experiences and insights")

        # Low catchphrase score
        if metric_scores.get(StyleMetric.CATCHPHRASE_USAGE, 1.0) < 0.6:
            if profile.repetition.signature_expressions:
                top_phrase = profile.repetition.signature_expressions[0]
                recommendations.append(f"Consider using signature phrase: '{top_phrase}'")

        # Low sentiment score
        if metric_scores.get(StyleMetric.SENTIMENT_PROFILE, 1.0) < 0.6:
            if profile.persona.sentiment_distribution.get("positive", 0) > 0.6:
                recommendations.append("Adopt a more positive, upbeat tone")
            elif profile.persona.sentiment_distribution.get("negative", 0) > 0.3:
                recommendations.append("Include more critical analysis and honest feedback")

        # Overall low score
        overall_score = metric_scores.get(StyleMetric.LEXICAL_DIVERSITY, 0.0)
        if overall_score < 0.5:
            recommendations.append(
                f"Study the creator's communication archetype: {profile.communication_archetype}"
            )

        return recommendations[:5]  # Return top 5 recommendations

    def batch_score_texts(self, texts: List[str], profile: StyleProfile) -> List[StyleScore]:
        """Score multiple texts against a profile."""
        return [self.score_text_similarity(text, profile, detailed=False) for text in texts]

    def compare_profiles(self, profile1: StyleProfile, profile2: StyleProfile) -> float:
        """Compare similarity between two style profiles."""
        scores = []

        # Compare lexical features
        if profile1.lexical.type_token_ratio > 0 and profile2.lexical.type_token_ratio > 0:
            ttr_diff = abs(profile1.lexical.type_token_ratio - profile2.lexical.type_token_ratio)
            ttr_score = max(0.0, 1.0 - (ttr_diff / 0.5))
            scores.append(ttr_score)

        # Compare syntax features
        if profile1.syntax.mean_sentence_length > 0 and profile2.syntax.mean_sentence_length > 0:
            length_diff = abs(profile1.syntax.mean_sentence_length - profile2.syntax.mean_sentence_length)
            length_score = max(0.0, 1.0 - (length_diff / 25.0))
            scores.append(length_score)

        # Compare POV distributions
        pov_similarity = self._calculate_distribution_similarity(
            profile1.persona.pov_distribution,
            profile2.persona.pov_distribution
        )
        scores.append(pov_similarity)

        # Compare sentiment distributions
        sentiment_similarity = self._calculate_distribution_similarity(
            profile1.persona.sentiment_distribution,
            profile2.persona.sentiment_distribution
        )
        scores.append(sentiment_similarity)

        return sum(scores) / len(scores) if scores else 0.0

    def _calculate_distribution_similarity(self, dist1: Dict[str, float],
                                         dist2: Dict[str, float]) -> float:
        """Calculate similarity between two probability distributions."""
        if not dist1 or not dist2:
            return 0.5

        # Get all keys from both distributions
        all_keys = set(dist1.keys()) | set(dist2.keys())

        # Create aligned vectors
        vec1 = [dist1.get(key, 0.0) for key in all_keys]
        vec2 = [dist2.get(key, 0.0) for key in all_keys]

        # Calculate cosine similarity
        try:
            vec1 = np.array(vec1).reshape(1, -1)
            vec2 = np.array(vec2).reshape(1, -1)
            similarity = cosine_similarity(vec1, vec2)[0][0]
            return max(0.0, similarity)  # Ensure non-negative
        except:
            return 0.5


def create_style_scorer(config: Optional[AnalysisConfig] = None) -> StyleScorer:
    """Factory function to create a style scorer."""
    if config is None:
        config = AnalysisConfig()
    return StyleScorer(config)