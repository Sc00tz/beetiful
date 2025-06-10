"""
LRCLib API service for fetching timed lyrics
"""
import requests
import re
import logging

logger = logging.getLogger(__name__)

def fetch_lyrics_from_lrclib(artist, title, album=None, duration=None):
    """Fetch lyrics directly from LRCLib API."""
    try:
        # Try specific search first (artist + title + album)
        params = {
            'artist_name': artist,
            'track_name': title
        }
        if album:
            params['album_name'] = album
        
        logger.info(f"Fetching lyrics from LRCLib for {artist} - {title}")
        response = requests.get('https://lrclib.net/api/search', params=params, timeout=10)
        
        if response.status_code == 200:
            results = response.json()
            
            if results:
                # Find best match - prefer exact duration match if available
                best_match = None
                exact_duration_match = None
                
                for result in results:
                    # Check for exact artist/title match (case insensitive)
                    artist_match = (result.get('artistName', '').lower() == artist.lower())
                    title_match = (result.get('trackName', '').lower() == title.lower())
                    
                    if artist_match and title_match:
                        if duration and result.get('duration'):
                            # Check if duration matches (within 2 seconds tolerance)
                            if abs(float(result.get('duration', 0)) - float(duration)) <= 2:
                                exact_duration_match = result
                                break
                        elif not best_match:
                            best_match = result
                
                # Use exact duration match if found, otherwise use best match
                chosen_result = exact_duration_match or best_match or results[0]
                
                lyrics_data = {
                    'plain_lyrics': chosen_result.get('plainLyrics'),
                    'synced_lyrics': chosen_result.get('syncedLyrics'),
                    'duration': chosen_result.get('duration'),
                    'source': 'lrclib'
                }
                
                logger.info(f"Found lyrics from LRCLib: plain={bool(lyrics_data['plain_lyrics'])}, synced={bool(lyrics_data['synced_lyrics'])}")
                return lyrics_data
                
        # If specific search fails, try general search
        general_params = {'q': f'{artist} {title}'}
        response = requests.get('https://lrclib.net/api/search', params=general_params, timeout=10)
        
        if response.status_code == 200:
            results = response.json()
            if results:
                # Take the first result from general search
                chosen_result = results[0]
                lyrics_data = {
                    'plain_lyrics': chosen_result.get('plainLyrics'),
                    'synced_lyrics': chosen_result.get('syncedLyrics'),
                    'duration': chosen_result.get('duration'),
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

def parse_lrc_lyrics(lyrics_text):
    """Parse LRC format lyrics into timed segments."""
    if not lyrics_text:
        return None
    
    # LRC format: [mm:ss.xx]lyrics text
    lrc_pattern = r'\[(\d{2}):(\d{2})\.?(\d{0,2})\](.*)'
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
            
            # Convert to total milliseconds
            timestamp = (minutes * 60 + seconds) * 1000 + centiseconds * 10
            
            if text:  # Only add non-empty lyrics
                timed_lyrics.append({
                    'time': timestamp,
                    'text': text
                })
                plain_lyrics.append(text)
        else:
            # Non-timed lyric line
            plain_lyrics.append(line)
    
    if timed_lyrics:
        return {
            'type': 'timed',
            'timed': timed_lyrics,
            'plain': '\n'.join(plain_lyrics)
        }
    else:
        return {
            'type': 'plain',
            'plain': lyrics_text
        }