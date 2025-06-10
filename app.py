from flask import Flask, jsonify, request, render_template
import os
import subprocess
import yaml
import json
import shlex
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import re

load_dotenv()

app = Flask(__name__)

# --- Configuration Paths ---
beets_config_dir = os.getenv('BEETSDIR', os.path.expanduser('~/.config/beets'))
config_path = os.path.join(beets_config_dir, 'config.yaml')

# --- Helper Functions ---

def get_beets_bin():
    """Determine the beets executable path."""
    try:
        result = subprocess.run(['which', 'beet'], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return 'beet'
    except:
        pass
    
    # Fallback to common paths
    fallback_paths = ['/usr/local/bin/beet', '/usr/bin/beet', 'beet']
    for path in fallback_paths:
        try:
            result = subprocess.run([path, '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                return path
        except:
            continue
    
    return 'beet'

BEETS_BIN = get_beets_bin()

# Updated plugin definitions for beets 2.3.1 (most are built-in now)
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
            'sources': 'lyricwiki musixmatch genius'
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
        app.logger.error(f"Error reading config.yaml: {e}")
        return create_default_config()

def write_config(config_data):
    """Writes the beets configuration to config.yaml."""
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            yaml.safe_dump(config_data, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        app.logger.error(f"Error writing config.yaml: {e}")
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
            app.logger.info(f"Found beetsplug directory at: {beetsplug_path}")
            
            for plugin_name in AVAILABLE_PLUGINS.keys():
                # Check if plugin file exists
                plugin_file = os.path.join(beetsplug_path, f'{plugin_name}.py')
                plugin_dir = os.path.join(beetsplug_path, plugin_name)
                
                if os.path.exists(plugin_file) or os.path.exists(plugin_dir):
                    installed_plugins.append(plugin_name)
                    app.logger.debug(f"Found plugin: {plugin_name}")
        else:
            app.logger.warning("Could not find beetsplug directory")
            # Fallback: assume all built-in plugins are available
            installed_plugins = [name for name, info in AVAILABLE_PLUGINS.items() if info.get('built_in', False)]
        
    except Exception as e:
        app.logger.error(f"Error checking installed plugins: {e}")
        # Fallback: assume all built-in plugins are available
        installed_plugins = [name for name, info in AVAILABLE_PLUGINS.items() if info.get('built_in', False)]
    
    app.logger.info(f"Available built-in plugins: {installed_plugins}")
    return installed_plugins

def clean_field(value, field_name):
    """Clean field values and handle cases where beets returns literal field names"""
    if not value or value.strip() == '' or value == f'${field_name}':
        return None
    return value.strip()

def is_path_safe(path):
    """Checks if a path is safe to browse."""
    try:
        normalized_path = Path(path).resolve()
        allowed_roots = ['/music', '/config']
        
        for root in allowed_roots:
            try:
                root_path = Path(root).resolve()
                if normalized_path == root_path or root_path in normalized_path.parents:
                    return True
            except:
                continue
        
        return False
    except:
        return False

def format_timestamp(timestamp):
    """Format timestamp for display."""
    try:
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime('%Y-%m-%d %H:%M')
    except:
        return ''

def parse_stats(output):
    """Parse the stats output from beets."""
    lines = output.splitlines()
    stats = {}
    
    for line in lines:
        line = line.strip()
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip().lower()
            value = value.strip()
            
            if 'tracks' in key:
                stats['total_tracks'] = value
            elif 'albums' in key:
                stats['total_albums'] = value
            elif 'artists' in key:
                stats['total_artists'] = value
            elif 'total size' in key:
                stats['total_size'] = value.split()[0]
    
    return stats

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/library')
def get_library():
    try:
        cmd = [BEETS_BIN, 'list', '--format', '$id\t$title\t$artist\t$album\t$genre\t$year\t$length\t$bitrate\t$path']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output_lines = process.stdout.strip().split('\n')
        
        items = []
        for line in output_lines:
            if not line or line.strip() == '':
                continue
            parts = line.split('\t')
            if len(parts) >= 9:
                # Parse year
                year = None
                year_str = clean_field(parts[5], 'year')
                if year_str and year_str.isdigit():
                    try:
                        year = int(year_str)
                    except ValueError:
                        pass

                # Parse length
                length = None
                length_str = clean_field(parts[6], 'length')
                if length_str:
                    match = re.match(r'(\d+):(\d+(?:\.\d+)?)', length_str)
                    if match:
                        minutes = int(match.group(1))
                        seconds = float(match.group(2))
                        length = float(minutes * 60 + seconds)
                    else:
                        try:
                            length = float(length_str)
                        except ValueError:
                            pass

                # Parse bitrate
                bitrate = None
                bitrate_str = clean_field(parts[7], 'bitrate')
                if bitrate_str:
                    bitrate_clean = re.sub(r'kbps$', '', bitrate_str).strip()
                    try:
                        bitrate = int(float(bitrate_clean))
                    except ValueError:
                        pass

                item = {
                    'id': clean_field(parts[0], 'id') or 'unknown',
                    'title': clean_field(parts[1], 'title') or 'Unknown Title',
                    'artist': clean_field(parts[2], 'artist') or 'Unknown Artist',
                    'album': clean_field(parts[3], 'album') or 'Unknown Album',
                    'genre': clean_field(parts[4], 'genre'),
                    'year': year,
                    'length': length,
                    'bitrate': bitrate,
                    'path': clean_field(parts[8], 'path') or ''
                }
                items.append(item)

        return jsonify({'items': items})
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error listing library: {e.stderr}")
        return jsonify({'error': f"Failed to list library: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"Error getting library: {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/library/edit', methods=['POST'])
def edit_library_item():
    try:
        data = request.json
        item_id = data.get('id')
        updates = data.get('updates', {})
        
        if not item_id:
            return jsonify({'error': 'Item ID is required'}), 400
        
        cmd = [BEETS_BIN, 'modify', f'id:{item_id}']
        
        for field, value in updates.items():
            if value:
                cmd.append(f'{field}={value}')
        
        if len(cmd) <= 3:
            return jsonify({'error': 'No updates provided'}), 400
        
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        return jsonify({'message': 'Track updated successfully'})
        
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error editing track: {e.stderr}")
        return jsonify({'error': f"Failed to edit track: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"Error editing track: {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/library/remove', methods=['POST'])
def remove_library_item():
    try:
        data = request.json
        title = data.get('title')
        artist = data.get('artist')
        album = data.get('album')
        
        query_parts = []
        if title:
            query_parts.append(f'title:"{title}"')
        if artist:
            query_parts.append(f'artist:"{artist}"')
        if album:
            query_parts.append(f'album:"{album}"')
        
        if not query_parts:
            return jsonify({'error': 'Title, artist, or album must be provided'}), 400
        
        query = ' '.join(query_parts)
        cmd = [BEETS_BIN, 'remove', '-d', query]
        
        process = subprocess.run(cmd, capture_output=True, text=True, input='y\n', env=os.environ.copy())
        return jsonify({'message': 'Track removed successfully'})
        
    except Exception as e:
        app.logger.error(f"Error removing track: {e}")
        return jsonify({'error': f"Failed to remove track: {e}"}), 500

@app.route('/api/library/delete', methods=['POST'])
def delete_library_item():
    return remove_library_item()

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'GET':
        config = read_config()
        try:
            yaml_string = yaml.safe_dump(config, default_flow_style=False, sort_keys=False)
            return jsonify({'config': yaml_string})
        except Exception as e:
            app.logger.error(f"Error serializing config to YAML: {e}")
            return jsonify({'error': 'Failed to serialize configuration'}), 500
            
    elif request.method == 'POST':
        try:
            data = request.json
            config_string = data.get('config', '')
            
            if not config_string:
                return jsonify({'error': 'Configuration content is required'}), 400
            
            config_data = yaml.safe_load(config_string)
            
            if write_config(config_data):
                return jsonify({'message': 'Configuration saved successfully. Restart the application for changes to take effect.'})
            return jsonify({'error': 'Failed to save configuration.'}), 500
            
        except yaml.YAMLError as e:
            return jsonify({'error': f'Invalid YAML syntax: {e}'}), 400
        except Exception as e:
            app.logger.error(f"Error saving config: {e}")
            return jsonify({'error': 'Failed to save configuration'}), 500

@app.route('/api/plugins', methods=['GET'])
def get_plugins():
    config = read_config()
    enabled_plugins = config.get('plugins', [])
    installed_plugins = get_installed_plugins()

    all_plugins_status = []
    for name, details in AVAILABLE_PLUGINS.items():
        is_installed = name in installed_plugins
        is_enabled = name in enabled_plugins
        is_built_in = details.get('built_in', False)
        
        plugin_info = {
            'name': name,
            'description': details.get('description', 'No description available.'),
            'installed': is_installed,
            'enabled': is_enabled,
            'built_in': is_built_in,
            'config_template': details.get('config_template', {})
        }
        all_plugins_status.append(plugin_info)
    
    return jsonify({'available': all_plugins_status, 'enabled_in_config': enabled_plugins})

@app.route('/api/plugins/enable', methods=['POST'])
def enable_plugin():
    data = request.json
    plugin_name = data.get('plugin_name')

    if not plugin_name:
        return jsonify({'error': 'Plugin name is required.'}), 400

    config = read_config()
    current_plugins = set(config.get('plugins', []))
    current_plugins.add(plugin_name)
    config['plugins'] = sorted(list(current_plugins))

    if write_config(config):
        return jsonify({'message': f"Plugin '{plugin_name}' enabled."})
    return jsonify({'error': 'Failed to enable plugin.'}), 500

@app.route('/api/plugins/disable', methods=['POST'])
def disable_plugin():
    data = request.json
    plugin_name = data.get('plugin_name')

    if not plugin_name:
        return jsonify({'error': 'Plugin name is required.'}), 400

    config = read_config()
    current_plugins = set(config.get('plugins', []))
    current_plugins.discard(plugin_name)
    config['plugins'] = sorted(list(current_plugins))

    if write_config(config):
        return jsonify({'message': f"Plugin '{plugin_name}' disabled."})
    return jsonify({'error': 'Failed to disable plugin.'}), 500

@app.route('/api/plugins/toggle', methods=['POST'])
def toggle_plugin():
    data = request.json
    plugin_name = data.get('plugin_name')
    enable = data.get('enable')

    if not plugin_name:
        return jsonify({'error': 'Plugin name is required.'}), 400

    config = read_config()
    current_plugins = set(config.get('plugins', []))

    if enable:
        current_plugins.add(plugin_name)
    else:
        current_plugins.discard(plugin_name)
    
    config['plugins'] = sorted(list(current_plugins))

    if write_config(config):
        return jsonify({'message': f"Plugin '{plugin_name}' {'enabled' if enable else 'disabled'}."})
    return jsonify({'error': 'Failed to update plugin status.'}), 500

# Remove the install endpoint since plugins are built-in
@app.route('/api/plugins/install', methods=['POST'])
def install_plugin():
    data = request.json
    plugin_name = data.get('plugin_name')

    if not plugin_name:
        return jsonify({'error': 'Plugin name is required.'}), 400

    if plugin_name not in AVAILABLE_PLUGINS:
        return jsonify({'error': f'Unknown plugin: {plugin_name}'}), 400

    plugin_info = AVAILABLE_PLUGINS[plugin_name]
    
    if plugin_info.get('built_in', False):
        return jsonify({
            'message': f"Plugin '{plugin_name}' is built into beets 2.3.1 and doesn't need installation. Click 'Enable' to activate it.",
            'already_available': True
        })
    
    # For any external plugins (if we add them in the future)
    return jsonify({'error': 'External plugin installation not yet implemented for beets 2.3.1'}), 501

@app.route('/api/plugins/config/<plugin_name>', methods=['GET', 'POST'])
def handle_plugin_config(plugin_name):
    if request.method == 'GET':
        config = read_config()
        plugin_config = config.get(plugin_name, {})
        template = AVAILABLE_PLUGINS.get(plugin_name, {}).get('config_template', {})
        
        return jsonify({
            'config': plugin_config,
            'template': template
        })
        
    elif request.method == 'POST':
        config_data = request.json.get('config')
        if not isinstance(config_data, dict):
            return jsonify({'error': 'Invalid configuration data. Must be a dictionary.'}), 400

        full_config = read_config()
        
        if plugin_name not in full_config:
            full_config[plugin_name] = {}
        
        full_config[plugin_name].update(config_data)

        if write_config(full_config):
            return jsonify({'message': f"Configuration for plugin '{plugin_name}' saved successfully."})
        return jsonify({'error': 'Failed to save plugin configuration.'}), 500

@app.route('/api/execute', methods=['POST'])
def execute_command():
    data = request.json
    command = data.get('command')
    args_string = data.get('args', '')
    
    if not command:
        return jsonify({'error': 'Command is required.'}), 400

    allowed_commands = ['import', 'list', 'update', 'modify', 'config', 'version', 'stats']
    if command not in allowed_commands:
        return jsonify({'error': f"Command '{command}' is not allowed."}), 403

    # Parse args string into list with proper handling of quoted paths
    args = []
    if args_string:
        try:
            # Use shlex to properly parse arguments with spaces and quotes
            args = shlex.split(args_string)
        except ValueError as e:
            app.logger.warning(f"Failed to parse args with shlex: {e}, falling back to simple split")
            # If shlex fails, try to handle it manually
            args = []
            current_arg = ""
            in_quotes = False
            i = 0
            while i < len(args_string):
                char = args_string[i]
                if char == '"' and (i == 0 or args_string[i-1] != '\\'):
                    in_quotes = not in_quotes
                elif char == ' ' and not in_quotes:
                    if current_arg:
                        args.append(current_arg)
                        current_arg = ""
                else:
                    current_arg += char
                i += 1
            if current_arg:
                args.append(current_arg)

    # Build the full command
    full_cmd = [BEETS_BIN, command] + args
    
    try:
        if command == 'import':
            app.logger.info(f"Executing import command: {full_cmd}")
            # For debugging, also log the raw args
            app.logger.info(f"Raw args string: '{args_string}'")
            app.logger.info(f"Parsed args: {args}")
        
        # Use subprocess with proper argument handling
        process = subprocess.run(
            full_cmd, 
            capture_output=True, 
            text=True, 
            check=True, 
            env=os.environ.copy(),
            timeout=300
        )
        return jsonify({
            'message': 'Command executed successfully', 
            'output': process.stdout, 
            'error': process.stderr
        })
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Command failed: {full_cmd}")
        app.logger.error(f"Exit code: {e.returncode}")
        app.logger.error(f"Stdout: {e.stdout}")
        app.logger.error(f"Stderr: {e.stderr}")
        return jsonify({
            'message': 'Command failed', 
            'output': e.stdout, 
            'error': e.stderr
        }), 200
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Command timed out after 5 minutes'}), 500
    except Exception as e:
        app.logger.error(f"Error running command: {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/command', methods=['POST'])
def run_command():
    return execute_command()

@app.route('/api/browse', methods=['GET'])
def browse_files():
    path = request.args.get('path', '/')
    
    if not is_path_safe(path):
        return jsonify({'error': 'Access denied to this path.'}), 403

    try:
        items = []
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.is_dir():
                    items.append({
                        'name': entry.name,
                        'path': entry.path,
                        'type': 'directory',
                        'size': None,
                        'modified': format_timestamp(entry.stat().st_mtime)
                    })
                elif entry.is_file():
                    items.append({
                        'name': entry.name,
                        'path': entry.path,
                        'type': 'file',
                        'size': entry.stat().st_size,
                        'modified': format_timestamp(entry.stat().st_mtime)
                    })
        
        items.sort(key=lambda x: (x['type'] != 'directory', x['name'].lower()))
        parent_path = str(Path(path).parent) if path != '/' else None

        return jsonify({'current_path': path, 'parent_path': parent_path, 'items': items})
    except FileNotFoundError:
        return jsonify({'error': 'Path not found.'}), 404
    except PermissionError:
        return jsonify({'error': 'Permission denied.'}), 403
    except Exception as e:
        app.logger.error(f"Error browsing path '{path}': {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

# Add lyrics endpoints
@app.route('/api/library/lyrics/<track_id>', methods=['GET', 'POST'])
def handle_lyrics(track_id):
    if request.method == 'GET':
        try:
            # Get lyrics from beets database
            cmd = [BEETS_BIN, 'list', '--format', '$lyrics', f'id:{track_id}']
            process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
            lyrics = process.stdout.strip()
            
            # If no lyrics in database, check if lyrics plugin can fetch them
            if not lyrics or lyrics == '$lyrics':
                lyrics = None
            
            return jsonify({'lyrics': lyrics})
            
        except subprocess.CalledProcessError as e:
            app.logger.error(f"Error getting lyrics: {e.stderr}")
            return jsonify({'error': f"Failed to get lyrics: {e.stderr}"}), 500
        except Exception as e:
            app.logger.error(f"Error getting lyrics: {e}")
            return jsonify({'error': f"An unexpected error occurred: {e}"}), 500
    
    elif request.method == 'POST':
        try:
            data = request.json
            lyrics = data.get('lyrics', '')
            
            # Set lyrics using beets modify command
            cmd = [BEETS_BIN, 'modify', f'id:{track_id}', f'lyrics={lyrics}']
            process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
            
            return jsonify({'message': 'Lyrics updated successfully'})
            
        except subprocess.CalledProcessError as e:
            app.logger.error(f"Error setting lyrics: {e.stderr}")
            return jsonify({'error': f"Failed to set lyrics: {e.stderr}"}), 500
        except Exception as e:
            app.logger.error(f"Error setting lyrics: {e}")
            return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/library/fetch-lyrics/<track_id>', methods=['POST'])
def fetch_lyrics(track_id):
    """Fetch lyrics using the beets lyrics plugin."""
    try:
        # Use beets lyrics plugin to fetch lyrics
        cmd = [BEETS_BIN, 'lyrics', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        
        return jsonify({'message': 'Lyrics fetch attempted', 'output': process.stdout})
        
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error fetching lyrics: {e.stderr}")
        return jsonify({'error': f"Failed to fetch lyrics: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"Error fetching lyrics: {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500
def get_stats():
    try:
        cmd = [BEETS_BIN, 'stats']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        stats_output = process.stdout
        
        stats = parse_stats(stats_output)
        return jsonify(stats)
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error getting beets stats: {e.stderr}")
        return jsonify({'error': f"Failed to get stats: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"Error getting stats: {e}")
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

# Run the app
port = int(os.getenv('FLASK_PORT', 5000))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')