"""
Feature extraction module for linguistic pattern analysis.
Handles lexical, syntactic, repetition, prosody, and persona features.
"""

import re
import math
from collections import Counter, defaultdict
from typing import List, Dict, Tuple, Set, Optional
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import spacy
import textstat

from speech_types import (
    ProcessedSegment, LexicalFeatures, SyntaxFeatures, RepetitionFeatures,
    ProsodyFeatures, PersonaFeatures, AnalysisConfig
)


class FeatureExtractor:
    """Main feature extraction class combining all analysis types."""

    def __init__(self, config: AnalysisConfig):
        self.config = config
        self.nlp = self._load_spacy_model()

        # Initialize specialized extractors
        self.lexical_extractor = LexicalAnalyzer(config, self.nlp)
        self.syntax_extractor = SyntaxAnalyzer(config, self.nlp)
        self.repetition_extractor = RepetitionAnalyzer(config, self.nlp)
        self.prosody_extractor = ProsodyAnalyzer(config)
        self.persona_extractor = PersonaAnalyzer(config, self.nlp)

    def _load_spacy_model(self) -> spacy.Language:
        """Load spaCy model for NLP processing."""
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError(
                "spaCy English model not found. Install with: "
                "python -m spacy download en_core_web_sm"
            )

    def extract_all_features(self, segments: List[ProcessedSegment]) -> Tuple[
        LexicalFeatures, SyntaxFeatures, RepetitionFeatures,
        ProsodyFeatures, PersonaFeatures
    ]:
        """Extract all feature types from processed segments."""
        if not segments:
            raise ValueError("No segments provided for feature extraction")

        # Combine all text for comprehensive analysis
        all_text = ' '.join(seg.cleaned_text for seg in segments)
        all_sentences = []
        for seg in segments:
            all_sentences.extend(seg.sentences)

        # Extract features using specialized analyzers
        lexical = self.lexical_extractor.extract_features(all_text, segments)
        syntax = self.syntax_extractor.extract_features(all_sentences, segments)
        repetition = self.repetition_extractor.extract_features(segments)
        prosody = self.prosody_extractor.extract_features(segments)
        persona = self.persona_extractor.extract_features(all_text, segments)

        return lexical, syntax, repetition, prosody, persona


class LexicalAnalyzer:
    """Analyzes lexical patterns and vocabulary usage."""

    def __init__(self, config: AnalysisConfig, nlp: spacy.Language):
        self.config = config
        self.nlp = nlp

        # Common English filler words and discourse markers
        self.filler_words = {
            'um', 'uh', 'ah', 'er', 'like', 'you know', 'so', 'well',
            'actually', 'basically', 'literally', 'right', 'okay', 'alright',
            'i mean', 'kind of', 'sort of', 'you see', 'i guess', 'obviously',
            'clearly', 'honestly', 'frankly', 'look', 'listen'
        }

        self.discourse_markers = {
            'so', 'well', 'now', 'then', 'anyway', 'however', 'therefore',
            'moreover', 'furthermore', 'meanwhile', 'first', 'second', 'finally',
            'by the way', 'speaking of', 'on the other hand', 'in conclusion'
        }

        # Function words (pronouns, prepositions, articles, etc.)
        self.function_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
            'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through',
            'during', 'before', 'after', 'above', 'below', 'up', 'down',
            'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
        }

    def extract_features(self, text: str, segments: List[ProcessedSegment]) -> LexicalFeatures:
        """Extract lexical features from text."""
        # Process text with spaCy
        doc = self.nlp(text)
        tokens = [token.text.lower() for token in doc if not token.is_space]
        words = [token for token in tokens if token.isalpha()]

        # Extract n-grams
        top_bigrams = self._extract_ngrams(text, 2, self.config.top_ngrams_count)
        top_trigrams = self._extract_ngrams(text, 3, self.config.top_ngrams_count)
        top_4grams = self._extract_ngrams(text, 4, self.config.top_ngrams_count)
        top_5grams = self._extract_ngrams(text, 5, self.config.top_ngrams_count)
        top_6grams = self._extract_ngrams(text, 6, self.config.top_ngrams_count)

        # Analyze filler words and discourse markers
        filler_freq = self._calculate_filler_frequency(tokens)
        function_word_dist = self._calculate_function_word_distribution(tokens)
        discourse_freq = self._calculate_discourse_marker_frequency(tokens)

        # Calculate diversity metrics
        type_token_ratio = len(set(words)) / len(words) if words else 0
        mtld_score = self._calculate_mtld(words)
        vocabulary_size = len(set(words))
        rare_word_freq = self._calculate_rare_word_frequency(words)

        return LexicalFeatures(
            top_bigrams=top_bigrams,
            top_trigrams=top_trigrams,
            top_4grams=top_4grams,
            top_5grams=top_5grams,
            top_6grams=top_6grams,
            filler_words=filler_freq,
            function_word_dist=function_word_dist,
            discourse_markers=discourse_freq,
            type_token_ratio=type_token_ratio,
            mtld_score=mtld_score,
            vocabulary_size=vocabulary_size,
            rare_word_frequency=rare_word_freq
        )

    def _extract_ngrams(self, text: str, n: int, top_k: int) -> List[Tuple[str, float]]:
        """Extract top n-grams with PMI scoring."""
        # Create n-gram vectorizer
        vectorizer = CountVectorizer(
            ngram_range=(n, n),
            lowercase=True,
            token_pattern=r'\b\w+\b',
            max_features=1000
        )

        try:
            ngram_matrix = vectorizer.fit_transform([text])
            feature_names = vectorizer.get_feature_names_out()
            frequencies = ngram_matrix.toarray()[0]

            # Calculate PMI scores (simplified version)
            total_ngrams = sum(frequencies)
            ngram_scores = []

            for i, ngram in enumerate(feature_names):
                freq = frequencies[i]
                if freq > 1:  # Only consider n-grams that appear more than once
                    # Simple frequency-based scoring (in production, use proper PMI)
                    score = freq / total_ngrams
                    ngram_scores.append((ngram, score))

            # Sort by score and return top k
            ngram_scores.sort(key=lambda x: x[1], reverse=True)
            return ngram_scores[:top_k]

        except Exception:
            return []

    def _calculate_filler_frequency(self, tokens: List[str]) -> Dict[str, float]:
        """Calculate frequency of filler words."""
        total_tokens = len(tokens)
        if total_tokens == 0:
            return {}

        filler_counts = Counter()
        text = ' '.join(tokens)

        # Check for multi-word fillers
        for filler in self.filler_words:
            if ' ' in filler:
                count = text.count(filler)
                if count > 0:
                    filler_counts[filler] = count
            else:
                filler_counts[filler] = tokens.count(filler)

        # Convert to frequencies
        return {filler: count / total_tokens
                for filler, count in filler_counts.items() if count > 0}

    def _calculate_function_word_distribution(self, tokens: List[str]) -> Dict[str, float]:
        """Calculate distribution of function words."""
        total_tokens = len(tokens)
        if total_tokens == 0:
            return {}

        function_counts = Counter()
        for token in tokens:
            if token in self.function_words:
                function_counts[token] += 1

        return {word: count / total_tokens
                for word, count in function_counts.items()}

    def _calculate_discourse_marker_frequency(self, tokens: List[str]) -> Dict[str, float]:
        """Calculate frequency of discourse markers."""
        total_tokens = len(tokens)
        if total_tokens == 0:
            return {}

        marker_counts = Counter()
        text = ' '.join(tokens)

        for marker in self.discourse_markers:
            if ' ' in marker:
                count = text.count(marker)
            else:
                count = tokens.count(marker)

            if count > 0:
                marker_counts[marker] = count

        return {marker: count / total_tokens
                for marker, count in marker_counts.items()}

    def _calculate_mtld(self, words: List[str]) -> float:
        """Calculate Measure of Textual Lexical Diversity (MTLD)."""
        if len(words) < 50:  # MTLD requires sufficient text
            return 0.0

        def mtld_calc(word_list: List[str], threshold: float = 0.72) -> float:
            """Calculate MTLD for a word list."""
            if not word_list:
                return 0.0

            ttr_values = []
            types = set()

            for i, word in enumerate(word_list, 1):
                types.add(word)
                ttr = len(types) / i
                ttr_values.append(ttr)

                if ttr <= threshold:
                    return i

            return len(word_list)

        # Calculate forward and backward MTLD
        forward_mtld = mtld_calc(words)
        backward_mtld = mtld_calc(words[::-1])

        return (forward_mtld + backward_mtld) / 2

    def _calculate_rare_word_frequency(self, words: List[str]) -> float:
        """Calculate frequency of rare words."""
        if not words:
            return 0.0

        word_counts = Counter(words)
        total_words = len(words)

        # Define rare words as those appearing below threshold
        rare_threshold = self.config.rare_word_threshold * total_words
        rare_word_count = sum(1 for count in word_counts.values()
                            if count <= rare_threshold)

        return rare_word_count / len(word_counts) if word_counts else 0.0


class SyntaxAnalyzer:
    """Analyzes syntactic patterns and sentence structure."""

    def __init__(self, config: AnalysisConfig, nlp: spacy.Language):
        self.config = config
        self.nlp = nlp

    def extract_features(self, sentences: List[str],
                        segments: List[ProcessedSegment]) -> SyntaxFeatures:
        """Extract syntactic features from sentences."""
        if not sentences:
            return self._empty_syntax_features()

        # Analyze sentence lengths
        sentence_lengths = [len(sent.split()) for sent in sentences if sent.strip()]
        mean_length = np.mean(sentence_lengths) if sentence_lengths else 0
        length_variance = np.var(sentence_lengths) if sentence_lengths else 0

        # Categorize sentence lengths
        length_dist = self._categorize_sentence_lengths(sentence_lengths)

        # Analyze POS patterns
        all_text = ' '.join(sentences)
        doc = self.nlp(all_text)

        pos_dist = self._calculate_pos_distribution(doc)
        pronoun_freq = self._calculate_pronoun_frequency(doc)
        imperative_freq = self._calculate_imperative_frequency(sentences)
        question_freq = self._calculate_question_frequency(sentences)

        # Analyze rhetorical patterns
        repetition_patterns = self._find_repetition_patterns(sentences)
        parallel_structures = self._find_parallel_structures(sentences)
        list_usage_freq = self._calculate_list_usage_frequency(sentences)

        return SyntaxFeatures(
            mean_sentence_length=mean_length,
            sentence_length_variance=length_variance,
            sentence_length_distribution=length_dist,
            pos_distribution=pos_dist,
            pronoun_frequency=pronoun_freq,
            imperative_frequency=imperative_freq,
            question_frequency=question_freq,
            repetition_patterns=repetition_patterns,
            parallel_structures=parallel_structures,
            list_usage_frequency=list_usage_freq
        )

    def _empty_syntax_features(self) -> SyntaxFeatures:
        """Return empty syntax features for edge cases."""
        return SyntaxFeatures(
            mean_sentence_length=0.0,
            sentence_length_variance=0.0,
            sentence_length_distribution={},
            pos_distribution={},
            pronoun_frequency=0.0,
            imperative_frequency=0.0,
            question_frequency=0.0,
            repetition_patterns=[],
            parallel_structures=[],
            list_usage_frequency=0.0
        )

    def _categorize_sentence_lengths(self, lengths: List[int]) -> Dict[str, float]:
        """Categorize sentences by length."""
        if not lengths:
            return {"short": 0.0, "medium": 0.0, "long": 0.0}

        total = len(lengths)
        short = sum(1 for l in lengths if l <= 8)
        long = sum(1 for l in lengths if l >= 20)
        medium = total - short - long

        return {
            "short": short / total,
            "medium": medium / total,
            "long": long / total
        }

    def _calculate_pos_distribution(self, doc: spacy.tokens.Doc) -> Dict[str, float]:
        """Calculate POS tag distribution."""
        pos_counts = Counter(token.pos_ for token in doc if not token.is_space)
        total = sum(pos_counts.values())

        if total == 0:
            return {}

        return {pos: count / total for pos, count in pos_counts.items()}

    def _calculate_pronoun_frequency(self, doc: spacy.tokens.Doc) -> float:
        """Calculate pronoun frequency."""
        total_tokens = len([token for token in doc if not token.is_space])
        if total_tokens == 0:
            return 0.0

        pronoun_count = sum(1 for token in doc if token.pos_ == "PRON")
        return pronoun_count / total_tokens

    def _calculate_imperative_frequency(self, sentences: List[str]) -> float:
        """Calculate imperative sentence frequency."""
        if not sentences:
            return 0.0

        imperative_count = 0
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # Simple heuristic for imperatives
            doc = self.nlp(sentence)
            if len(doc) > 0:
                first_token = doc[0]
                # Check if starts with verb in base form
                if (first_token.pos_ == "VERB" and
                    first_token.tag_ in ["VB", "VBP"] and
                    not sentence.endswith("?")):
                    imperative_count += 1

        return imperative_count / len(sentences)

    def _calculate_question_frequency(self, sentences: List[str]) -> float:
        """Calculate question frequency."""
        if not sentences:
            return 0.0

        question_count = sum(1 for sent in sentences if sent.strip().endswith("?"))
        return question_count / len(sentences)

    def _find_repetition_patterns(self, sentences: List[str]) -> List[str]:
        """Find repeated syntactic patterns."""
        patterns = []

        # Look for repeated sentence beginnings
        beginnings = Counter()
        for sentence in sentences:
            words = sentence.strip().split()
            if len(words) >= 2:
                beginning = " ".join(words[:2]).lower()
                beginnings[beginning] += 1

        # Find patterns that repeat significantly
        total_sentences = len(sentences)
        for pattern, count in beginnings.items():
            if count >= 3 and count / total_sentences > 0.05:  # At least 5% of sentences
                patterns.append(f"Begins with '{pattern}' ({count} times)")

        return patterns[:5]  # Return top 5

    def _find_parallel_structures(self, sentences: List[str]) -> List[str]:
        """Find parallel syntactic structures."""
        structures = []

        # Look for repeated structural patterns
        for sentence in sentences:
            # Simple pattern: lists with "and"
            if sentence.count(",") >= 2 and " and " in sentence:
                structures.append("List structures with 'and'")
                break

        # Look for repeated question patterns
        questions = [s for s in sentences if s.strip().endswith("?")]
        if len(questions) >= 3:
            structures.append("Frequent use of questions")

        return list(set(structures))  # Remove duplicates

    def _calculate_list_usage_frequency(self, sentences: List[str]) -> float:
        """Calculate frequency of list-like structures."""
        if not sentences:
            return 0.0

        list_count = 0
        for sentence in sentences:
            # Count sentences with multiple commas (potential lists)
            if sentence.count(",") >= 2:
                list_count += 1
            # Count sentences with enumeration patterns
            elif any(pattern in sentence.lower() for pattern in
                    ["first", "second", "third", "finally", "also", "additionally"]):
                list_count += 1

        return list_count / len(sentences)


class RepetitionAnalyzer:
    """Analyzes repetition and emphasis patterns."""

    def __init__(self, config: AnalysisConfig, nlp: spacy.Language):
        self.config = config
        self.nlp = nlp

    def extract_features(self, segments: List[ProcessedSegment]) -> RepetitionFeatures:
        """Extract repetition features."""
        if not segments:
            return self._empty_repetition_features()

        all_sentences = []
        for seg in segments:
            all_sentences.extend(seg.sentences)

        # Analyze different types of repetition
        word_rep_rate = self._calculate_word_repetition_rate(all_sentences)
        phrase_rep_rate = self._calculate_phrase_repetition_rate(all_sentences)
        cross_sentence_rep = self._calculate_cross_sentence_repetition(all_sentences)

        emphasis_patterns = self._find_emphasis_patterns(all_sentences)
        recurring_phrases = self._find_recurring_phrases(all_sentences)
        signature_expressions = self._find_signature_expressions(recurring_phrases)

        return RepetitionFeatures(
            word_repetition_rate=word_rep_rate,
            phrase_repetition_rate=phrase_rep_rate,
            cross_sentence_repetition=cross_sentence_rep,
            emphasis_patterns=emphasis_patterns,
            recurring_phrases=recurring_phrases,
            signature_expressions=signature_expressions
        )

    def _empty_repetition_features(self) -> RepetitionFeatures:
        """Return empty repetition features."""
        return RepetitionFeatures(
            word_repetition_rate=0.0,
            phrase_repetition_rate=0.0,
            cross_sentence_repetition=0.0,
            emphasis_patterns=[],
            recurring_phrases={},
            signature_expressions=[]
        )

    def _calculate_word_repetition_rate(self, sentences: List[str]) -> float:
        """Calculate intra-sentence word repetition rate."""
        if not sentences:
            return 0.0

        repetition_count = 0
        total_sentences = 0

        for sentence in sentences:
            words = sentence.lower().split()
            if len(words) < 3:  # Skip very short sentences
                continue

            total_sentences += 1
            word_counts = Counter(words)

            # Count words that appear more than once
            repeated_words = sum(count - 1 for count in word_counts.values() if count > 1)
            if repeated_words > 0:
                repetition_count += 1

        return repetition_count / total_sentences if total_sentences > 0 else 0.0

    def _calculate_phrase_repetition_rate(self, sentences: List[str]) -> float:
        """Calculate phrase repetition within sentences."""
        if not sentences:
            return 0.0

        repetition_count = 0
        total_sentences = len(sentences)

        for sentence in sentences:
            # Look for repeated 2-3 word phrases
            words = sentence.lower().split()
            if len(words) < 4:
                continue

            phrases = []
            for i in range(len(words) - 1):
                if i < len(words) - 1:
                    phrases.append(f"{words[i]} {words[i+1]}")
                if i < len(words) - 2:
                    phrases.append(f"{words[i]} {words[i+1]} {words[i+2]}")

            phrase_counts = Counter(phrases)
            if any(count > 1 for count in phrase_counts.values()):
                repetition_count += 1

        return repetition_count / total_sentences

    def _calculate_cross_sentence_repetition(self, sentences: List[str]) -> float:
        """Calculate repetition across sentences."""
        if len(sentences) < 2:
            return 0.0

        # Extract all 2-3 word phrases
        all_phrases = []
        for sentence in sentences:
            words = sentence.lower().split()
            for i in range(len(words) - 1):
                if i < len(words) - 1:
                    all_phrases.append(f"{words[i]} {words[i+1]}")

        phrase_counts = Counter(all_phrases)
        repeated_phrases = sum(1 for count in phrase_counts.values() if count > 1)

        return repeated_phrases / len(all_phrases) if all_phrases else 0.0

    def _find_emphasis_patterns(self, sentences: List[str]) -> List[str]:
        """Find patterns that indicate emphasis."""
        patterns = []

        # Look for repeated words for emphasis
        emphasis_indicators = []
        for sentence in sentences:
            if any(word in sentence.lower() for word in
                  ["really", "very", "super", "extremely", "absolutely"]):
                emphasis_indicators.append("Intensifier usage")

            # Look for capitalization patterns (if available)
            if re.search(r'\b[A-Z]{2,}\b', sentence):
                emphasis_indicators.append("All caps for emphasis")

        # Count frequency of emphasis patterns
        pattern_counts = Counter(emphasis_indicators)
        for pattern, count in pattern_counts.items():
            if count >= 3:  # Appears multiple times
                patterns.append(f"{pattern} ({count} times)")

        return patterns[:5]

    def _find_recurring_phrases(self, sentences: List[str]) -> Dict[str, int]:
        """Find phrases that recur across the content."""
        phrase_counts = defaultdict(int)

        # Extract 2-5 word phrases
        for sentence in sentences:
            words = sentence.lower().split()
            for n in range(2, 6):  # 2 to 5 word phrases
                for i in range(len(words) - n + 1):
                    phrase = " ".join(words[i:i+n])
                    # Filter out common patterns
                    if not self._is_common_phrase(phrase):
                        phrase_counts[phrase] += 1

        # Return phrases that appear multiple times
        return {phrase: count for phrase, count in phrase_counts.items()
                if count >= 3}

    def _is_common_phrase(self, phrase: str) -> bool:
        """Check if phrase is too common to be signature."""
        common_patterns = {
            "in the", "of the", "to the", "and the", "is a", "are a",
            "this is", "that is", "you can", "we can", "i think",
            "you know", "i mean", "so that", "and then"
        }
        return phrase in common_patterns or len(phrase.split()) < 2

    def _find_signature_expressions(self, recurring_phrases: Dict[str, int]) -> List[str]:
        """Identify signature expressions from recurring phrases."""
        # Sort by frequency and uniqueness
        sorted_phrases = sorted(recurring_phrases.items(),
                              key=lambda x: x[1], reverse=True)

        signature_phrases = []
        for phrase, count in sorted_phrases[:10]:  # Top 10
            if count >= 3 and len(phrase.split()) >= 2:
                signature_phrases.append(phrase)

        return signature_phrases


class ProsodyAnalyzer:
    """Analyzes prosodic patterns from timing data."""

    def __init__(self, config: AnalysisConfig):
        self.config = config

    def extract_features(self, segments: List[ProcessedSegment]) -> ProsodyFeatures:
        """Extract prosodic features from timing data."""
        if not segments:
            return self._empty_prosody_features()

        # Calculate speaking rate metrics
        wpm_values = [seg.words_per_minute for seg in segments if seg.words_per_minute > 0]
        mean_wpm = np.mean(wpm_values) if wpm_values else 0
        wpm_variance = np.var(wpm_values) if wpm_values else 0
        wpm_dist = self._categorize_speaking_rate(wpm_values)

        # Calculate pause metrics
        pauses = [seg.pause_after for seg in segments if seg.pause_after > 0]
        pause_freq = len(pauses) / len(segments) if segments else 0
        mean_pause = np.mean(pauses) if pauses else 0
        pause_dist = self._categorize_pauses(pauses)

        # Calculate rhythm and flow metrics
        continuity_score = self._calculate_speech_continuity(segments)
        rhythm_regularity = self._calculate_rhythm_regularity(segments)

        return ProsodyFeatures(
            mean_words_per_minute=mean_wpm,
            wpm_variance=wpm_variance,
            speaking_rate_distribution=wpm_dist,
            pause_frequency=pause_freq,
            mean_pause_duration=mean_pause,
            pause_distribution=pause_dist,
            speech_continuity_score=continuity_score,
            rhythm_regularity=rhythm_regularity
        )

    def _empty_prosody_features(self) -> ProsodyFeatures:
        """Return empty prosody features."""
        return ProsodyFeatures(
            mean_words_per_minute=0.0,
            wpm_variance=0.0,
            speaking_rate_distribution={},
            pause_frequency=0.0,
            mean_pause_duration=0.0,
            pause_distribution={},
            speech_continuity_score=0.0,
            rhythm_regularity=0.0
        )

    def _categorize_speaking_rate(self, wpm_values: List[float]) -> Dict[str, float]:
        """Categorize speaking rate into slow/normal/fast."""
        if not wpm_values:
            return {"slow": 0.0, "normal": 0.0, "fast": 0.0}

        total = len(wpm_values)
        slow = sum(1 for wpm in wpm_values if wpm < 120)
        fast = sum(1 for wpm in wpm_values if wpm > 180)
        normal = total - slow - fast

        return {
            "slow": slow / total,
            "normal": normal / total,
            "fast": fast / total
        }

    def _categorize_pauses(self, pauses: List[float]) -> Dict[str, float]:
        """Categorize pauses by duration."""
        if not pauses:
            return {"short": 0.0, "medium": 0.0, "long": 0.0}

        total = len(pauses)
        short = sum(1 for p in pauses if p < 1.0)
        long = sum(1 for p in pauses if p > 3.0)
        medium = total - short - long

        return {
            "short": short / total,
            "medium": medium / total,
            "long": long / total
        }

    def _calculate_speech_continuity(self, segments: List[ProcessedSegment]) -> float:
        """Calculate how continuous the speech is."""
        if len(segments) < 2:
            return 1.0

        # Calculate ratio of speaking time to total time
        total_speech_time = sum(seg.original.duration for seg in segments)
        total_time = (segments[-1].original.end_time -
                     segments[0].original.start_time)

        return total_speech_time / total_time if total_time > 0 else 0.0

    def _calculate_rhythm_regularity(self, segments: List[ProcessedSegment]) -> float:
        """Calculate regularity of speech rhythm."""
        if len(segments) < 3:
            return 0.0

        # Use coefficient of variation of segment durations as rhythm metric
        durations = [seg.original.duration for seg in segments]
        mean_duration = np.mean(durations)
        std_duration = np.std(durations)

        if mean_duration == 0:
            return 0.0

        # Lower coefficient of variation = more regular rhythm
        cv = std_duration / mean_duration
        return max(0.0, 1.0 - cv)  # Convert to regularity score


class PersonaAnalyzer:
    """Analyzes persona and communication style features."""

    def __init__(self, config: AnalysisConfig, nlp: spacy.Language):
        self.config = config
        self.nlp = nlp

    def extract_features(self, text: str,
                        segments: List[ProcessedSegment]) -> PersonaFeatures:
        """Extract persona features."""
        if not text.strip():
            return self._empty_persona_features()

        doc = self.nlp(text)

        # Analyze POV usage
        pov_dist = self._calculate_pov_distribution(doc)
        direct_address = self._calculate_direct_address_frequency(doc)
        inclusive_language = self._calculate_inclusive_language_rate(doc)

        # Analyze sentiment and emotion
        sentiment_dist = self._calculate_sentiment_distribution(text)
        emotional_intensity = self._calculate_emotional_intensity(doc)
        enthusiasm_markers = self._find_enthusiasm_markers(text)

        # Analyze engagement patterns
        question_to_audience = self._calculate_question_to_audience_rate(segments)
        cta_frequency = self._calculate_cta_frequency(text)
        anecdote_rate = self._calculate_personal_anecdote_rate(segments)

        return PersonaFeatures(
            pov_distribution=pov_dist,
            direct_address_frequency=direct_address,
            inclusive_language_rate=inclusive_language,
            sentiment_distribution=sentiment_dist,
            emotional_intensity=emotional_intensity,
            enthusiasm_markers=enthusiasm_markers,
            question_to_audience=question_to_audience,
            call_to_action_frequency=cta_frequency,
            personal_anecdote_rate=anecdote_rate
        )

    def _empty_persona_features(self) -> PersonaFeatures:
        """Return empty persona features."""
        return PersonaFeatures(
            pov_distribution={},
            direct_address_frequency=0.0,
            inclusive_language_rate=0.0,
            sentiment_distribution={},
            emotional_intensity=0.0,
            enthusiasm_markers=[],
            question_to_audience=0.0,
            call_to_action_frequency=0.0,
            personal_anecdote_rate=0.0
        )

    def _calculate_pov_distribution(self, doc: spacy.tokens.Doc) -> Dict[str, float]:
        """Calculate point of view distribution."""
        pov_counts = {"I": 0, "you": 0, "we": 0, "they": 0}
        total_pronouns = 0

        for token in doc:
            if token.pos_ == "PRON":
                total_pronouns += 1
                lemma = token.lemma_.lower()
                if lemma in ["i", "me", "my", "mine", "myself"]:
                    pov_counts["I"] += 1
                elif lemma in ["you", "your", "yours", "yourself"]:
                    pov_counts["you"] += 1
                elif lemma in ["we", "us", "our", "ours", "ourselves"]:
                    pov_counts["we"] += 1
                elif lemma in ["they", "them", "their", "theirs", "themselves"]:
                    pov_counts["they"] += 1

        if total_pronouns == 0:
            return pov_counts

        return {pov: count / total_pronouns for pov, count in pov_counts.items()}

    def _calculate_direct_address_frequency(self, doc: spacy.tokens.Doc) -> float:
        """Calculate frequency of direct address to audience."""
        total_tokens = len([token for token in doc if not token.is_space])
        if total_tokens == 0:
            return 0.0

        direct_address_count = 0
        for token in doc:
            if token.lemma_.lower() == "you":
                direct_address_count += 1

        return direct_address_count / total_tokens

    def _calculate_inclusive_language_rate(self, doc: spacy.tokens.Doc) -> float:
        """Calculate rate of inclusive language usage."""
        total_tokens = len([token for token in doc if not token.is_space])
        if total_tokens == 0:
            return 0.0

        inclusive_count = 0
        for token in doc:
            if token.lemma_.lower() in ["we", "us", "our", "together", "collectively"]:
                inclusive_count += 1

        return inclusive_count / total_tokens

    def _calculate_sentiment_distribution(self, text: str) -> Dict[str, float]:
        """Calculate sentiment distribution using basic heuristics."""
        # Simple sentiment analysis using word lists
        positive_words = {
            'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic',
            'wonderful', 'perfect', 'love', 'like', 'enjoy', 'happy', 'excited'
        }

        negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike',
            'sad', 'angry', 'frustrated', 'annoying', 'wrong', 'problem'
        }

        words = text.lower().split()
        positive_count = sum(1 for word in words if word in positive_words)
        negative_count = sum(1 for word in words if word in negative_words)
        neutral_count = len(words) - positive_count - negative_count

        total = len(words)
        if total == 0:
            return {"positive": 0.0, "negative": 0.0, "neutral": 1.0}

        return {
            "positive": positive_count / total,
            "negative": negative_count / total,
            "neutral": neutral_count / total
        }

    def _calculate_emotional_intensity(self, doc: spacy.tokens.Doc) -> float:
        """Calculate emotional intensity based on various markers."""
        intensity_markers = {
            'really', 'very', 'extremely', 'incredibly', 'absolutely',
            'totally', 'completely', 'utterly', 'so', 'such'
        }

        total_tokens = len([token for token in doc if not token.is_space])
        if total_tokens == 0:
            return 0.0

        intensity_count = sum(1 for token in doc
                            if token.lemma_.lower() in intensity_markers)

        return intensity_count / total_tokens

    def _find_enthusiasm_markers(self, text: str) -> List[str]:
        """Find markers of enthusiasm in the text."""
        markers = []

        # Exclamation points
        exclamation_count = text.count('!')
        if exclamation_count > 0:
            markers.append(f"Exclamation points ({exclamation_count})")

        # Enthusiasm words
        enthusiasm_words = ['excited', 'thrilled', 'pumped', 'stoked', 'psyched']
        found_words = [word for word in enthusiasm_words
                      if word in text.lower()]
        if found_words:
            markers.append(f"Enthusiasm words: {', '.join(found_words)}")

        # Capitalization for emphasis
        caps_matches = re.findall(r'\b[A-Z]{2,}\b', text)
        if caps_matches:
            markers.append(f"Caps for emphasis: {len(caps_matches)} instances")

        return markers

    def _calculate_question_to_audience_rate(self,
                                           segments: List[ProcessedSegment]) -> float:
        """Calculate rate of questions directed to audience."""
        total_sentences = sum(len(seg.sentences) for seg in segments)
        if total_sentences == 0:
            return 0.0

        question_count = 0
        for segment in segments:
            for sentence in segment.sentences:
                if sentence.strip().endswith('?'):
                    question_count += 1

        return question_count / total_sentences

    def _calculate_cta_frequency(self, text: str) -> float:
        """Calculate call-to-action frequency."""
        cta_phrases = [
            'subscribe', 'like this video', 'hit that like button', 'comment below',
            'let me know', 'tell me', 'check out', 'go to', 'visit', 'click',
            'download', 'try this', 'give it a try', 'follow me'
        ]

        total_words = len(text.split())
        if total_words == 0:
            return 0.0

        cta_count = sum(text.lower().count(phrase) for phrase in cta_phrases)
        return cta_count / total_words

    def _calculate_personal_anecdote_rate(self,
                                        segments: List[ProcessedSegment]) -> float:
        """Calculate rate of personal anecdotes."""
        anecdote_indicators = [
            'i remember', 'when i was', 'i used to', 'my experience',
            'i found that', 'i discovered', 'i learned', 'personally',
            'for me', 'in my case'
        ]

        total_segments = len(segments)
        if total_segments == 0:
            return 0.0

        anecdote_count = 0
        for segment in segments:
            text = segment.cleaned_text.lower()
            if any(indicator in text for indicator in anecdote_indicators):
                anecdote_count += 1

        return anecdote_count / total_segments