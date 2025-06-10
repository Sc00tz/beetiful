"""
Configuration management for beets
"""
import os
import yaml
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Configuration paths
beets_config_dir = os.getenv('BEETSDIR', os.path.expanduser('~/.config/beets'))
config_path = os.path.join(beets_config_dir, 'config.yaml')

# Plugin definitions for beets 2.3.1
AVAILABLE_PLUGINS = {
    'fetchart': {
        'built_in': True,
        'description': 'Automatically fetch album artwork',
        'config_template': {
            'auto': True,
            'cautious': True,
            'cover_names': 'cover front art album folder',
            'sources': 'filesystem coverart itunes amazon albumart'
        }
    },
    'lyrics': {
        'built_in': True,
        'description': 'Automatically fetch song lyrics',
        'config_template': {
            'auto': True,
            'sources': 'lrclib genius musixmatch'
        }
    },
    'lastgenre': {
        'built_in': True,
        'description': 'Fetch genres from Last.fm',
        'config_template': {
            'auto': True,
            'source': 'album'
        }
    },
    'discogs': {
        'built_in': True,
        'description': 'Search and tag using Discogs.com',
        'config_template': {
            'token': 'YOUR_DISCOGS_TOKEN'
        }
    },
    'chroma': {
        'built_in': True,
        'description': 'Acoustic fingerprinting using Chromaprint/AcoustID',
        'config_template': {
            'auto': True
        }
    },
    'web': {
        'built_in': True,
        'description': 'Provides a web interface for beets',
        'config_template': {
            'host': '0.0.0.0',
            'port': 8337
        }
    },
    'embedart': {
        'built_in': True,
        'description': 'Embed album art into music files',
        'config_template': {
            'auto': True
        }
    },
    'export': {
        'built_in': True,
        'description': 'Export library data to various formats'
    },
    'replaygain': {
        'built_in': True,
        'description': 'Analyze and store ReplayGain values',
        'config_template': {
            'auto': True
        }
    },
    'badfiles': {
        'built_in': True,
        'description': 'Detect and handle corrupt or unreadable music files'
    },
    'convert': {
        'built_in': True,
        'description': 'Convert audio files to different formats',
        'config_template': {
            'format': 'mp3',
            'dest': '/path/to/converted_music'
        }
    },
    'duplicates': {
        'built_in': True,
        'description': 'Find and manage duplicate tracks'
    },
    'edit': {
        'built_in': True,
        'description': 'Edit metadata from a text editor'
    },
    'info': {
        'built_in': True,
        'description': 'Show detailed track information'
    },
    'missing': {
        'built_in': True,
        'description': 'Find missing tracks in albums'
    },
    'playlist': {
        'built_in': True,
        'description': 'Generate and manage playlists'
    },
    'random': {
        'built_in': True,
        'description': 'Randomly select tracks'
    },
    'smartplaylist': {
        'built_in': True,
        'description': 'Generate smart playlists based on queries',
        'config_template': {
            'relative_to': '/music',
            'playlist_dir': '/music/playlists'
        }
    }
}

def create_default_config():
    """Create a default beets configuration."""
    return {
        'directory': '/music',
        'library': os.path.join(beets_config_dir, 'musiclibrary.db'),
        'import': {
            'move': False,
            'copy': False,
            'write': True,
            'autotag': True,
            'resume': True,
            'incremental': True,
            'duplicate_action': 'skip'
        },
        'paths': {
            'default': '$albumartist/$album%aunique{}/$track $title',
            'singleton': 'Non-Album/$artist/$title',
            'comp': 'Compilations/$album%aunique{}/$track $title'
        },
        'replace': {
            '[\/]': '_',
            '^\.': '_',
            '[\x00-\x1f]': '_',
            '[<>:"\?\*\|]': '_',
            '\.$': '_',
            '\s+$': ''
        },
        'plugins': [],
        'ui': {
            'color': True
        }
    }

def read_config():
    """Reads the beets configuration from config.yaml."""
    if not os.path.exists(config_path):
        default_config = create_default_config()
        write_config(default_config)
        return default_config
    
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f) or {}
            return config
    except Exception as e:
        logger.error(f"Error reading config.yaml: {e}")
        return create_default_config()

def write_config(config_data):
    """Writes the beets configuration to config.yaml."""
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            yaml.safe_dump(config_data, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        logger.error(f"Error writing config.yaml: {e}")
        return False

def get_installed_plugins():
    """Get list of built-in plugins available in beets 2.3.1."""
    installed_plugins = []
    
    try:
        # Check which plugins exist in the beetsplug directory
        import beets
        import pkg_resources
        
        # Get the path to beetsplug
        beets_dist = pkg_resources.get_distribution('beets')
        beetsplug_path = None
        
        # Try to find beetsplug directory
        possible_paths = [
            os.path.join(os.path.dirname(beets.__file__), '..', 'beetsplug'),
            os.path.join(beets_dist.location, 'beetsplug'),
            '/home/beetiful/.local/lib/python3.11/site-packages/beetsplug'
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                beetsplug_path = path
                break
        
        if beetsplug_path:
            logger.info(f"Found beetsplug directory at: {beetsplug_path}")
            
            for plugin_name in AVAILABLE_PLUGINS.keys():
                # Check if plugin file exists
                plugin_file = os.path.join(beetsplug_path, f'{plugin_name}.py')
                plugin_dir = os.path.join(beetsplug_path, plugin_name)
                
                if os.path.exists(plugin_file) or os.path.exists(plugin_dir):
                    installed_plugins.append(plugin_name)
                    logger.debug(f"Found plugin: {plugin_name}")
        else:
            logger.warning("Could not find beetsplug directory")
            # Fallback: assume all built-in plugins are available
            installed_plugins = [name for name, info in AVAILABLE_PLUGINS.items() if info.get('built_in', False)]
        
    except Exception as e:
        logger.error(f"Error checking installed plugins: {e}")
        # Fallback: assume all built-in plugins are available
        installed_plugins = [name for name, info in AVAILABLE_PLUGINS.items() if info.get('built_in', False)]
    
    logger.info(f"Available built-in plugins: {installed_plugins}")
    return installed_plugins