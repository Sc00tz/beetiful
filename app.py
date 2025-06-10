from flask import Flask, jsonify, request, render_template
import os
import subprocess
import yaml
import pkg_resources
import json
import stat
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import re # Add this line

load_dotenv()

app = Flask(__name__)

# --- Configuration Paths ---
beets_config_dir = os.getenv('BEETSDIR', os.path.expanduser('~/.config/beets'))
config_path = os.path.join(beets_config_dir, 'config.yaml')

# --- Helper Functions ---

def get_beets_bin():
    """Determine the beets executable path."""
    # Check if beets is available directly in PATH
    if subprocess.run(['which', 'beet'], capture_output=True).returncode == 0:
        return 'beet'
    # Fallback to a common Python script path if 'beet' isn't directly in PATH
    # This might need adjustment based on the Docker environment
    return '/usr/local/bin/beet' # Common path for pip-installed executables in Docker

BEETS_BIN = get_beets_bin()

# Plugin definitions with their pip package names and descriptions
AVAILABLE_PLUGINS = {
    'fetchart': {
        'pip_name': 'beets[fetchart]',
        'description': 'Automatically fetch album artwork',
        'config_template': {
            'auto': True,
            'cautious': True,
            'cover_names': 'cover front art album folder',
            'sources': 'filesystem coverart itunes amazon albumart'
        }
    },
    'lyrics': {
        'pip_name': 'beets[lyrics]',
        'description': 'Automatically fetch song lyrics',
        'config_template': {
            'auto': True,
            'sources': 'lyricwiki musixmatch genius'
        }
    },
    'lastgenre': {
        'pip_name': 'beets[lastgenre]',
        'description': 'Fetch genres from Last.fm',
        'config_template': {
            'auto': True,
            'source': 'album'
        }
    },
    'discogs': {
        'pip_name': 'beets[discogs]',
        'description': 'Search and tag using Discogs.com',
        'config_template': {
            'token': 'YOUR_DISCOGS_TOKEN' # User should replace this
        }
    },
    'chroma': {
        'pip_name': 'beets[chroma]',
        'description': 'Acoustic fingerprinting using Chromaprint/AcoustID',
        'config_template': {
            'auto': True
        }
    },
    'web': {
        'pip_name': 'beets[web]',
        'description': 'Provides a web interface for beets',
        'config_template': {
            'host': '0.0.0.0',
            'port': 8337
        }
    },
    'embedart': {
        'pip_name': 'beets[embedart]',
        'description': 'Embed album art into music files'
    },
    'export': {
        'pip_name': 'beets[export]',
        'description': 'Export library data to various formats (e.g., JSON, CSV)'
    },
    'replaygain': {
        'pip_name': 'beets[replaygain]',
        'description': 'Analyze and store ReplayGain values',
        'config_template': {
            'auto': True
        }
    },
    'badfiles': {
        'pip_name': 'beets[badfiles]',
        'description': 'Detect and handle corrupt or unreadable music files'
    },
    'convert': {
        'pip_name': 'beets[convert]',
        'description': 'Convert audio files to different formats',
        'config_template': {
            'auto': False,
            'format': 'mp3',
            'dest': '/path/to/converted_music' # User should configure this
        }
    }
}


def read_config():
    """Reads the beets configuration from config.yaml."""
    if not os.path.exists(config_path):
        return {}
    try:
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        app.logger.error(f"Error reading config.yaml: {e}")
        return {}

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
    """Get a list of currently installed beets plugins."""
    try:
        cmd = [BEETS_BIN, 'version']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True)
        output = process.stdout
        # Example output line: 'plugins: fetchart lyrics'
        plugins_line = next((line for line in output.splitlines() if 'plugins:' in line), None)
        if plugins_line:
            # Extract plugin names, strip 'plugins:' and whitespace
            plugins_str = plugins_line.split('plugins:')[1].strip()
            return [p.strip() for p in plugins_str.split(' ') if p.strip()]
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error running 'beets version': {e.stderr}")
    except Exception as e:
        app.logger.error(f"An unexpected error occurred while getting installed plugins: {e}")
    return []

def get_plugin_pip_name(plugin_name):
    """Maps a plugin name to its pip package name."""
    return AVAILABLE_PLUGINS.get(plugin_name, {}).get('pip_name', f'beets[{plugin_name}]')

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

# API to get all library items
@app.route('/api/library')
def get_library():
    try:
        # Use 'beet list -a' to get all items in a structured format
        cmd = [BEETS_BIN, 'list', '-a', '--format', '$id\t$title\t$artist\t$album\t$genre\t$year\t$length\t$bitrate\t$path']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        output_lines = process.stdout.strip().split('\n')
        
        items = []
        for line in output_lines:
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) == 9:
                # Safely parse fields, handling literal '$' variables and specific formats
                
                # Year parsing (from string to int, handling '$year' or non-digits)
                year = None
                year_str = parts[5]
                if year_str.isdigit():
                    try:
                        year = int(year_str)
                    except ValueError:
                        pass # year remains None

                # Length parsing (from MM:SS or $length to seconds as float)
                length = None
                length_str = parts[6]
                if length_str and length_str != '$length': # Exclude empty string and literal '$length'
                    match = re.match(r'(\d+):(\d+)', length_str)
                    if match:
                        minutes = int(match.group(1))
                        seconds = int(match.group(2))
                        length = float(minutes * 60 + seconds)
                    else:
                        # Fallback for raw float if not MM:SS (e.g., if Beets outputs raw seconds)
                        try:
                            length = float(length_str)
                        except ValueError:
                            pass # length remains None if not parseable

                # Bitrate parsing (from Nkbps or $bitrate to N as int)
                bitrate = None
                bitrate_str = parts[7]
                if bitrate_str and bitrate_str != '$bitrate': # Exclude empty string and literal '$bitrate'
                    match = re.match(r'(\d+)kbps', bitrate_str)
                    if match:
                        bitrate = int(match.group(1))
                    else:
                        # Fallback for raw int if not Nkbps
                        try:
                            bitrate = int(bitrate_str)
                        except ValueError:
                            pass # bitrate remains None if not parseable

                item = {
                    'id': parts[0],
                    'title': parts[1], # Will be '$title' if not expanded (though for id:1 it's 'Mamma Mia')
                    'artist': parts[2], # Will be '$artist' if not expanded (though for id:1 it's 'ABBA')
                    'album': parts[3],
                    'genre': parts[4],
                    'year': year,
                    'length': length,
                    'bitrate': bitrate,
                    'path': parts[8]
                }
                items.append(item)
            else:
                app.logger.warning(f"Skipping malformed line from 'beet list': {line}")

        return jsonify({'items': items})
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error listing library: {e.stderr}", exc_info=True)
        return jsonify({'error': f"Failed to list library: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred while getting library: {e}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500


@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'GET':
        config = read_config()
        return jsonify(config)
    elif request.method == 'POST':
        config_data = request.json
        if write_config(config_data):
            return jsonify({'message': 'Configuration saved successfully. Restart the application for changes to take effect.'})
        return jsonify({'error': 'Failed to save configuration.'}), 500

@app.route('/api/plugins', methods=['GET'])
def get_plugins():
    config = read_config()
    enabled_plugins = config.get('plugins', [])
    installed_plugins = get_installed_plugins()

    all_plugins_status = []
    for name, details in AVAILABLE_PLUGINS.items():
        is_installed = name in installed_plugins
        is_enabled = name in enabled_plugins
        
        plugin_info = {
            'name': name,
            'description': details.get('description', 'No description available.'),
            'installed': is_installed,
            'enabled': is_enabled,
            'config_template': details.get('config_template', {})
        }
        all_plugins_status.append(plugin_info)
    
    return jsonify({'available': all_plugins_status, 'enabled_in_config': enabled_plugins})


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
    
    config['plugins'] = sorted(list(current_plugins)) # Ensure list and sorted

    if write_config(config):
        return jsonify({'message': f"Plugin '{plugin_name}' {'enabled' if enable else 'disabled'}."})
    return jsonify({'error': 'Failed to update plugin status.'}), 500


@app.route('/api/plugins/install', methods=['POST'])
def install_plugin():
    data = request.json
    plugin_name = data.get('plugin_name')

    if not plugin_name:
        return jsonify({'error': 'Plugin name is required.'}), 400

    pip_package_name = get_plugin_pip_name(plugin_name)

    try:
        # Use a subprocess to run pip install
        # Consider using a virtual environment or ensuring correct permissions
        process = subprocess.run(
            ['pip', 'install', pip_package_name],
            capture_output=True,
            text=True,
            check=True,
            env=os.environ.copy() # Pass current environment variables
        )
        app.logger.info(f"Pip install output for {pip_package_name}: {process.stdout}")
        return jsonify({'message': f"Plugin '{plugin_name}' installed successfully."})
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error installing plugin {plugin_name}: {e.stderr}", exc_info=True)
        return jsonify({'error': f"Failed to install plugin '{plugin_name}': {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during plugin installation: {e}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred while installing plugin '{plugin_name}': {e}"}), 500

@app.route('/api/plugins/config/<plugin_name>', methods=['POST'])
def save_plugin_config(plugin_name):
    config_data = request.json.get('config')
    if not isinstance(config_data, dict):
        return jsonify({'error': 'Invalid configuration data. Must be a dictionary.'}), 400

    full_config = read_config()
    
    # Ensure the plugin's configuration section exists
    if plugin_name not in full_config:
        full_config[plugin_name] = {}
    
    # Update the plugin's configuration
    full_config[plugin_name].update(config_data)

    if write_config(full_config):
        return jsonify({'message': f"Configuration for plugin '{plugin_name}' saved successfully."})
    return jsonify({'error': 'Failed to save plugin configuration.'}), 500

@app.route('/api/command', methods=['POST'])
def run_command():
    data = request.json
    command = data.get('command')
    args = data.get('args', [])

    if not command:
        return jsonify({'error': 'Command is required.'}), 400

    # Basic whitelist for security
    allowed_commands = ['import', 'list', 'update', 'modify', 'config', 'version', 'stats']
    if command not in allowed_commands:
        return jsonify({'error': f"Command '{command}' is not allowed."}), 403

    full_cmd = [BEETS_BIN, command] + args
    
    try:
        process = subprocess.run(full_cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        return jsonify({'output': process.stdout, 'error': process.stderr})
    except subprocess.CalledProcessError as e:
        return jsonify({'output': e.stdout, 'error': e.stderr}), 500
    except Exception as e:
        app.logger.error(f"Error running command '{' '.join(full_cmd)}': {e}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500


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
                        'size': format_size(entry.stat().st_size),
                        'modified': format_timestamp(entry.stat().st_mtime)
                    })
        
        # Sort directories first, then files, both alphabetically
        items.sort(key=lambda x: (x['type'] != 'directory', x['name'].lower()))

        parent_path = str(Path(path).parent) if path != '/' else None

        return jsonify({'current_path': path, 'parent_path': parent_path, 'items': items})
    except FileNotFoundError:
        return jsonify({'error': 'Path not found.'}), 404
    except PermissionError:
        return jsonify({'error': 'Permission denied.'}), 403
    except Exception as e:
        app.logger.error(f"Error Browse path '{path}': {e}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        cmd = [BEETS_BIN, 'stats']
        process = subprocess.run(cmd, capture_output=True, text=True, check=True, env=os.environ.copy())
        stats_output = process.stdout
        
        stats = parse_stats(stats_output)
        return jsonify(stats)
    except subprocess.CalledProcessError as e:
        app.logger.error(f"Error getting beets stats: {e.stderr}", exc_info=True)
        return jsonify({'error': f"Failed to get stats: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred while getting stats: {e}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

# --- File Browser Helper Functions (from your provided filebrowser.js, adapted for Python) ---
def format_size(bytes, decimals=2):
    """Format bytes into human-readable string."""
    if bytes == 0:
        return '0 Bytes'
    k = 1024
    dm = decimals if decimals >= 0 else 0
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    i = int(os.path.floor(os.log(bytes) / os.log(k)))
    return f"{round(bytes / (k ** i), dm)} {sizes[i]}"

def is_path_safe(path):
    """
    Checks if a path is safe to browse.
    Prevents directory traversal attacks.
    """
    normalized_path = Path(path).resolve()
    
    # Disallow paths that try to escape into sensitive areas outside allowed roots
    # Example: Disallow if it contains '..' at root or points to /etc, /dev etc.
    dangerous_starts = ['/etc', '/dev', '/proc', '/sys', '/run']
    for dangerous in dangerous_starts:
        if normalized_path.as_posix().startswith(dangerous):
            return False
    
    # Only allow certain root directories
    # Ensure these are paths *inside the container* that you intend to be browsable
    # Add any other root paths that are explicitly mounted or part of the container's browsable filesystem
    allowed_roots = ['/', '/music', '/config'] 
    
    # Check if path starts with an allowed root
    for root in allowed_roots:
        if normalized_path.as_posix().startswith(root):
            return True
    
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
        if 'Tracks:' in line:
            stats['total_tracks'] = line.split(': ')[1]
        elif 'Albums:' in line:
            stats['total_albums'] = line.split(': ')[1]
        elif 'Artists:' in line:
            stats['total_artists'] = line.split(': ')[1]
        elif 'Total size:' in line:
            stats['total_size'] = line.split(': ')[1].split(' ')[0]  
    return stats

# Read port from environment variable, defaulting to 5000 if not set
port = int(os.getenv('FLASK_PORT', 5000))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')