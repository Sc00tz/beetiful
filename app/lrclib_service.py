"""LRCLib API service for fetching and parsing timed lyrics"""

import requests
import re
import logging

# Set up logger for this module
logger = logging.getLogger(__name__)

def fetch_lyrics_from_lrclib(artist, title, album=None, duration=None):
    """Fetch lyrics from LRCLib API using artist, title, and optional album/duration."""
    try:
        params = {'artist_name': artist, 'track_name': title}
        if album:
            params['album_name'] = album
        logger.info(f"Fetching lyrics from LRCLib for {artist} - {title}")
        response = requests.get('https://lrclib.net/api/search', params=params, timeout=10)
        if response.status_code == 200:
            results = response.json()
            if results:
                best_match = None
                for result in results:
                    artist_match = (result.get('artistName', '').lower() == artist.lower())
                    title_match = (result.get('trackName', '').lower() == title.lower())
                    if artist_match and title_match:
                        best_match = result
                        break
                chosen_result = best_match or results[0]
                lyrics_data = {
                    'plain_lyrics': chosen_result.get('plainLyrics'),
                    'synced_lyrics': chosen_result.get('syncedLyrics'),
                    'duration': str(chosen_result.get('duration')) if chosen_result.get('duration') is not None else None,
                    'source': 'lrclib'
                }
                logger.info(f"Found lyrics from LRCLib: plain={bool(lyrics_data['plain_lyrics'])}, synced={bool(lyrics_data['synced_lyrics'])}")
                return lyrics_data
        # Fallback to general search
        general_params = {'q': f'{artist} {title}'}
        response = requests.get('https://lrclib.net/api/search', params=general_params, timeout=10)
        if response.status_code == 200:
            results = response.json()
            if results:
                chosen_result = results[0]
                lyrics_data = {
                    'plain_lyrics': chosen_result.get('plainLyrics'),
                    'synced_lyrics': chosen_result.get('syncedLyrics'),
                    'duration': str(chosen_result.get('duration')) if chosen_result.get('duration') is not None else None,
                    'source': 'lrclib'
                }
                logger.info(f"Found lyrics from LRCLib (general search): plain={bool(lyrics_data['plain_lyrics'])}, synced={bool(lyrics_data['synced_lyrics'])}")
                return lyrics_data
        logger.info("No lyrics found on LRCLib")
        return None
    except requests.RequestException as e:
        logger.error(f"Error fetching from LRCLib: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching from LRCLib: {e}")
        return None

def parse_duration(duration_str):
    """Convert duration string (float seconds or mm:ss) to float seconds."""
    if duration_str is None:
        return None
    if isinstance(duration_str, (int, float)):
        return float(duration_str)
    if isinstance(duration_str, str):
        match = re.match(r'^(\d+):(\d{2})\.?((?:\d{0,2}))\](.*)', duration_str)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            centiseconds = int(match.group(3).ljust(2, '0')[:2]) if match.group(3) else 0
            return minutes * 60 + seconds + centiseconds * 0.01
        try:
            return float(duration_str)
        except Exception:
            return None
    return None

def parse_lrc_lyrics(lyrics_text):
    """Parse LRC format lyrics into timed and plain segments."""
    if not lyrics_text:
        return None
    lrc_pattern = r'\[(\d{2}):(\d{2})\.?((?:\d{0,2}))\](.*)'
    timed_lyrics = []
    plain_lyrics = []
    for line in lyrics_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        match = re.match(lrc_pattern, line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            centiseconds = int(match.group(3).ljust(2, '0')[:2]) if match.group(3) else 0
            text = match.group(4).strip()
            timestamp = (minutes * 60 + seconds) * 1000 + centiseconds * 10
            if text:
                timed_lyrics.append({'time': timestamp, 'text': text})
                plain_lyrics.append(text)
        else:
            plain_lyrics.append(line)
    if timed_lyrics:
        return {'type': 'timed', 'timed': timed_lyrics, 'plain': '\n'.join(plain_lyrics)}
    else:
        return {'type': 'plain', 'plain': lyrics_text}