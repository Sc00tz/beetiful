"""Main Flask application for Beetiful web UI

Initializes app, defines routes, and integrates all services.
"""

from flask import Flask, jsonify, request, render_template
import os
import subprocess
import yaml
import json
import shlex
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Import our modular services
from beets_utils import get_beets_bin, clean_field, parse_stats
from config_manager import (
    AVAILABLE_PLUGINS, read_config, write_config, 
    get_installed_plugins, create_default_config
)
from lyrics_service import get_track_lyrics, set_track_lyrics, fetch_lyrics_for_track
from lrclib_service import parse_duration

load_dotenv()

# Create Flask app
app = Flask(__name__)

# Get beets binary path
BEETS_BIN = get_beets_bin()

# --- Utility Functions ---

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

def run_beets_command(args):
    # Ensure --yes is present for non-interactive mode
    if isinstance(args, list):
        if '--yes' not in args and '-y' not in args:
            args.append('--yes')
    elif isinstance(args, str):
        if '--yes' not in args and '-y' not in args:
            args += ' --yes'
    # Run the beets command
    result = subprocess.run(args, capture_output=True, text=True)
    return result

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/library')
def get_library():
    """Fetches the entire music library from beets."""
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

                # Parse length for library tracks only, not for lyrics
                length = None
                length_str = clean_field(parts[6], 'length')
                if length_str:
                    length = parse_duration(length_str)

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
    """Edits a specific item in the music library."""
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
    """Removes an item from the music library."""
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
    """Deletes an item from the music library (alias for remove)."""
    return remove_library_item()

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    """Handles retrieval and updating of the main configuration."""
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
    """Retrieves the status of all available and installed plugins."""
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
    """Enables a plugin by adding it to the config."""
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
    """Disables a plugin by removing it from the config."""
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
    """Toggles a plugin's enabled/disabled state."""
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

@app.route('/api/plugins/install', methods=['POST'])
def install_plugin():
    """Installs a new plugin (if external) or enables a built-in plugin."""
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
    
    return jsonify({'error': 'External plugin installation not yet implemented for beets 2.3.1'}), 501

@app.route('/api/plugins/config/<plugin_name>', methods=['GET', 'POST'])
def handle_plugin_config(plugin_name):
    """Retrieves or updates the configuration for a specific plugin."""
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
    """Executes a beets command with the given arguments."""
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
            args = shlex.split(args_string)
        except ValueError as e:
            app.logger.warning(f"Failed to parse args with shlex: {e}, falling back to simple split")
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

    # Ensure all beets commands are non-interactive by adding '--yes' if not present
    if command.startswith('beet') and '--yes' not in command and '-y' not in command:
        command += ' --yes'
    
    try:
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
    """Runs a beets command (alias for execute)."""
    return execute_command()

@app.route('/api/browse', methods=['GET'])
def browse_files():
    """Browses files and directories at the given path."""
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

# Lyrics endpoints using the modular service
@app.route('/api/library/lyrics/<track_id>', methods=['GET', 'POST'])
def handle_lyrics(track_id):
    """Retrieves or updates lyrics for a specific track."""
    if request.method == 'GET':
        try:
            result = get_track_lyrics(track_id, BEETS_BIN)
            # Always return a JSON object with a 'lyrics' field containing the lyrics as a string
            lyrics = ''
            if isinstance(result, dict):
                lyrics = result.get('lyrics', '')
            elif isinstance(result, str):
                lyrics = result
            if not isinstance(lyrics, str):
                lyrics = str(lyrics) if lyrics is not None else ''
            return jsonify({'lyrics': lyrics})
        except Exception as e:
            return jsonify({'error': f"An unexpected error occurred: {e}"}), 500
    
    elif request.method == 'POST':
        try:
            data = request.json
            lyrics = data.get('lyrics', '')
            result = set_track_lyrics(track_id, lyrics, BEETS_BIN)
            if 'error' in result:
                return jsonify(result), result.get('status', 500)
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/library/fetch-lyrics/<track_id>', methods=['POST'])
def fetch_lyrics(track_id):
    """Fetch lyrics using LRCLib API directly, with beets plugin as fallback."""
    try:
        result, status_code = fetch_lyrics_for_track(track_id, BEETS_BIN)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/stats')
def get_stats():
    """Retrieves statistics about the music library from beets."""
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

# Custom get_track_lyrics function to fetch only the lyrics field for a track using beets CLI
def get_track_lyrics(track_id, beets_bin):
    """Fetch lyrics for a track by ID using beets CLI."""
    import subprocess
    try:
        # Use beets to get only the lyrics field for the given track
        cmd = [beets_bin, 'ls', '-f', '$lyrics', f'id:{track_id}']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lyrics = process.stdout.strip()
        return lyrics
    except Exception as e:
        return ''

# Run the app
port = int(os.getenv('FLASK_PORT', 5000))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')