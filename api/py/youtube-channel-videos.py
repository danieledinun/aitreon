"""
Vercel Python serverless function for YouTube channel videos extraction
Uses yt-dlp to get last N videos from a channel
"""

from http.server import BaseHTTPRequestHandler
import json
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

            # Use Webshare residential rotating proxy to avoid rate limits
            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"

            # Configure yt-dlp to extract channel videos
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'ignoreerrors': True,
                'playlist_items': f'1:{limit}',
                'format': 'worst',
                'no_check_formats': True,
                'proxy': proxy_url,
            }

            channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"

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
                    'message': f'Could not find videos for channel {channel_id}'
                }).encode())
                return

            # Extract video list
            videos = []
            for entry in info['entries']:
                if entry and entry.get('id'):
                    # Skip playlist/channel IDs
                    video_id = entry.get('id')
                    if len(video_id) != 11 or video_id.startswith(('UL', 'PL', 'RD', 'LL')):
                        continue

                    videos.append({
                        'id': video_id,
                        'title': entry.get('title', ''),
                        'description': entry.get('description', ''),
                        'duration': entry.get('duration_string', ''),
                        'publishedAt': '',  # Not available in flat extraction
                        'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                        'view_count': entry.get('view_count', 0),
                        'url': entry.get('url', f"https://www.youtube.com/watch?v={video_id}")
                    })

            # Get channel metadata (thumbnail, subscriber count, total videos)
            channel_thumbnail = info.get('channel_follower_count') or info.get('thumbnails', [{}])[0].get('url', '')
            if not channel_thumbnail:
                # Fallback to constructing channel thumbnail URL from channel ID
                channel_thumbnail = f"https://yt3.ggpht.com/ytc/{channel_id}"

            # Success! Return videos
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'channel_id': channel_id,
                'channel_thumbnail': channel_thumbnail,
                'channel_name': info.get('channel', info.get('uploader', '')),
                'subscriber_count': info.get('channel_follower_count'),
                'total_videos': info.get('playlist_count', len(videos)),
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
