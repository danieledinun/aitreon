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

            # Use Webshare residential rotating proxy for both RSS and yt-dlp
            proxy_url = "http://vvwbndwq-1:2w021mlwybfn@p.webshare.io:80"

            # Fetch YouTube RSS feed through proxy
            rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

            # Set up proxy handler for urllib
            proxy_handler = urllib.request.ProxyHandler({
                'http': proxy_url,
                'https': proxy_url
            })
            opener = urllib.request.build_opener(proxy_handler)

            req = urllib.request.Request(rss_url)
            with opener.open(req, timeout=15) as response:
                rss_content = response.read()

            # Parse RSS XML
            root = ET.fromstring(rss_content)

            # Namespace for Atom feed
            ns = {
                'atom': 'http://www.w3.org/2005/Atom',
                'yt': 'http://www.youtube.com/xml/schemas/2015',
                'media': 'http://search.yahoo.com/mrss/'
            }

            # Extract channel info from RSS
            channel_name = root.find('.//atom:author/atom:name', ns)
            channel_name_text = channel_name.text if channel_name is not None else ''

            # Use yt-dlp to get channel thumbnail and subscriber count
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'ignoreerrors': True,
                'proxy': proxy_url,
            }

            channel_thumbnail = f"https://yt3.googleusercontent.com/ytc/AIdro_k{channel_id}"
            subscriber_count = None

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    channel_info = ydl.extract_info(f"https://www.youtube.com/channel/{channel_id}", download=False)
                    if channel_info:
                        if channel_info.get('channel_follower_count'):
                            subscriber_count = channel_info.get('channel_follower_count')
                        if channel_info.get('thumbnails') and isinstance(channel_info['thumbnails'], list):
                            thumb = max(channel_info['thumbnails'], key=lambda t: t.get('width', 0) * t.get('height', 0))
                            if 'url' in thumb:
                                channel_thumbnail = thumb['url']
            except:
                pass

            # Extract videos from RSS
            entries = root.findall('.//atom:entry', ns)[:limit]

            # Collect video data from RSS (including duration from media:content)
            videos = []
            for entry in entries:
                video_id_elem = entry.find('.//yt:videoId', ns)
                if video_id_elem is None:
                    continue

                video_id = video_id_elem.text

                # Get video metadata from RSS
                title_elem = entry.find('.//atom:title', ns)
                published_elem = entry.find('.//atom:published', ns)
                media_group = entry.find('.//media:group', ns)

                title = title_elem.text if title_elem is not None else ''
                published = published_elem.text if published_elem is not None else ''

                # Parse publish date to YYYY-MM-DD format
                published_at = ''
                if published:
                    try:
                        dt = datetime.fromisoformat(published.replace('Z', '+00:00'))
                        published_at = dt.strftime('%Y-%m-%d')
                    except:
                        published_at = ''

                # Get description
                description = ''
                if media_group is not None:
                    desc_elem = media_group.find('.//media:description', ns)
                    description = desc_elem.text if desc_elem is not None else ''

                # Get duration from media:content (in seconds)
                duration_str = ''
                if media_group is not None:
                    content_elem = media_group.find('.//media:content', ns)
                    if content_elem is not None and content_elem.get('duration'):
                        try:
                            duration = int(content_elem.get('duration'))
                            hours = duration // 3600
                            minutes = (duration % 3600) // 60
                            seconds = duration % 60
                            if hours > 0:
                                duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
                            else:
                                duration_str = f"{minutes}:{seconds:02d}"
                        except:
                            pass

                # Get view count
                views_elem = entry.find('.//media:group/media:community/media:statistics', ns)
                view_count = 0
                if views_elem is not None:
                    view_count = int(views_elem.get('views', 0))

                videos.append({
                    'id': video_id,
                    'title': title,
                    'description': description,
                    'publishedAt': published_at,
                    'duration': duration_str,
                    'view_count': view_count,
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
