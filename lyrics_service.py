"""
Lyrics service combining beets and LRCLib functionality
"""
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
    """Get lyrics for a track, trying multiple sources."""
    try:
        # Get track info from beets first
        cmd = [beets_bin, 'list', '--format', '$lyrics\t$path\t$artist\t$title\t$album\t$length', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output = process.stdout.strip()
        
        if not output or output == '$lyrics\t$path\t$artist\t$title\t$album\t$length':
            return {'lyrics': None, 'type': 'none'}
        
        parts = output.split('\t')
        beets_lyrics = parts[0] if parts[0] != '$lyrics' else None
        track_path = parts[1] if len(parts) > 1 and parts[1] != '$path' else None
        artist = parts[2] if len(parts) > 2 and parts[2] != '$artist' else None
        title = parts[3] if len(parts) > 3 and parts[3] != '$title' else None
        album = parts[4] if len(parts) > 4 and parts[4] != '$album' else None
        length_str = parts[5] if len(parts) > 5 and parts[5] != '$length' else None
        
        # Parse duration for LRCLib matching
        duration = None
        if length_str:
            match = re.match(r'(\d+):(\d+(?:\.\d+)?)', length_str)
            if match:
                minutes = int(match.group(1))
                seconds = float(match.group(2))
                duration = float(minutes * 60 + seconds)
        
        # Try to find LRC file if no lyrics in database
        lrc_lyrics = None
        if track_path:
            lrc_lyrics = find_lrc_file(track_path)
        
        # If no lyrics found in beets or LRC files, try LRCLib API
        lrclib_data = None
        if not beets_lyrics and not lrc_lyrics and artist and title:
            lrclib_data = fetch_lyrics_from_lrclib(artist, title, album, duration)
        
        # Determine which lyrics to use
        lyrics_text = lrc_lyrics or beets_lyrics
        
        # If we got LRCLib data, use it
        if lrclib_data:
            if lrclib_data.get('synced_lyrics'):
                lyrics_text = lrclib_data['synced_lyrics']
            elif lrclib_data.get('plain_lyrics'):
                lyrics_text = lrclib_data['plain_lyrics']
        
        if lyrics_text:
            parsed_lyrics = parse_lrc_lyrics(lyrics_text)
            
            # Store lyrics in beets database if we got them from LRCLib
            if lrclib_data and (lrclib_data.get('synced_lyrics') or lrclib_data.get('plain_lyrics')):
                store_lyrics_in_beets(track_id, lrclib_data, beets_bin)
            
            return {
                'lyrics': parsed_lyrics['plain'],
                'timed_lyrics': parsed_lyrics.get('timed'),
                'type': parsed_lyrics['type'],
                'source': lrclib_data['source'] if lrclib_data else 'file'
            }
        else:
            return {'lyrics': None, 'type': 'none'}
        
    except Exception as e:
        logger.error(f"Error getting lyrics: {e}")
        raise

def find_lrc_file(track_path):
    """Find LRC file for a track."""
    lrc_lyrics = None
    
    # Check for LRC file next to the music file
    music_file = Path(track_path)
    lrc_file = music_file.with_suffix('.lrc')
    
    if lrc_file.exists():
        try:
            with open(lrc_file, 'r', encoding='utf-8') as f:
                lrc_lyrics = f.read()
        except Exception as e:
            logger.warning(f"Could not read LRC file {lrc_file}: {e}")
    
    # Also check in configured lrc_dir
    if not lrc_lyrics:
        config = read_config()
        lrc_dir = config.get('lyrics', {}).get('lrc_dir')
        if lrc_dir:
            lrc_file_alt = Path(lrc_dir) / f"{music_file.stem}.lrc"
            if lrc_file_alt.exists():
                try:
                    with open(lrc_file_alt, 'r', encoding='utf-8') as f:
                        lrc_lyrics = f.read()
                except Exception as e:
                    logger.warning(f"Could not read LRC file {lrc_file_alt}: {e}")
    
    return lrc_lyrics

def store_lyrics_in_beets(track_id, lrclib_data, beets_bin):
    """Store lyrics from LRCLib in beets database - prioritizing synced lyrics."""
    try:
        # Prefer synced lyrics, fall back to plain lyrics
        lyrics_to_store = lrclib_data.get('synced_lyrics') or lrclib_data.get('plain_lyrics')
        
        if not lyrics_to_store:
            return False
        
        # Use the -y flag to auto-confirm and pass as separate arguments
        cmd = [beets_bin, 'modify', '-y', f'id:{track_id}', f'lyrics={lyrics_to_store}']
        process = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            env=os.environ.copy()
        )
        
        if process.returncode == 0:
            lyrics_type = "synced" if lrclib_data.get('synced_lyrics') else "plain"
            logger.info(f"Stored {lyrics_type} lyrics from LRCLib for track {track_id}")
            return True
        else:
            logger.warning(f"Beets modify failed: returncode={process.returncode}, stdout='{process.stdout}', stderr='{process.stderr}'")
            return False
                
    except Exception as e:
        logger.warning(f"Could not store lyrics in beets database: {e}")
        return False

def fetch_lyrics_for_track(track_id, beets_bin):
    """Fetch lyrics using LRCLib API directly, with beets plugin as fallback."""
    try:
        # Get track info from beets
        cmd = [beets_bin, 'list', '--format', '$artist\t$title\t$album\t$length', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output = process.stdout.strip()
        
        if not output:
            return {'error': 'Track not found'}, 404
        
        parts = output.split('\t')
        artist = parts[0] if parts[0] != '$artist' else None
        title = parts[1] if len(parts) > 1 and parts[1] != '$title' else None
        album = parts[2] if len(parts) > 2 and parts[2] != '$album' else None
        length_str = parts[3] if len(parts) > 3 and parts[3] != '$length' else None
        
        # Parse duration
        duration = None
        if length_str:
            match = re.match(r'(\d+):(\d+(?:\.\d+)?)', length_str)
            if match:
                minutes = int(match.group(1))
                seconds = float(match.group(2))
                duration = float(minutes * 60 + seconds)
        
        if not artist or not title:
            return {'error': 'Artist and title are required for lyrics fetching'}, 400
        
        # Try LRCLib first
        lrclib_data = fetch_lyrics_from_lrclib(artist, title, album, duration)
        
        if lrclib_data and (lrclib_data.get('synced_lyrics') or lrclib_data.get('plain_lyrics')):
            # Store the lyrics in beets database
            store_lyrics_in_beets(track_id, lrclib_data, beets_bin)
            
            return {
                'message': 'Lyrics fetched successfully from LRCLib',
                'source': 'lrclib',
                'has_timed': bool(lrclib_data.get('synced_lyrics'))
            }, 200
        
        # Fallback to beets lyrics plugin
        logger.info("LRCLib fetch failed, trying beets lyrics plugin")
        cmd = [beets_bin, 'lyrics', '-f', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        
        return {
            'message': 'Lyrics fetch attempted with beets plugin',
            'output': process.stdout,
            'source': 'beets'
        }, 200
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error fetching lyrics: {e.stderr}")
        return {'error': f"Failed to fetch lyrics: {e.stderr}"}, 500
    except Exception as e:
        logger.error(f"Error fetching lyrics: {e}")
        return {'error': f"An unexpected error occurred: {e}"}, 500

def set_track_lyrics(track_id, lyrics, beets_bin):
    """Set lyrics for a track."""
    try:
        cmd = [beets_bin, 'modify', f'id:{track_id}', f'lyrics={lyrics}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        return {'message': 'Lyrics updated successfully'}
    except subprocess.CalledProcessError as e:
        logger.error(f"Error setting lyrics: {e.stderr}")
        return {'error': f"Failed to set lyrics: {e.stderr}"}, 500
    except Exception as e:
        logger.error(f"Error setting lyrics: {e}")
        return {'error': f"An unexpected error occurred: {e}"}, 500