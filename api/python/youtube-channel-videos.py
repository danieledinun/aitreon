"""
Vercel Python serverless function for YouTube channel videos extraction
Uses RSS feed for fast video metadata including publish dates
Uses yt-dlp for duration and channel metadata
"""

from http.server import BaseHTTPRequestHandler
import json
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
import yt_dlp

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            channel_id = data.get('channel_id')
            limit = data.get('limit', 10)

            if not channel_id:
                self.send_error(400, "Missing channel_id parameter")
                return

            # Use yt-dlp with Webshare residential rotating proxy
            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"

            # Get channel videos using yt-dlp (fast with extract_flat)
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': 'in_playlist',
                'playlist_items': f'1:{limit}',
                'ignoreerrors': True,
                'proxy': proxy_url,
            }

            videos = []
            channel_thumbnail = f"https://yt3.googleusercontent.com/ytc/AIdro_k{channel_id}"
            channel_name_text = ''
            subscriber_count = None

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                channel_info = ydl.extract_info(f"https://www.youtube.com/channel/{channel_id}/videos", download=False)

                if not channel_info or not channel_info.get('entries'):
                    raise Exception("No videos found for channel")

                # Get channel metadata
                channel_name_text = channel_info.get('channel', channel_info.get('uploader', ''))

                # Get channel thumbnail
                if channel_info.get('thumbnails') and isinstance(channel_info['thumbnails'], list):
                    thumb = max(channel_info['thumbnails'], key=lambda t: t.get('width', 0) * t.get('height', 0))
                    if 'url' in thumb:
                        channel_thumbnail = thumb['url']

                # Get subscriber count
                if channel_info.get('channel_follower_count'):
                    subscriber_count = channel_info.get('channel_follower_count')

                # Process video entries
                for entry in channel_info.get('entries', [])[:limit]:
                    if not entry or not entry.get('id'):
                        continue

                    video_id = entry['id']

                    # Format duration
                    duration_str = ''
                    if entry.get('duration'):
                        duration = int(entry['duration'])
                        hours = duration // 3600
                        minutes = (duration % 3600) // 60
                        seconds = duration % 60
                        if hours > 0:
                            duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
                        else:
                            duration_str = f"{minutes}:{seconds:02d}"

                    # Format published date
                    published_at = ''
                    if entry.get('upload_date'):
                        try:
                            date_str = entry['upload_date']
                            published_at = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
                        except:
                            pass

                    videos.append({
                        'id': video_id,
                        'title': entry.get('title', ''),
                        'description': entry.get('description', ''),
                        'publishedAt': published_at,
                        'view_count': entry.get('view_count', 0),
                        'duration': duration_str,
                        'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                        'url': f"https://www.youtube.com/watch?v={video_id}"
                    })

            # Success! Return videos
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'channel_id': channel_id,
                'channel_thumbnail': channel_thumbnail,
                'channel_name': channel_name_text,
                'subscriber_count': None,  # RSS doesn't include subscriber count
                'total_videos': len(videos),
                'video_count': len(videos),
                'videos': videos
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
            'message': 'YouTube Channel Videos API - POST channel_id and limit to get videos'
        }).encode())
