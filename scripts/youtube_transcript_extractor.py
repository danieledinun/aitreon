#!/usr/bin/env python3
"""
YouTube Transcript Extractor using youtube-transcript-api v1.2.2
This script extracts transcripts from YouTube videos without using official API quotas.
"""

import json
import sys
from typing import List, Dict, Optional, Union
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig
from youtube_transcript_api._errors import (
    TranscriptsDisabled, 
    NoTranscriptFound, 
    VideoUnavailable,
    CouldNotRetrieveTranscript,
    RequestBlocked,
    IpBlocked
)
import yt_dlp

class YouTubeTranscriptExtractor:
    """Extract transcripts from YouTube videos using youtube-transcript-api"""
    
    @staticmethod
    def _create_api_instance():
        """Create YouTube Transcript API instance with proxy configuration"""
        try:
            # Configure Webshare residential rotating proxy
            proxy_config = WebshareProxyConfig(
                proxy_username="vvwbndwq-1",
                proxy_password="2w021mlwybfn"
            )
            
            print(f"🌐 Using residential rotating proxy for API requests", file=sys.stderr)
            return YouTubeTranscriptApi(proxy_config=proxy_config)
            
        except Exception as proxy_error:
            print(f"⚠️ Proxy configuration failed, using direct connection: {str(proxy_error)}", file=sys.stderr)
            # Fallback to direct connection if proxy fails
            return YouTubeTranscriptApi()
    
    @staticmethod
    def extract_transcript(
        video_id: str, 
        languages: List[str] = None,
        preserve_formatting: bool = False
    ) -> Dict[str, Union[str, List[Dict], bool]]:
        """
        Extract transcript for a single video
        
        Args:
            video_id: YouTube video ID
            languages: Preferred languages in order of preference (default: ['en'])
            preserve_formatting: Whether to preserve formatting (default: False)
            
        Returns:
            Dictionary with transcript data or error information
        """
        if languages is None:
            languages = ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA']
        
        try:
            print(f"🔍 Fetching transcript for video: {video_id}", file=sys.stderr)
            
            # Create API instance with proxy configuration
            api = YouTubeTranscriptExtractor._create_api_instance()
            
            # Get transcript - the new API handles language preference automatically
            try:
                # Try to get transcript in preferred languages
                transcript_data = api.fetch(video_id, languages=languages)
                language_used = transcript_data.language
                is_generated = transcript_data.is_generated
                
                print(f"✅ Found transcript in {language_used} ({'auto-generated' if is_generated else 'manual'})", file=sys.stderr)
                
            except Exception as e:
                print(f"❌ Error with preferred languages, trying any available: {str(e)}", file=sys.stderr)
                # Fall back to any available transcript
                transcript_data = api.fetch(video_id)
                language_used = transcript_data.language
                is_generated = transcript_data.is_generated
                
                print(f"✅ Found fallback transcript in {language_used} ({'auto-generated' if is_generated else 'manual'})", file=sys.stderr)
            
            # Process transcript segments
            segments = []
            for segment in transcript_data:
                segments.append({
                    'start': float(segment.start),
                    'duration': float(segment.duration),
                    'end': float(segment.start) + float(segment.duration),
                    'text': segment.text.strip() if not preserve_formatting else segment.text,
                    'confidence': 0.95 if not is_generated else 0.85
                })
            
            print(f"✅ Extracted {len(segments)} transcript segments", file=sys.stderr)
            
            return {
                'success': True,
                'video_id': video_id,
                'language': language_used,
                'is_generated': is_generated,
                'segments_count': len(segments),
                'segments': segments,
                'obtained_via': 'youtube_transcript_api',
                'confidence': 0.95 if not is_generated else 0.85,
                'processing_date': None  # Will be set by the calling service
            }
            
        except VideoUnavailable:
            return {
                'success': False,
                'error': 'video_unavailable',
                'message': 'Video is unavailable or private'
            }
        except TranscriptsDisabled:
            return {
                'success': False,
                'error': 'transcripts_disabled',
                'message': 'Transcripts are disabled for this video'
            }
        except NoTranscriptFound:
            return {
                'success': False,
                'error': 'no_transcript_found',
                'message': 'No transcript found for this video'
            }
        except (RequestBlocked, IpBlocked) as e:
            # Try with exponential backoff for rate limiting
            print(f"⚠️ Rate limited, trying with backoff delay...", file=sys.stderr)
            import time
            for retry_attempt in range(2):  # Try 2 more times
                backoff_delay = (retry_attempt + 1) * 5  # 5, 10 seconds
                print(f"⏳ Waiting {backoff_delay}s before retry {retry_attempt + 1}/2...", file=sys.stderr)
                time.sleep(backoff_delay)
                
                try:
                    # Retry the transcript fetch with proxy
                    api = YouTubeTranscriptExtractor._create_api_instance()
                    transcript_data = api.fetch(video_id, languages=languages)
                    language_used = transcript_data.language
                    is_generated = transcript_data.is_generated
                    
                    print(f"✅ Retry successful! Found transcript in {language_used} ({'auto-generated' if is_generated else 'manual'})", file=sys.stderr)
                    
                    # Process transcript segments
                    segments = []
                    for segment in transcript_data:
                        segments.append({
                            'start': float(segment.start),
                            'duration': float(segment.duration),
                            'end': float(segment.start) + float(segment.duration),
                            'text': segment.text.strip() if not preserve_formatting else segment.text,
                            'confidence': 0.95 if not is_generated else 0.85
                        })
                    
                    print(f"✅ Extracted {len(segments)} transcript segments on retry", file=sys.stderr)
                    
                    return {
                        'success': True,
                        'video_id': video_id,
                        'language': language_used,
                        'is_generated': is_generated,
                        'segments_count': len(segments),
                        'segments': segments,
                        'obtained_via': 'youtube_transcript_api_retry',
                        'confidence': 0.95 if not is_generated else 0.85,
                        'processing_date': None
                    }
                except (RequestBlocked, IpBlocked):
                    print(f"❌ Retry {retry_attempt + 1} still rate limited", file=sys.stderr)
                    continue
                except Exception as retry_error:
                    print(f"❌ Retry {retry_attempt + 1} failed with different error: {str(retry_error)}", file=sys.stderr)
                    break
            
            return {
                'success': False,
                'error': 'rate_limited',
                'message': 'Requests blocked after retries - please try again later'
            }
        except CouldNotRetrieveTranscript as e:
            return {
                'success': False,
                'error': 'retrieval_failed',
                'message': f'Could not retrieve transcript: {str(e)}'
            }
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': 'unexpected_error',
                'message': f'Unexpected error: {str(e)}'
            }
    
    @staticmethod
    def extract_multiple_transcripts(
        video_ids: List[str], 
        languages: List[str] = None,
        preserve_formatting: bool = False
    ) -> Dict[str, Dict]:
        """
        Extract transcripts for multiple videos
        
        Args:
            video_ids: List of YouTube video IDs
            languages: Preferred languages in order of preference
            preserve_formatting: Whether to preserve formatting
            
        Returns:
            Dictionary mapping video_id to transcript data
        """
        results = {}
        
        print(f"🔄 Processing {len(video_ids)} videos", file=sys.stderr)
        
        # Process each video individually with rate limiting delays
        for i, video_id in enumerate(video_ids, 1):
            print(f"🔄 Processing video {i}/{len(video_ids)}: {video_id}", file=sys.stderr)
            
            # Add delay between requests to avoid rate limiting (except for first video)
            if i > 1:
                import time
                delay_seconds = 2  # 2 second delay between requests
                print(f"⏳ Waiting {delay_seconds}s to avoid rate limiting...", file=sys.stderr)
                time.sleep(delay_seconds)
            
            results[video_id] = YouTubeTranscriptExtractor.extract_transcript(
                video_id, languages, preserve_formatting
            )
        
        successful_extractions = sum(1 for result in results.values() if result['success'])
        print(f"✅ Completed: {successful_extractions}/{len(video_ids)} successful", file=sys.stderr)
        
        return results
    
    @staticmethod
    def get_available_transcripts(video_id: str) -> Dict[str, Union[bool, List[Dict]]]:
        """
        Get information about available transcripts for a video
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Dictionary with available transcript information
        """
        try:
            api = YouTubeTranscriptExtractor._create_api_instance()
            transcript_list = api.list(video_id)
            
            # Parse the output to extract transcript information
            # The list method returns a formatted string, so we need to get actual data differently
            try:
                # Try to get available languages by attempting to fetch with no language preference
                available_data = api.fetch(video_id)
                if available_data:
                    # If we got data, we know at least one transcript is available
                    return {
                        'success': True,
                        'video_id': video_id,
                        'transcripts': [{
                            'language': available_data.language,
                            'language_code': available_data.language_code,
                            'is_generated': available_data.is_generated,
                            'is_translatable': True  # Most transcripts are translatable
                        }],
                        'count': 1
                    }
            except:
                pass
            
            # If that doesn't work, return basic info
            return {
                'success': True,
                'video_id': video_id,
                'transcripts': [],
                'count': 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'video_id': video_id,
                'transcripts': [],
                'count': 0
            }
    
    @staticmethod
    def get_channel_info_from_username(username: str) -> Dict[str, Union[str, bool]]:
        """
        Get channel information from @username by finding recent videos
        
        Args:
            username: YouTube @username (without the @ symbol)
            
        Returns:
            Dictionary with channel information or error information
        """
        try:
            print(f"🔍 Fetching channel info for @{username}", file=sys.stderr)
            
            # Configure yt-dlp to search for the channel and get recent videos
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'ignoreerrors': True,
                'playlist_items': '1:5'  # Get first 5 videos to find channel info
            }
            
            # Try with Webshare residential rotating proxy first
            channel_url = f"https://www.youtube.com/@{username}/videos"
            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"
            
            # First attempt: with proxy
            try:
                ydl_opts['proxy'] = proxy_url
                print(f"🌐 Attempting to fetch @{username} channel with Webshare proxy", file=sys.stderr)
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(channel_url, download=False)
                
                if info and info.get('entries'):
                    # Try multiple videos in case the first one fails
                    valid_entries = [e for e in info['entries'] if e and e.get('id')]
                    print(f"✅ Found {len(valid_entries)} potential videos", file=sys.stderr)

                    for idx, video in enumerate(valid_entries[:5], 1):  # Try up to 5 videos
                        video_id = video.get('id')

                        # Skip if video ID looks invalid (should be 11 chars, alphanumeric + - and _)
                        if not video_id or len(video_id) != 11:
                            print(f"⚠️ Skipping invalid video ID: {video_id}", file=sys.stderr)
                            continue

                        # Skip playlist-like IDs (they often start with UL, PL, etc.)
                        if video_id.startswith(('UL', 'PL', 'RD', 'LL')):
                            print(f"⚠️ Skipping playlist/channel ID: {video_id}", file=sys.stderr)
                            continue

                        print(f"🔍 Trying video {idx}/{len(valid_entries[:5])}: {video_id} - {video.get('title', '')[:50]}", file=sys.stderr)

                        # Now get detailed metadata for the video to extract channel info
                        video_metadata = YouTubeTranscriptExtractor.get_video_metadata(video_id)
                        if video_metadata.get('success') and video_metadata.get('channel_id'):
                            print(f"✅ Successfully extracted channel info from video!", file=sys.stderr)
                            return {
                                'success': True,
                                'username': username,
                                'channel_id': video_metadata['channel_id'],
                                'channel_name': video_metadata['channel'],
                                'uploader': video_metadata['uploader'],
                                'obtained_via': 'yt_dlp_username_search',
                                'sample_video_id': video_id,
                                'sample_video_title': video.get('title', ''),
                                'processing_date': None
                            }
                        else:
                            print(f"⚠️ Could not extract channel metadata from video {video_id}, trying next...", file=sys.stderr)

                    print(f"⚠️ Could not extract channel info from any of the {len(valid_entries[:5])} videos tried", file=sys.stderr)
                else:
                    print(f"⚠️ Proxy returned no data, trying direct connection", file=sys.stderr)
                    
            except Exception as proxy_error:
                error_msg = str(proxy_error)
                print(f"⚠️ Proxy failed: {error_msg[:100]}, trying direct connection", file=sys.stderr)
                
                # Second attempt: without proxy
                try:
                    ydl_opts.pop('proxy', None)  # Remove proxy configuration
                    print(f"🔧 Retrying @{username} with direct connection", file=sys.stderr)
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(channel_url, download=False)
                    
                    if info and info.get('entries'):
                        # Try multiple videos in case the first one fails
                        valid_entries = [e for e in info['entries'] if e and e.get('id')]
                        print(f"✅ Found {len(valid_entries)} potential videos", file=sys.stderr)

                        for idx, video in enumerate(valid_entries[:5], 1):  # Try up to 5 videos
                            video_id = video.get('id')

                            # Skip if video ID looks invalid (should be 11 chars, alphanumeric + - and _)
                            if not video_id or len(video_id) != 11:
                                print(f"⚠️ Skipping invalid video ID: {video_id}", file=sys.stderr)
                                continue

                            # Skip playlist-like IDs (they often start with UL, PL, etc.)
                            if video_id.startswith(('UL', 'PL', 'RD', 'LL')):
                                print(f"⚠️ Skipping playlist/channel ID: {video_id}", file=sys.stderr)
                                continue

                            print(f"🔍 Trying video {idx}/{len(valid_entries[:5])}: {video_id} - {video.get('title', '')[:50]}", file=sys.stderr)

                            # Now get detailed metadata for the video to extract channel info
                            video_metadata = YouTubeTranscriptExtractor.get_video_metadata(video_id)
                            if video_metadata.get('success') and video_metadata.get('channel_id'):
                                print(f"✅ Successfully extracted channel info from video!", file=sys.stderr)
                                return {
                                    'success': True,
                                    'username': username,
                                    'channel_id': video_metadata['channel_id'],
                                    'channel_name': video_metadata['channel'],
                                    'uploader': video_metadata['uploader'],
                                    'obtained_via': 'yt_dlp_username_search_direct',
                                    'sample_video_id': video_id,
                                    'sample_video_title': video.get('title', ''),
                                    'processing_date': None
                                }
                            else:
                                print(f"⚠️ Could not extract channel metadata from video {video_id}, trying next...", file=sys.stderr)

                        print(f"⚠️ Could not extract channel info from any of the {len(valid_entries[:5])} videos tried", file=sys.stderr)
                        
                except Exception as direct_error:
                    print(f"❌ Direct connection also failed: {str(direct_error)}", file=sys.stderr)
                    raise direct_error
                
            # If we get here, both proxy and direct failed to find videos
            return {
                'success': False,
                'error': 'no_videos_found',
                'message': f'Could not find videos for @{username}. The channel may not exist or may be private.'
            }
                
        except Exception as e:
            print(f"❌ Error fetching channel info for @{username}: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': 'channel_fetch_failed',
                'message': f'Failed to fetch channel info for @{username}: {str(e)}'
            }

    @staticmethod
    def get_channel_videos(channel_id: str, limit: int = 10) -> Dict[str, Union[str, bool, List]]:
        """
        Extract last N videos from a YouTube channel
        
        Args:
            channel_id: YouTube channel ID (e.g., UCJ0AGHkKD09JfZ5ydC2bP7w)
            limit: Number of videos to extract (default: 10)
            
        Returns:
            Dictionary with video list or error information
        """
        try:
            print(f"📹 Fetching last {limit} videos for channel: {channel_id}", file=sys.stderr)
            
            # Configure yt-dlp to extract channel videos with proxy
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'playlist_items': f'1:{limit}',  # Get first N videos (most recent)
                'ignoreerrors': True,
            }
            
            channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"
            info = None
            
            # First attempt: with Webshare residential rotating proxy
            try:
                proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"
                ydl_opts['proxy'] = proxy_url
                print(f"🌐 Attempting to fetch channel videos with Webshare proxy", file=sys.stderr)
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(channel_url, download=False)
                
                if info and info.get('entries'):
                    print(f"✅ Successfully extracted {len(info['entries'])} videos using Webshare proxy", file=sys.stderr)
                else:
                    print(f"⚠️ Proxy returned no videos, trying direct connection", file=sys.stderr)
                    
            except Exception as proxy_error:
                error_msg = str(proxy_error)
                print(f"⚠️ Proxy failed: {error_msg[:100]}, trying direct connection", file=sys.stderr)
                
                # Second attempt: without proxy
                try:
                    ydl_opts.pop('proxy', None)  # Remove proxy configuration
                    print(f"🔧 Retrying with direct connection", file=sys.stderr)
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(channel_url, download=False)
                    
                    if info and info.get('entries'):
                        print(f"✅ Successfully extracted {len(info['entries'])} videos using direct connection", file=sys.stderr)
                        
                except Exception as direct_error:
                    print(f"❌ Direct connection also failed: {str(direct_error)}", file=sys.stderr)
                    raise direct_error
                
            # Process videos if we got info from either proxy or direct connection
            if not info or not info.get('entries'):
                return {
                    'success': False,
                    'error': 'no_videos_found',
                    'message': f'No videos found for channel {channel_id}'
                }
            
            videos = []
            for entry in info['entries'][:limit]:
                if entry and entry.get('id'):
                    videos.append({
                        'id': entry['id'],
                        'title': entry.get('title', ''),
                        'description': entry.get('description', ''),
                        'duration': entry.get('duration_string', ''),
                        'publishedAt': entry.get('upload_date', ''),
                        'thumbnail': entry.get('thumbnail', f"https://img.youtube.com/vi/{entry['id']}/maxresdefault.jpg"),
                        'view_count': entry.get('view_count', 0),
                        'url': f"https://www.youtube.com/watch?v={entry['id']}"
                    })
            
            return {
                'success': True,
                'channel_id': channel_id,
                'video_count': len(videos),
                'videos': videos,
                'obtained_via': 'yt_dlp_channel_videos',
                'processing_date': None
            }
                
        except Exception as e:
            print(f"❌ Error fetching channel videos for {channel_id}: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': 'channel_videos_fetch_failed',
                'message': f'Failed to fetch channel videos for {channel_id}: {str(e)}'
            }

    @staticmethod
    def get_video_metadata(video_id: str) -> Dict[str, Union[str, bool]]:
        """
        Extract video metadata without using YouTube API quotas
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Dictionary with video metadata or error information
        """
        try:
            print(f"🔍 Fetching metadata for video: {video_id}", file=sys.stderr)
            
            # Configure yt-dlp to extract metadata only (no download) with proxy
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                'skip_download': True,
                'ignoreerrors': True,
                'format': 'worst',  # Request worst quality to minimize format issues
                'no_check_formats': True,  # Don't validate format availability
            }
            
            # Try with Webshare residential rotating proxy first, fallback to direct connection if needed
            info = None
            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            
            # First attempt: with proxy
            proxy_succeeded = False
            try:
                ydl_opts['proxy'] = proxy_url
                print(f"🌐 Attempting Webshare residential rotating proxy for metadata extraction", file=sys.stderr)

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=False)

                if info:
                    print(f"✅ Successfully extracted metadata using Webshare proxy", file=sys.stderr)
                    proxy_succeeded = True
                else:
                    print(f"⚠️ Proxy returned no data, trying direct connection", file=sys.stderr)

            except Exception as proxy_error:
                error_msg = str(proxy_error)
                if "407" in error_msg or "authentication" in error_msg.lower():
                    print(f"⚠️ Proxy authentication failed (407), trying direct connection", file=sys.stderr)
                else:
                    print(f"⚠️ Proxy failed: {error_msg[:100]}, trying direct connection", file=sys.stderr)

            # Second attempt: without proxy (if proxy failed or returned no data)
            if not proxy_succeeded:
                try:
                    ydl_opts.pop('proxy', None)  # Remove proxy configuration
                    print(f"🔧 Retrying with direct connection", file=sys.stderr)

                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(video_url, download=False)

                    if info:
                        print(f"✅ Successfully extracted metadata using direct connection", file=sys.stderr)

                except Exception as direct_error:
                    print(f"❌ Direct connection also failed: {str(direct_error)}", file=sys.stderr)
                    # Don't raise - let the code below handle None info
                
            # Process metadata if we got info from either proxy or direct connection
            if not info:
                return {
                    'success': False,
                    'error': 'no_metadata_found',
                    'message': 'Could not extract video metadata'
                }
                
            metadata = {
                'success': True,
                'video_id': video_id,
                'title': info.get('title', ''),
                'description': info.get('description', ''),
                'duration': info.get('duration', 0),
                'upload_date': info.get('upload_date', ''),
                'uploader': info.get('uploader', ''),
                'channel': info.get('channel', ''),
                'channel_id': info.get('channel_id', ''),
                'view_count': info.get('view_count', 0),
                'like_count': info.get('like_count', 0),
                'thumbnail': info.get('thumbnail', ''),
                'tags': info.get('tags', []),
                'categories': info.get('categories', []),
                'availability': info.get('availability', 'unknown'),
                'age_limit': info.get('age_limit', 0),
                'language': info.get('language', ''),
                'obtained_via': 'yt_dlp',
                'processing_date': None  # Will be set by calling service
            }
            
            print(f"✅ Successfully extracted metadata for: {metadata['title']}", file=sys.stderr)
            return metadata
                
        except Exception as e:
            # Handle rate limiting and network issues with retry logic
            error_message = str(e).lower()
            if any(keyword in error_message for keyword in ['rate', 'limit', 'blocked', 'too many', 'network', 'timeout']):
                print(f"⚠️ Rate limited or network issue, trying with backoff delay...", file=sys.stderr)
                
                for retry_attempt in range(2):  # Try 2 more times
                    backoff_delay = (retry_attempt + 1) * 5  # 5, 10 seconds
                    print(f"⏳ Waiting {backoff_delay}s before retry {retry_attempt + 1}/2...", file=sys.stderr)
                    import time
                    time.sleep(backoff_delay)
                    
                    try:
                        # Retry with fresh proxy configuration
                        ydl_opts_retry = {
                            'quiet': True,
                            'no_warnings': True,
                            'extract_flat': False,
                            'writeinfojson': False,
                            'writedescription': False,
                            'writesubtitles': False,
                            'skip_download': True,
                            'ignoreerrors': True
                        }
                        
                        # Re-configure proxy for retry (fresh proxy rotation) 
                        try:
                            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"
                            ydl_opts_retry['proxy'] = proxy_url
                            print(f"🔄 Retry {retry_attempt + 1} using fresh Webshare residential proxy rotation", file=sys.stderr)
                        except:
                            print(f"⚠️ Retry {retry_attempt + 1} without proxy", file=sys.stderr)
                        
                        with yt_dlp.YoutubeDL(ydl_opts_retry) as ydl_retry:
                            video_url = f"https://www.youtube.com/watch?v={video_id}"
                            info = ydl_retry.extract_info(video_url, download=False)
                            
                            if not info:
                                continue
                            
                            metadata = {
                                'success': True,
                                'video_id': video_id,
                                'title': info.get('title', ''),
                                'description': info.get('description', ''),
                                'duration': info.get('duration', 0),
                                'upload_date': info.get('upload_date', ''),
                                'uploader': info.get('uploader', ''),
                                'channel': info.get('channel', ''),
                                'channel_id': info.get('channel_id', ''),
                                'view_count': info.get('view_count', 0),
                                'like_count': info.get('like_count', 0),
                                'thumbnail': info.get('thumbnail', ''),
                                'tags': info.get('tags', []),
                                'categories': info.get('categories', []),
                                'availability': info.get('availability', 'unknown'),
                                'age_limit': info.get('age_limit', 0),
                                'language': info.get('language', ''),
                                'obtained_via': 'yt_dlp_retry',
                                'processing_date': None
                            }
                            
                            print(f"✅ Retry successful! Extracted metadata for: {metadata['title']}", file=sys.stderr)
                            return metadata
                            
                    except Exception as retry_error:
                        print(f"❌ Retry {retry_attempt + 1} failed: {str(retry_error)}", file=sys.stderr)
                        continue
                
                # If all retries failed
                return {
                    'success': False,
                    'error': 'rate_limited',
                    'message': 'Metadata extraction blocked after retries - please try again later'
                }
            
            # For other errors, return immediately
            print(f"❌ Error extracting metadata for {video_id}: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': 'metadata_extraction_failed',
                'message': f'Failed to extract metadata: {str(e)}'
            }


def main():
    """CLI interface for the transcript extractor"""
    if len(sys.argv) < 2:
        print("Usage: python youtube_transcript_extractor.py <command> [options]")
        print("Commands:")
        print("  single <video_id> [languages...] - Extract transcript for single video")
        print("  multiple <video_id1,video_id2,...> [languages...] - Extract transcripts for multiple videos")
        print("  info <video_id> - Get available transcript information")
        print("  metadata <video_id> - Get video metadata without using API quotas")
        print("  full <video_id> - Get both transcript and metadata")
        print("  channel <@username> - Get channel info from @username")
        print("  videos <channel_id> [limit] - Get last N videos from channel")
        print("")
        print("Examples:")
        print("  python youtube_transcript_extractor.py single dQw4w9WgXcQ")
        print("  python youtube_transcript_extractor.py single dQw4w9WgXcQ en es fr")
        print("  python youtube_transcript_extractor.py multiple dQw4w9WgXcQ,oHg5SJYRHA0")
        print("  python youtube_transcript_extractor.py info dQw4w9WgXcQ")
        print("  python youtube_transcript_extractor.py metadata dQw4w9WgXcQ")
        print("  python youtube_transcript_extractor.py full dQw4w9WgXcQ")
        print("  python youtube_transcript_extractor.py videos UCJ0AGHkKD09JfZ5ydC2bP7w 10")
        return
    
    command = sys.argv[1].lower()
    
    if command == 'single' and len(sys.argv) >= 3:
        video_id = sys.argv[2]
        languages = sys.argv[3:] if len(sys.argv) > 3 else None
        
        result = YouTubeTranscriptExtractor.extract_transcript(video_id, languages)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif command == 'multiple' and len(sys.argv) >= 3:
        video_ids = sys.argv[2].split(',')
        languages = sys.argv[3:] if len(sys.argv) > 3 else None
        
        results = YouTubeTranscriptExtractor.extract_multiple_transcripts(video_ids, languages)
        print(json.dumps(results, indent=2, ensure_ascii=False))
        
    elif command == 'info' and len(sys.argv) >= 3:
        video_id = sys.argv[2]
        
        result = YouTubeTranscriptExtractor.get_available_transcripts(video_id)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif command == 'metadata' and len(sys.argv) >= 3:
        video_id = sys.argv[2]
        
        result = YouTubeTranscriptExtractor.get_video_metadata(video_id)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif command == 'full' and len(sys.argv) >= 3:
        video_id = sys.argv[2]
        languages = sys.argv[3:] if len(sys.argv) > 3 else None
        
        # Get both transcript and metadata
        transcript_result = YouTubeTranscriptExtractor.extract_transcript(video_id, languages)
        metadata_result = YouTubeTranscriptExtractor.get_video_metadata(video_id)
        
        combined_result = {
            'video_id': video_id,
            'transcript': transcript_result,
            'metadata': metadata_result
        }
        print(json.dumps(combined_result, indent=2, ensure_ascii=False))
        
    elif command == 'channel' and len(sys.argv) >= 3:
        username_input = sys.argv[2]
        # Remove @ if provided
        username = username_input.lstrip('@')
        
        result = YouTubeTranscriptExtractor.get_channel_info_from_username(username)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif command == 'videos' and len(sys.argv) >= 3:
        channel_id = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        
        result = YouTubeTranscriptExtractor.get_channel_videos(channel_id, limit)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    else:
        print("Invalid command or missing arguments")
        return


if __name__ == '__main__':
    main()