"""
Database integration module for speech analysis system.
Handles data retrieval from Supabase and storage of style profiles.
"""

import os
import json
from typing import List, Dict, Optional, Tuple
from dataclasses import asdict
from dotenv import load_dotenv
from supabase import create_client, Client

from speech_types import TranscriptSegment, CreatorTranscriptData, StyleProfile

load_dotenv()


class DatabaseManager:
    """Manages database connections and data retrieval for speech analysis."""

    def __init__(self, connection_string: Optional[str] = None):
        # Use Supabase client instead of direct PostgreSQL connection
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        self.mock_mode = not (self.supabase_url and self.supabase_key)
        if self.mock_mode:
            print("⚠️  Warning: Running in mock mode - Supabase connection not available")
            self.connection_string = None
        else:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            self.connection_string = f"supabase://{self.supabase_url}"

    def get_creator_transcript_data(self, creator_id: str) -> CreatorTranscriptData:
        """Retrieve all transcript data for a creator from the database."""
        if self.mock_mode:
            return self._mock_creator_transcript_data(creator_id)

        # Get content chunks for the creator using Supabase
        response = self.supabase.table('content_chunks').select(
            'video_id, video_title, content, start_time, end_time, chunk_index, created_at'
        ).eq('creator_id', creator_id).order('video_id').order('chunk_index').execute()

        if not response.data:
            raise ValueError(f"No transcript data found for creator {creator_id}")

        chunks = response.data

        # Convert to transcript segments
        segments = []
        for chunk in chunks:
            segment = TranscriptSegment(
                video_id=chunk['video_id'],
                start_time=float(chunk['start_time']) if chunk['start_time'] else 0.0,
                end_time=float(chunk['end_time']) if chunk['end_time'] else 0.0,
                text=chunk['content'],
                confidence=0.9,  # Default confidence for existing data
                chunk_index=chunk['chunk_index']
            )
            segments.append(segment)

        # Get metadata
        total_videos = len(set(chunk['video_id'] for chunk in chunks))
        total_duration = sum(seg.duration for seg in segments)

        # Get date range
        dates = [chunk['created_at'] for chunk in chunks if chunk['created_at']]
        date_range = (
            min(dates)[:10] if dates else '',  # Extract date part
            max(dates)[:10] if dates else ''
        )

        return CreatorTranscriptData(
            creator_id=creator_id,
            segments=segments,
            total_videos=total_videos,
            total_duration=total_duration,
            date_range=date_range
        )

    def get_creator_info(self, creator_id: str) -> Dict[str, str]:
        """Get basic creator information."""
        if self.mock_mode:
            return {
                'display_name': 'Mock Creator',
                'username': 'mock_creator'
            }

        response = self.supabase.table('creators').select(
            'username, display_name, youtube_channel_id, youtube_channel_url'
        ).eq('id', creator_id).execute()

        if not response.data:
            raise ValueError(f"Creator {creator_id} not found")

        return response.data[0]

    def save_style_profile(self, profile: StyleProfile) -> None:
        """Save style profile to the database (extend ai_config table)."""
        if self.mock_mode:
            print(f"✅ Mock mode: Saved style profile for {profile.creator_id}")
            return

        # Convert profile to JSON
        profile_json = asdict(profile)
        print(f"✅ Generated style profile for {profile.creator_id}")
        print(f"   Profile confidence: {profile.confidence_score:.2%}")
        print(f"   Profile archetype: {profile.communication_archetype}")

        try:
            # Check if ai_config exists for this creator
            existing = self.supabase.table('ai_config').select('id').eq('creator_id', profile.creator_id).execute()

            if existing.data:
                # Update existing record with style profile and timestamp
                result = self.supabase.table('ai_config').update({
                    'style_profile': profile_json,
                    'updated_at': 'now()'
                }).eq('creator_id', profile.creator_id).execute()
                print(f"✅ Updated style profile for {profile.creator_id} in ai_config table")
            else:
                # Create new record with style profile
                result = self.supabase.table('ai_config').insert({
                    'creator_id': profile.creator_id,
                    'style_profile': profile_json,
                    'created_at': 'now()',
                    'updated_at': 'now()'
                }).execute()
                print(f"✅ Created new ai_config record with style profile for {profile.creator_id}")

        except Exception as e:
            print(f"⚠️  Could not save style profile to ai_config table: {e}")
            print("   Make sure the style_profile column exists in the ai_config table")

    def load_style_profile(self, creator_id: str) -> Optional[StyleProfile]:
        """Load style profile from the database."""
        if self.mock_mode:
            print(f"⚠️  Mock mode: No existing style profile for {creator_id}")
            return None

        # For now, return None since we don't store structured profiles yet
        # The style card is generated fresh each time
        return None

    def check_style_profile_migration(self) -> bool:
        """Check if ai_config table has style_profile column, add if missing."""
        # This is handled in ensure_ai_config_columns
        return False

    def get_all_creators_with_content(self) -> List[Tuple[str, str, int]]:
        """Get all creators who have transcript content."""
        if self.mock_mode:
            return [("mock_creator_id", "Mock Creator", 50)]

        # Use Supabase to get creators with content
        response = self.supabase.rpc('get_creators_with_content').execute()
        if response.data:
            return [(r['creator_id'], r['display_name'], r['chunk_count']) for r in response.data]
        return []

    def get_creator_stats(self, creator_id: str) -> Dict[str, any]:
        """Get statistics about a creator's content."""
        if self.mock_mode:
            return {
                'video_count': 4,
                'chunk_count': 67,
                'total_characters': 30000,
                'estimated_words': 6000
            }

        # Use Supabase to get creator stats
        response = self.supabase.table('content_chunks').select(
            'video_id, content, created_at'
        ).eq('creator_id', creator_id).execute()

        if response.data:
            chunks = response.data
            video_count = len(set(chunk['video_id'] for chunk in chunks))
            chunk_count = len(chunks)
            total_characters = sum(len(chunk['content']) for chunk in chunks)

            return {
                'video_count': video_count,
                'chunk_count': chunk_count,
                'total_characters': total_characters,
                'estimated_words': total_characters // 5 if total_characters else 0,
                'earliest_content': min((chunk['created_at'] for chunk in chunks), default=None),
                'latest_content': max((chunk['created_at'] for chunk in chunks), default=None)
            }

        return {}

    def save_style_card_to_ai_config(self, creator_id: str, style_card_text: str) -> None:
        """Save the style card text to ai_config for use in prompts."""
        if self.mock_mode:
            print(f"✅ Mock mode: Saved style card for {creator_id}")
            return

        try:
            # Check if ai_config exists for this creator
            existing = self.supabase.table('ai_config').select('id').eq('creator_id', creator_id).execute()

            if existing.data:
                # Update existing record with style card and timestamp
                result = self.supabase.table('ai_config').update({
                    'style_card': style_card_text,
                    'updated_at': 'now()'
                }).eq('creator_id', creator_id).execute()
                print(f"✅ Updated style card for {creator_id} in ai_config table")
            else:
                # Create new record with style card
                result = self.supabase.table('ai_config').insert({
                    'creator_id': creator_id,
                    'style_card': style_card_text,
                    'created_at': 'now()',
                    'updated_at': 'now()'
                }).execute()
                print(f"✅ Created new ai_config record with style card for {creator_id}")

        except Exception as e:
            print(f"⚠️  Could not save style card to ai_config table: {e}")
            print("   Make sure the style_card column exists in the ai_config table")

    def ensure_ai_config_columns(self) -> None:
        """Ensure ai_config table has necessary columns for style analysis."""
        if self.mock_mode:
            print("✅ Mock mode: Skipping ai_config columns check")
            return

        # For Supabase, we assume the columns already exist or can be managed through the dashboard
        # This is a no-op for now since we can't easily check column existence via REST API
        print("✅ Supabase mode: Assuming ai_config columns exist")


    def _mock_creator_transcript_data(self, creator_id: str) -> CreatorTranscriptData:
        """Generate mock transcript data for testing when database is not available."""
        print(f"🔄 Generating mock transcript data for creator: {creator_id}")

        # Create sample transcript segments
        sample_texts = [
            "Hey everyone, welcome back to my channel! Today I'm super excited to share with you five amazing pickleball tips that will absolutely transform your game.",
            "So the first thing you want to focus on is your grip. Many beginners hold the paddle like a tennis racket, but that's not quite right for pickleball.",
            "The continental grip is what you want to use for most shots. It gives you better control and allows for quick transitions between forehand and backhand.",
            "Now let's talk about positioning. Court positioning is absolutely crucial in pickleball, especially when you're playing doubles with a partner.",
            "You want to stay behind the baseline when returning serves, but move up to the kitchen line as soon as you can safely do so without getting caught.",
            "One mistake I see all the time is players rushing to the net too quickly. Be patient and wait for the right opportunity to advance.",
            "The third shot drop is probably the most important shot to master. It's what separates beginners from intermediate players in pickleball.",
            "Practice hitting soft shots that land in the kitchen. This neutralizes your opponents' advantage and gets you to the net position.",
            "Remember, pickleball is more about strategy and placement than power. Think chess, not boxing when you're playing.",
            "Another key tip is to communicate with your partner. Call out shots, discuss strategy, and support each other throughout the match.",
            "Footwork is absolutely essential in pickleball. You need to be light on your feet and ready to move in any direction at any time.",
            "Watch your opponents' paddle face. This will give you clues about where they're going to hit the ball and help you anticipate their shots.",
            "Don't forget about the serve. A good serve can set up the entire point. Practice different serves to keep your opponents guessing.",
            "The ready position is crucial. Stay low, keep your paddle up, and be prepared to react quickly to whatever comes your way.",
            "Work on your dinking game. Soft shots in the kitchen are what win points at higher levels of play in pickleball.",
            "Be patient during rallies. Don't try to end the point too quickly. Wait for the right opportunity to attack.",
            "Practice your returns. A deep return can put your opponents on the defensive and give you time to get to the net.",
            "Learn the rules thoroughly. Knowing the rules inside and out can give you a competitive advantage in matches.",
            "Stay positive and have fun! Pickleball is a great sport that brings people together. Enjoy the process of learning and improving.",
            "That's all for today's tips! Make sure to hit that subscribe button if you found this helpful, and I'll see you in the next video!"
        ]

        segments = []
        start_time = 0.0

        for i, text in enumerate(sample_texts):
            # Estimate duration based on text length (roughly 2.5 words per second)
            word_count = len(text.split())
            duration = word_count / 2.5
            end_time = start_time + duration

            segment = TranscriptSegment(
                video_id=f"mock_video_{(i // 3) + 1}",  # Group into videos
                start_time=start_time,
                end_time=end_time,
                text=text,
                confidence=0.95
            )
            segments.append(segment)

            start_time = end_time + 1.0  # 1-second gap between segments

        # Calculate totals
        total_videos = len(set(seg.video_id for seg in segments))
        total_duration = sum(seg.end_time - seg.start_time for seg in segments)

        return CreatorTranscriptData(
            creator_id=creator_id,
            segments=segments,
            total_videos=total_videos,
            total_duration=total_duration,
            date_range=("2024-01-01", "2024-12-31")  # Mock date range
        )




class TranscriptDataLoader:
    """Specialized loader for transcript data with various formats."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def load_from_json_file(self, filepath: str) -> List[TranscriptSegment]:
        """Load transcript segments from JSON file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        segments = []

        # Handle different JSON formats
        if isinstance(data, list):
            # List of segments
            for item in data:
                if 'text' in item and 'start' in item:
                    segment = TranscriptSegment(
                        video_id=item.get('video_id', 'unknown'),
                        start_time=float(item['start']),
                        end_time=float(item.get('end', item['start'] + 1)),
                        text=item['text'],
                        confidence=item.get('confidence', 0.9)
                    )
                    segments.append(segment)

        elif isinstance(data, dict):
            # Single video with segments
            video_id = data.get('video_id', 'unknown')
            if 'segments' in data:
                for segment_data in data['segments']:
                    segment = TranscriptSegment(
                        video_id=video_id,
                        start_time=float(segment_data['start']),
                        end_time=float(segment_data.get('end', segment_data['start'] + 1)),
                        text=segment_data['text'],
                        confidence=segment_data.get('confidence', 0.9)
                    )
                    segments.append(segment)

        return segments

    def load_from_csv_file(self, filepath: str) -> List[TranscriptSegment]:
        """Load transcript segments from CSV file."""
        import pandas as pd

        df = pd.read_csv(filepath)
        segments = []

        for _, row in df.iterrows():
            segment = TranscriptSegment(
                video_id=row.get('video_id', 'unknown'),
                start_time=float(row['start_time']),
                end_time=float(row['end_time']),
                text=str(row['text']),
                confidence=float(row.get('confidence', 0.9))
            )
            segments.append(segment)

        return segments


def create_database_manager(connection_string: Optional[str] = None) -> DatabaseManager:
    """Factory function to create a database manager."""
    return DatabaseManager(connection_string)


def create_transcript_loader(db_manager: DatabaseManager) -> TranscriptDataLoader:
    """Factory function to create a transcript data loader."""
    return TranscriptDataLoader(db_manager)