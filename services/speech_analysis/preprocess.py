"""
Preprocessing module for transcript cleaning and timing alignment.
Handles text normalization, punctuation restoration, and segment preparation.
"""

import re
import string
import warnings
from typing import List, Dict, Optional, Tuple
import pandas as pd
import spacy
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification

from speech_types import TranscriptSegment, ProcessedSegment, AnalysisConfig

warnings.filterwarnings("ignore")


class TranscriptPreprocessor:
    """Handles cleaning and preprocessing of transcript data."""

    def __init__(self, config: AnalysisConfig):
        self.config = config
        self.nlp = self._load_spacy_model()
        self.punctuation_model = self._load_punctuation_model()

        # Common filler words and discourse markers
        self.filler_words = {
            'um', 'uh', 'ah', 'er', 'like', 'you know', 'so', 'well',
            'actually', 'basically', 'literally', 'right', 'okay', 'alright',
            'I mean', 'kind of', 'sort of', 'you see', 'I guess'
        }

        # Common transcript artifacts to clean
        self.transcript_artifacts = {
            '[Music]', '[Applause]', '[Laughter]', '[inaudible]',
            '[Background music]', '[MUSIC]', '[music]', '(Music)',
            '[APPLAUSE]', '[applause]', '(applause)', '(Applause)',
            '[laugh]', '[laughs]', '(laugh)', '(laughs)', '[Laugh]'
        }

    def _load_spacy_model(self) -> spacy.Language:
        """Load spaCy model for text processing."""
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError(
                "spaCy English model not found. Install with: "
                "python -m spacy download en_core_web_sm"
            )

    def _load_punctuation_model(self) -> Optional[pipeline]:
        """Load punctuation restoration model."""
        if not self.config.enable_punctuation_restoration:
            return None

        try:
            # Use a lightweight punctuation restoration model
            model_name = "oliverguhr/fullstop-punctuation-multilang-large"
            return pipeline(
                "token-classification",
                model=model_name,
                tokenizer=model_name,
                device=-1  # CPU only
            )
        except Exception as e:
            print(f"Warning: Could not load punctuation model: {e}")
            return None

    def clean_text(self, text: str) -> str:
        """Clean transcript text from artifacts and normalize."""
        # Remove transcript artifacts
        cleaned = text
        for artifact in self.transcript_artifacts:
            cleaned = cleaned.replace(artifact, ' ')

        # Normalize whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        # Remove excessive punctuation
        cleaned = re.sub(r'[.]{3,}', '...', cleaned)
        cleaned = re.sub(r'[!]{2,}', '!', cleaned)
        cleaned = re.sub(r'[?]{2,}', '?', cleaned)

        # Handle common YouTube auto-caption errors
        cleaned = self._fix_common_caption_errors(cleaned)

        return cleaned

    def _fix_common_caption_errors(self, text: str) -> str:
        """Fix common YouTube auto-caption transcription errors."""
        # Common misheard words
        fixes = {
            r'\buh\b': 'a',
            r'\bum\b': '',
            r'\byeah\b': 'yes',
            r'\bgonna\b': 'going to',
            r'\bwanna\b': 'want to',
            r'\bkinda\b': 'kind of',
            r'\bsorta\b': 'sort of',
        }

        result = text
        for pattern, replacement in fixes.items():
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        return result

    def restore_punctuation(self, text: str) -> str:
        """Restore punctuation using ML model if available."""
        if not self.punctuation_model or len(text.strip()) == 0:
            return text

        try:
            # Split into manageable chunks to avoid token limits
            chunks = self._split_text_for_processing(text, max_length=512)
            restored_chunks = []

            for chunk in chunks:
                if len(chunk.strip()) < 5:  # Skip very short chunks
                    restored_chunks.append(chunk)
                    continue

                # Apply punctuation restoration
                result = self.punctuation_model(chunk)
                if result:
                    # Reconstruct text with punctuation
                    restored = self._reconstruct_punctuated_text(chunk, result)
                    restored_chunks.append(restored)
                else:
                    restored_chunks.append(chunk)

            return ' '.join(restored_chunks)

        except Exception as e:
            print(f"Warning: Punctuation restoration failed: {e}")
            return text

    def _split_text_for_processing(self, text: str, max_length: int = 512) -> List[str]:
        """Split text into chunks suitable for model processing."""
        words = text.split()
        chunks = []
        current_chunk = []
        current_length = 0

        for word in words:
            word_length = len(word) + 1  # +1 for space
            if current_length + word_length > max_length and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [word]
                current_length = word_length
            else:
                current_chunk.append(word)
                current_length += word_length

        if current_chunk:
            chunks.append(' '.join(current_chunk))

        return chunks

    def _reconstruct_punctuated_text(self, original: str, predictions: List[Dict]) -> str:
        """Reconstruct text with punctuation from model predictions."""
        # This is a simplified implementation
        # In practice, you'd need to handle the token-level predictions more carefully
        words = original.split()
        result = []

        for i, word in enumerate(words):
            result.append(word)
            # Add basic sentence endings based on patterns
            if i < len(words) - 1:
                next_word = words[i + 1]
                if next_word and next_word[0].isupper():
                    if not word.endswith(('.', '!', '?')):
                        result[-1] += '.'

        return ' '.join(result)

    def segment_sentences(self, text: str) -> List[str]:
        """Segment text into sentences using spaCy."""
        doc = self.nlp(text)
        sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
        return sentences

    def calculate_timing_features(self, segment: TranscriptSegment,
                                next_segment: Optional[TranscriptSegment] = None,
                                prev_segment: Optional[TranscriptSegment] = None) -> Tuple[float, float, float]:
        """Calculate timing-based features for a segment."""
        # Words per minute calculation
        word_count = len(segment.text.split())
        duration_minutes = segment.duration / 60.0
        wpm = word_count / duration_minutes if duration_minutes > 0 else 0

        # Pause calculations
        pause_before = 0.0
        pause_after = 0.0

        if prev_segment:
            gap_before = segment.start_time - prev_segment.end_time
            if gap_before > 0:
                pause_before = gap_before

        if next_segment:
            gap_after = next_segment.start_time - segment.end_time
            if gap_after > 0:
                pause_after = gap_after

        return wpm, pause_before, pause_after

    def process_segment(self, segment: TranscriptSegment,
                       next_segment: Optional[TranscriptSegment] = None,
                       prev_segment: Optional[TranscriptSegment] = None) -> ProcessedSegment:
        """Process a single transcript segment."""
        # Clean and restore punctuation
        cleaned_text = self.clean_text(segment.text)

        if self.config.enable_punctuation_restoration:
            cleaned_text = self.restore_punctuation(cleaned_text)

        # Segment into sentences
        sentences = self.segment_sentences(cleaned_text)

        # Calculate timing features
        wpm, pause_before, pause_after = self.calculate_timing_features(
            segment, next_segment, prev_segment
        )

        # Word count
        word_count = len(cleaned_text.split())

        return ProcessedSegment(
            original=segment,
            cleaned_text=cleaned_text,
            sentences=sentences,
            word_count=word_count,
            words_per_minute=wpm,
            pause_before=pause_before,
            pause_after=pause_after
        )

    def process_transcript_data(self, segments: List[TranscriptSegment]) -> List[ProcessedSegment]:
        """Process all segments in a transcript."""
        if not segments:
            return []

        # Filter segments by confidence and duration
        filtered_segments = [
            seg for seg in segments
            if (seg.confidence is None or seg.confidence >= self.config.confidence_threshold)
            and seg.duration >= self.config.min_segment_duration
        ]

        if not filtered_segments:
            return []

        # Sort by start time to ensure proper ordering
        filtered_segments.sort(key=lambda x: x.start_time)

        # Process each segment with context
        processed_segments = []
        for i, segment in enumerate(filtered_segments):
            prev_seg = filtered_segments[i-1] if i > 0 else None
            next_seg = filtered_segments[i+1] if i < len(filtered_segments)-1 else None

            processed = self.process_segment(segment, next_seg, prev_seg)
            if processed.word_count > 0:  # Only include segments with content
                processed_segments.append(processed)

        return processed_segments

    def extract_transcript_metadata(self, segments: List[ProcessedSegment]) -> Dict[str, float]:
        """Extract overall metadata from processed segments."""
        if not segments:
            return {}

        total_words = sum(seg.word_count for seg in segments)
        total_duration = sum(seg.original.duration for seg in segments) / 60.0  # minutes

        # Calculate pause statistics
        pauses = [seg.pause_after for seg in segments if seg.pause_after > 0]

        metadata = {
            'total_segments': len(segments),
            'total_words': total_words,
            'total_duration_minutes': total_duration,
            'average_wpm': total_words / total_duration if total_duration > 0 else 0,
            'total_sentences': sum(len(seg.sentences) for seg in segments),
            'average_words_per_sentence': total_words / sum(len(seg.sentences) for seg in segments) if segments else 0,
            'pause_frequency': len(pauses) / len(segments) if segments else 0,
            'average_pause_duration': sum(pauses) / len(pauses) if pauses else 0,
        }

        return metadata


def create_preprocessor(config: Optional[AnalysisConfig] = None) -> TranscriptPreprocessor:
    """Factory function to create a preprocessor with default config."""
    if config is None:
        config = AnalysisConfig()
    return TranscriptPreprocessor(config)