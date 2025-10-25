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

            # Configure yt-dlp to extract channel videos with full metadata
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': 'in_playlist',  # Fast extraction with basic metadata
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

                    # Format duration from seconds to readable format
                    duration = entry.get('duration', 0)
                    duration_str = ''
                    if duration:
                        # Convert to int in case it's a float
                        duration = int(duration)
                        hours = duration // 3600
                        minutes = (duration % 3600) // 60
                        seconds = duration % 60
                        if hours > 0:
                            duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
                        else:
                            duration_str = f"{minutes}:{seconds:02d}"

                    # Format upload date to ISO format
                    # Try all possible date fields from yt-dlp
                    from datetime import datetime

                    upload_date = (
                        entry.get('upload_date') or
                        entry.get('release_date') or
                        entry.get('modified_date') or
                        ''
                    )

                    # Try timestamp fields as fallback
                    if not upload_date:
                        timestamp = (
                            entry.get('timestamp') or
                            entry.get('release_timestamp') or
                            entry.get('modified_timestamp')
                        )
                        if timestamp:
                            dt = datetime.fromtimestamp(timestamp)
                            upload_date = dt.strftime('%Y%m%d')

                    published_at = ''
                    if upload_date and len(upload_date) >= 8:
                        # upload_date format: YYYYMMDD
                        published_at = f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"

                    # If still no date, try to get from availability or webpage_url
                    # This is a last resort - use current date as placeholder
                    if not published_at:
                        # Log available fields for debugging (only keys to avoid sensitive data)
                        import sys
                        print(f"DEBUG: No date found for video {video_id}. Available fields: {list(entry.keys())}", file=sys.stderr)
                        # Use empty string instead of current date to avoid misleading data
                        published_at = ''

                    videos.append({
                        'id': video_id,
                        'title': entry.get('title', ''),
                        'description': entry.get('description', ''),
                        'duration': duration_str,
                        'publishedAt': published_at,
                        'thumbnail': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                        'view_count': entry.get('view_count', 0),
                        'url': entry.get('url', f"https://www.youtube.com/watch?v={video_id}")
                    })

            # Get channel metadata (thumbnail, subscriber count, total videos)
            # Channel thumbnail from the uploader avatar or channel thumbnails
            channel_thumbnail = ''

            # Try to get from channel/uploader avatar first
            if info.get('channel_avatar'):
                channel_thumbnail = info['channel_avatar']
            elif info.get('uploader_avatar'):
                channel_thumbnail = info['uploader_avatar']
            elif info.get('thumbnails') and isinstance(info['thumbnails'], list) and len(info['thumbnails']) > 0:
                # Get the highest quality thumbnail
                thumb = max(info['thumbnails'], key=lambda t: t.get('width', 0) * t.get('height', 0))
                if 'url' in thumb:
                    channel_thumbnail = thumb['url']

            if not channel_thumbnail:
                # Fallback to YouTube's default channel avatar endpoint
                channel_thumbnail = f"https://yt3.ggpht.com/ytc/AIdro_k{channel_id}"

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
