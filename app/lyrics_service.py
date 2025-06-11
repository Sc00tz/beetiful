"""Lyrics service for Beets and LRCLib integration"""

import os
import subprocess
import re
import logging
from pathlib import Path
from lrclib_service import fetch_lyrics_from_lrclib, parse_lrc_lyrics
from config_manager import read_config
from beets_utils import clean_field

logger = logging.getLogger(__name__)

def get_track_lyrics(track_id, beets_bin):
    """Get lyrics for a track, always returning plain text for API display."""
    try:
        # Get track info from beets first
        cmd = [beets_bin, 'list', '--format', '$lyrics\\t$path\\t$artist\\t$title\\t$album\\t$length', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output = process.stdout.strip()

        if not output or output == '$lyrics\\t$path\\t$artist\\t$title\\t$album\\t$length':
            beets_lyrics = None
            track_path = None
            artist = None
            title = None
            album = None
            duration = None
        else:
            parts = output.split('\\t')
            beets_lyrics = parts[0] if parts[0] != '$lyrics' else None
            track_path = parts[1] if len(parts) > 1 and parts[1] != '$path' else None
            artist = parts[2] if len(parts) > 2 and parts[2] != '$artist' else None
            title = parts[3] if len(parts) > 3 and parts[3] != '$title' else None
            album = parts[4] if len(parts) > 4 and parts[4] != '$album' else None
            duration = parts[5] if len(parts) > 5 and parts[5] != '$length' else None

        # Clean fields
        artist = clean_field(artist, 'artist')
        title = clean_field(title, 'title')
        album = clean_field(album, 'album')
        # beets_lyrics is likely plain text, so no special handling for timed here
        beets_lyrics = clean_field(beets_lyrics, 'lyrics')

        # Try LRCLib for synced lyrics first
        lrclib_data = fetch_lyrics_from_lrclib(artist, title, album, duration)
        if lrclib_data and lrclib_data.get('synced_lyrics'):
            logger.info(f"Attempting to parse synced lyrics from LRCLib for {artist} - {title}.")
            parsed_lyrics = parse_lrc_lyrics(lrclib_data.get('synced_lyrics'))
            if parsed_lyrics and parsed_lyrics.get('type') == 'timed':
                # Join all timed lines as plain text for display
                plain = '\n'.join([line['text'] for line in parsed_lyrics['timed']])
                return {'lyrics': plain, 'type': 'timed', 'source': 'lrclib'}, 200
            elif parsed_lyrics and parsed_lyrics.get('plain'):
                return {'lyrics': parsed_lyrics['plain'], 'type': 'plain', 'source': 'lrclib'}, 200
        else:
            logger.info(f"No synced_lyrics found from LRCLib for {artist} - {title}.")


        # Fallback to beets lyrics plugin.
        logger.info(f"LRCLib did not provide timed lyrics. Beets plugin will return plain lyrics or no lyrics. No timed lyrics found from configured sources.")
        return {'lyrics': beets_lyrics or None, 'type': 'plain', 'source': 'beets'}, 200

    except subprocess.CalledProcessError as e:
        logger.error(f"Error fetching lyrics: {e.stderr}")
        return {'error': f"Failed to fetch lyrics: {e.stderr}"}, 500
    except Exception as e:
        logger.error(f"An unexpected error occurred while fetching lyrics: {e}")
        return {'error': f"An unexpected error occurred: {e}"}, 500

def set_track_lyrics(track_id, lyrics, beets_bin):
    """Set lyrics for a track, using non-interactive mode."""
    try:
        # Always add '-y' to suppress prompts
        cmd = [beets_bin, 'modify', '-y', f'id:{track_id}', f'lyrics={lyrics}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        return {'message': 'Lyrics updated successfully'}
    except subprocess.CalledProcessError as e:
        logger.error(f"Error setting lyrics: {e.stderr}")
        return {'error': f"Failed to set lyrics: {e.stderr}"}, 500
    except Exception as e:
        logger.error(f"Error setting lyrics: {e}")
        return {'error': f"An unexpected error occurred: {e}"}, 500

def fetch_lyrics_for_track(track_id, beets_bin):
    """Fetch lyrics for a track from LRCLib API."""
    try:
        # Get track info from beets first
        cmd = [beets_bin, 'list', '--format', '$artist\\t$title\\t$album\\t$length', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output = process.stdout.strip()

        if not output:
            return {'error': 'Track not found'}, 404

        parts = output.split('\\t')
        artist = clean_field(parts[0], 'artist') if parts[0] != '$artist' else None
        title = clean_field(parts[1], 'title') if parts[1] != '$title' else None
        album = clean_field(parts[2], 'album') if parts[2] != '$album' else None
        duration = parts[3] if len(parts) > 3 and parts[3] != '$length' else None

        if not artist or not title:
            return {'error': 'Track missing required metadata (artist/title)'}, 400

        # Try LRCLib for lyrics
        lrclib_data = fetch_lyrics_from_lrclib(artist, title, album, duration)
        if lrclib_data and (lrclib_data.get('synced_lyrics') or lrclib_data.get('plain_lyrics')):
            # If we got lyrics, store them in beets
            lyrics_text = lrclib_data.get('synced_lyrics') or lrclib_data.get('plain_lyrics')
            set_track_lyrics(track_id, lyrics_text, beets_bin)
            return {'message': 'Lyrics fetched and saved successfully'}, 200

        return {'error': 'No lyrics found'}, 404

    except subprocess.CalledProcessError as e:
        logger.error(f"Error fetching track info: {e.stderr}")
        return {'error': f"Failed to fetch track info: {e.stderr}"}, 500
    except Exception as e:
        logger.error(f"Unexpected error while fetching lyrics: {e}")
        return {'error': f"An unexpected error occurred: {e}"}, 500