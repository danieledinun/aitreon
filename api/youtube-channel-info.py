"""
Vercel Python serverless function for YouTube channel info extraction
Uses yt-dlp to get channel info from @username URLs
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import yt_dlp

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            username = data.get('username')
            if not username:
                self.send_error(400, "Missing username parameter")
                return

            # Configure yt-dlp to search for the channel and get recent videos
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'ignoreerrors': True,
                'playlist_items': '1:5',  # Get first 5 videos
                'format': 'worst',  # Request worst quality to minimize format issues
                'no_check_formats': True,  # Don't validate format availability
            }

            channel_url = f"https://www.youtube.com/@{username}/videos"

            # Try to get channel videos
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(channel_url, download=False)

            if not info or not info.get('entries'):
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': 'no_videos_found',
                    'message': f'Could not find videos for @{username}'
                }).encode())
                return

            # Try multiple videos to find valid channel info
            valid_entries = [e for e in info['entries'] if e and e.get('id')]

            for video in valid_entries[:5]:
                video_id = video.get('id')

                # Skip invalid or playlist IDs
                if not video_id or len(video_id) != 11:
                    continue
                if video_id.startswith(('UL', 'PL', 'RD', 'LL')):
                    continue

                # Get metadata for this video
                try:
                    metadata_opts = {
                        'quiet': True,
                        'no_warnings': True,
                        'extract_flat': False,
                        'skip_download': True,
                        'ignoreerrors': True,
                        'format': 'worst',
                        'no_check_formats': True,
                    }

                    video_url = f"https://www.youtube.com/watch?v={video_id}"

                    with yt_dlp.YoutubeDL(metadata_opts) as ydl_meta:
                        video_info = ydl_meta.extract_info(video_url, download=False)

                    if video_info and video_info.get('channel_id'):
                        # Success! Return channel info
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'success': True,
                            'username': username,
                            'channel_id': video_info.get('channel_id'),
                            'channel_name': video_info.get('channel'),
                            'uploader': video_info.get('uploader'),
                            'obtained_via': 'yt_dlp_username_search',
                            'sample_video_id': video_id,
                            'sample_video_title': video.get('title', '')
                        }).encode())
                        return

                except Exception:
                    continue  # Try next video

            # If we get here, no videos worked
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': 'no_channel_info',
                'message': f'Could not extract channel information for @{username}'
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': 'server_error',
                'message': str(e)
            }).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'status': 'ok',
            'message': 'YouTube Channel Info API - POST username to get channel info'
        }).encode())
