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

load_dotenv()

app = Flask(__name__)

beets_config_dir = os.getenv('BEETSDIR', os.path.expanduser('~/.config/beets'))
config_path = os.path.join(beets_config_dir, 'config.yaml')

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
        'description': 'Search and tag from Discogs database',
        'config_template': {
            'source_weight': 0.5
        }
    },
    'replaygain': {
        'pip_name': 'beets[replaygain]',
        'description': 'Calculate ReplayGain values',
        'config_template': {
            'auto': False,
            'backend': 'command',
            'command': 'mp3gain'
        }
    },
    'chroma': {
        'pip_name': 'beets[chroma]',
        'description': 'Use acoustic fingerprinting for matching',
        'config_template': {
            'auto': True
        }
    },
    'convert': {
        'pip_name': 'beets[convert]',
        'description': 'Convert audio between formats',
        'config_template': {
            'dest': '/converted',
            'format': 'mp3',
            'formats': {
                'mp3': 'ffmpeg -i $source -y -vn -acodec mp3 -ab 320k $dest'
            }
        }
    },
    'duplicates': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'Find and list duplicate tracks',
        'config_template': {}
    },
    'info': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'Show detailed track information',
        'config_template': {}
    },
    'missing': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'List missing albums from artists',
        'config_template': {}
    },
    'play': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'Play tracks from the command line',
        'config_template': {
            'command': 'mpv $args'
        }
    },
    'scrub': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'Remove extraneous metadata',
        'config_template': {
            'auto': False
        }
    },
    'smart_playlist': {
        'pip_name': 'beets',  # Built-in plugin
        'description': 'Generate smart playlists',
        'config_template': {}
    }
}

@app.route('/api/config', methods=['GET'])
def view_config():
    """Fetch the configuration as raw text."""
    try:
        with open(config_path, 'r') as file:
            config_text = file.read()
        return config_text, 200
    except FileNotFoundError:
        return "Config file not found.", 404
    except Exception as e:
        return f"Error loading config: {str(e)}", 500

@app.route('/api/config', methods=['POST'])
def edit_config():
    """Save the configuration as raw text."""
    try:
        config_text = request.data.decode('utf-8')  
        with open(config_path, 'w') as file:
            file.write(config_text)  
        return jsonify({'message': 'Configuration updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f"Failed to save configuration: {str(e)}"}), 500

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Fetch statistics from beets."""
    result = subprocess.run(['beet', 'stats'], capture_output=True, text=True)
    if result.returncode == 0:
        stats = parse_stats(result.stdout)
        return jsonify(stats)
    else:
        return jsonify({'error': result.stderr}), 500

@app.route('/api/run-command', methods=['POST'])
def run_command():
    """Run a command using beets."""
    command = request.json.get('command')
    options = request.json.get('options', [])
    arguments = request.json.get('arguments', [])

    full_command = ['beet', command] + options + arguments

    try:
        result = subprocess.run(full_command, capture_output=True, text=True)
        if result.returncode == 0:
            return jsonify({'output': result.stdout.splitlines()})
        else:
            return jsonify({'error': result.stderr}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/library', methods=['GET'])
def get_library():
    """Fetch the library items including genre information."""
    result = subprocess.run(['beet', 'list', '-f', '$title@@$artist@@$album@@$genre@@$year@@$bpm@@$composer@@$comments'], capture_output=True, text=True)
    if result.returncode == 0:
        items = [parse_library_item(line) for line in result.stdout.splitlines()]
        return jsonify({'items': items})
    else:
        return jsonify({'error': result.stderr}), 500

def parse_library_item(line):
    """Parse a library item from the list output."""
    fields = line.split('@@')  
    return {
        'title': fields[0] if len(fields) > 0 else '',
        'artist': fields[1] if len(fields) > 1 else '',
        'album': fields[2] if len(fields) > 2 else '',
        'genre': fields[3] if len(fields) > 3 else '',
        'year': fields[4] if len(fields) > 4 else '',
        'bpm': fields[5] if len(fields) > 5 else '',
        'composer': fields[6] if len(fields) > 6 else '',
        'comments': fields[7] if len(fields) > 7 else ''
    }

@app.route('/api/library/remove', methods=['POST'])
def remove_track():
    data = request.json
    title = data.get('title')
    artist = data.get('artist')
    album = data.get('album')

    id_command = ['beet', 'list', '-f', '$id', f'title:{title}', f'artist:{artist}', f'album:{album}']
    id_result = subprocess.run(id_command, capture_output=True, text=True)

    if id_result.returncode != 0 or not id_result.stdout.strip():
        print(f"Error finding track ID: {id_result.stderr}")
        return jsonify({'error': 'Track not found for removal.'}), 500

    track_id = id_result.stdout.strip()
    print(f"Found track ID: {track_id}")

    remove_command = ['beet', 'remove', '-f', f'id:{track_id}']
    print(f"Executing remove command: {' '.join(remove_command)}")

    try:
        result = subprocess.run(remove_command, capture_output=True, text=True, check=True)
        print("Track removed from library.")
        return jsonify({'message': 'Track removed from library.'})
    except subprocess.CalledProcessError as e:
        print(f"Error removing track: {e.stderr}")
        return jsonify({'error': e.stderr}), 500

@app.route('/api/library/delete', methods=['POST'])
def delete_track():
    data = request.json
    print(f"Delete request received with data: {data}")  
    title = data.get('title')
    artist = data.get('artist')
    album = data.get('album')

    if not title or not artist or not album:
        print("Error: Missing required fields for delete command.")  
        return jsonify({'error': 'Missing required fields'}), 400

    command = ['beet', 'remove', '-f', f'title:{title}', f'artist:{artist}', f'album:{album}']
    print(f"Executing delete command: {' '.join(command)}") 

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print("Track deleted successfully.")  
        return jsonify({'message': 'Track removed from library.'})
    except subprocess.CalledProcessError as e:
        print(f"Error deleting track: {e.stderr}")  
        return jsonify({'error': e.stderr}), 500

@app.route('/api/library/update', methods=['POST'])
def update_track():
    data = request.json
    original_title = data.get('originalTitle', '')
    original_artist = data.get('originalArtist', '')
    original_album = data.get('originalAlbum', '')
    updated_track = data.get('updatedTrack', {})

    command = ['beet', 'modify', '-y', f'title:{original_title}', f'artist:{original_artist}', f'album:{original_album}']

    for field, value in updated_track.items():
        if value:  
            command.append(f'{field}={value}')

    print(f"Executing command: {' '.join(command)}")

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return jsonify({'error': result.stderr}), 500

    return jsonify({'message': 'Track updated successfully.'})

# Plugin Manager Routes
@app.route('/api/plugins', methods=['GET'])
def get_plugins():
    """Get list of available and installed plugins."""
    try:
        # Get current config
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file) or {}
        
        enabled_plugins = config.get('plugins', [])
        
        # Check which plugins are installed
        result = {
            'available': [],
            'enabled': enabled_plugins
        }
        
        for plugin_name, plugin_info in AVAILABLE_PLUGINS.items():
            plugin_data = {
                'name': plugin_name,
                'description': plugin_info['description'],
                'enabled': plugin_name in enabled_plugins,
                'installed': is_plugin_installed(plugin_name, plugin_info['pip_name']),
                'pip_name': plugin_info['pip_name']
            }
            result['available'].append(plugin_data)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f"Error loading plugins: {str(e)}"}), 500

@app.route('/api/plugins/install', methods=['POST'])
def install_plugin():
    """Install a plugin via pip."""
    try:
        data = request.json
        plugin_name = data.get('plugin_name')
        
        if plugin_name not in AVAILABLE_PLUGINS:
            return jsonify({'error': 'Unknown plugin'}), 400
        
        plugin_info = AVAILABLE_PLUGINS[plugin_name]
        pip_name = plugin_info['pip_name']
        
        # Install the plugin
        result = subprocess.run(
            ['pip', 'install', '--no-cache-dir', pip_name], 
            capture_output=True, text=True
        )
        
        if result.returncode == 0:
            return jsonify({
                'message': f'Plugin {plugin_name} installed successfully',
                'output': result.stdout
            })
        else:
            return jsonify({
                'error': f'Failed to install plugin: {result.stderr}'
            }), 500
            
    except Exception as e:
        return jsonify({'error': f"Error installing plugin: {str(e)}"}), 500

@app.route('/api/plugins/enable', methods=['POST'])
def enable_plugin():
    """Enable a plugin in the config."""
    try:
        data = request.json
        plugin_name = data.get('plugin_name')
        
        if plugin_name not in AVAILABLE_PLUGINS:
            return jsonify({'error': 'Unknown plugin'}), 400
        
        # Load current config
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file) or {}
        
        # Add plugin to enabled list
        plugins = config.get('plugins', [])
        if plugin_name not in plugins:
            plugins.append(plugin_name)
            config['plugins'] = plugins
        
        # Add default plugin configuration if not exists
        plugin_info = AVAILABLE_PLUGINS[plugin_name]
        if plugin_info['config_template'] and plugin_name not in config:
            config[plugin_name] = plugin_info['config_template']
        
        # Save config
        with open(config_path, 'w') as file:
            yaml.dump(config, file, default_flow_style=False)
        
        return jsonify({'message': f'Plugin {plugin_name} enabled successfully'})
        
    except Exception as e:
        return jsonify({'error': f"Error enabling plugin: {str(e)}"}), 500

@app.route('/api/plugins/disable', methods=['POST'])
def disable_plugin():
    """Disable a plugin in the config."""
    try:
        data = request.json
        plugin_name = data.get('plugin_name')
        
        # Load current config
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file) or {}
        
        # Remove plugin from enabled list
        plugins = config.get('plugins', [])
        if plugin_name in plugins:
            plugins.remove(plugin_name)
            config['plugins'] = plugins
        
        # Save config
        with open(config_path, 'w') as file:
            yaml.dump(config, file, default_flow_style=False)
        
        return jsonify({'message': f'Plugin {plugin_name} disabled successfully'})
        
    except Exception as e:
        return jsonify({'error': f"Error disabling plugin: {str(e)}"}), 500

@app.route('/api/plugins/config/<plugin_name>', methods=['GET'])
def get_plugin_config(plugin_name):
    """Get configuration for a specific plugin."""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file) or {}
        
        plugin_config = config.get(plugin_name, {})
        template = AVAILABLE_PLUGINS.get(plugin_name, {}).get('config_template', {})
        
        return jsonify({
            'config': plugin_config,
            'template': template
        })
        
    except Exception as e:
        return jsonify({'error': f"Error loading plugin config: {str(e)}"}), 500

@app.route('/api/plugins/config/<plugin_name>', methods=['POST'])
def update_plugin_config(plugin_name):
    """Update configuration for a specific plugin."""
    try:
        data = request.json
        plugin_config = data.get('config', {})
        
        # Load current config
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file) or {}
        
        # Update plugin configuration
        config[plugin_name] = plugin_config
        
        # Save config
        with open(config_path, 'w') as file:
            yaml.dump(config, file, default_flow_style=False)
        
        return jsonify({'message': f'Plugin {plugin_name} configuration updated successfully'})
        
    except Exception as e:
        return jsonify({'error': f"Error updating plugin config: {str(e)}"}), 500

def is_plugin_installed(plugin_name, pip_name):
    """Check if a plugin is installed."""
    try:
        if pip_name == 'beets':  # Built-in plugins
            return True
        
        # Check if the package is installed
        result = subprocess.run(
            ['pip', 'show', pip_name.split('[')[0]], 
            capture_output=True, text=True
        )
        return result.returncode == 0
        
    except Exception:
        return False

# File Browser Routes
@app.route('/api/browse', methods=['GET'])
def browse_filesystem():
    """Browse the filesystem starting from a given path."""
    try:
        # Get the path parameter, default to root or home
        path = request.args.get('path', '/music')
        
        # Security check - ensure path is safe
        if not is_safe_path(path):
            return jsonify({'error': 'Access denied to this path'}), 403
        
        # Normalize the path
        path = os.path.abspath(path)
        
        # Check if path exists
        if not os.path.exists(path):
            # Try common music directories if path doesn't exist
            fallback_paths = ['/music', '/home', '/mnt', '/media', '/']
            for fallback in fallback_paths:
                if os.path.exists(fallback) and is_safe_path(fallback):
                    path = fallback
                    break
        
        items = []
        
        # Add parent directory option (except for root)
        parent_path = os.path.dirname(path)
        if path != '/' and parent_path != path:
            items.append({
                'name': '..',
                'path': parent_path,
                'type': 'directory',
                'is_parent': True,
                'size': '',
                'modified': ''
            })
        
        # List directory contents
        try:
            for item_name in sorted(os.listdir(path)):
                # Skip hidden files/folders by default
                if item_name.startswith('.') and item_name not in ['..']:
                    continue
                
                item_path = os.path.join(path, item_name)
                
                # Skip if we can't access it
                if not os.access(item_path, os.R_OK):
                    continue
                
                try:
                    stat_info = os.stat(item_path)
                    is_dir = stat.S_ISDIR(stat_info.st_mode)
                    
                    # Only include directories for directory selection
                    if is_dir:
                        items.append({
                            'name': item_name,
                            'path': item_path,
                            'type': 'directory',
                            'is_parent': False,
                            'size': '',
                            'modified': format_timestamp(stat_info.st_mtime)
                        })
                        
                except (OSError, PermissionError):
                    # Skip items we can't stat
                    continue
        
        except PermissionError:
            return jsonify({'error': 'Permission denied accessing this directory'}), 403
        
        return jsonify({
            'current_path': path,
            'items': items,
            'parent_path': parent_path if path != '/' else None
        })
        
    except Exception as e:
        return jsonify({'error': f"Error browsing filesystem: {str(e)}"}), 500

@app.route('/api/browse/validate', methods=['POST'])
def validate_path():
    """Validate if a path exists and is accessible."""
    try:
        data = request.json
        path = data.get('path', '')
        
        if not path:
            return jsonify({'valid': False, 'error': 'No path provided'})
        
        # Security check
        if not is_safe_path(path):
            return jsonify({'valid': False, 'error': 'Access denied to this path'})
        
        # Normalize path
        path = os.path.abspath(path)
        
        # Check if exists and is directory
        if not os.path.exists(path):
            return jsonify({'valid': False, 'error': 'Path does not exist'})
        
        if not os.path.isdir(path):
            return jsonify({'valid': False, 'error': 'Path is not a directory'})
        
        if not os.access(path, os.R_OK):
            return jsonify({'valid': False, 'error': 'Permission denied'})
        
        return jsonify({'valid': True, 'path': path})
        
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)})

@app.route('/api/browse/music-dirs', methods=['GET'])
def get_common_music_directories():
    """Get common music directory locations."""
    common_dirs = []
    
    # Common music directory paths
    potential_dirs = [
        '/music',
        '/media',
        '/mnt',
        '/home/music',
        '/usr/share/music',
        '/opt/music',
        '/var/music'
    ]
    
    # Add user home directories if accessible
    try:
        for user_dir in os.listdir('/home'):
            user_music = f'/home/{user_dir}/Music'
            if os.path.exists(user_music) and os.access(user_music, os.R_OK):
                potential_dirs.append(user_music)
    except:
        pass
    
    # Check which directories exist and are accessible
    for dir_path in potential_dirs:
        if os.path.exists(dir_path) and os.path.isdir(dir_path) and os.access(dir_path, os.R_OK):
            try:
                # Count subdirectories to give an idea of content
                subdir_count = len([d for d in os.listdir(dir_path) 
                                  if os.path.isdir(os.path.join(dir_path, d))])
                common_dirs.append({
                    'path': dir_path,
                    'name': os.path.basename(dir_path) or dir_path,
                    'subdirs': subdir_count
                })
            except:
                continue
    
    return jsonify({'directories': common_dirs})

def is_safe_path(path):
    """Check if a path is safe to access (basic security)."""
    # Normalize the path
    path = os.path.abspath(path)
    
    # List of dangerous paths to avoid
    dangerous_paths = [
        '/etc/passwd',
        '/etc/shadow',
        '/root/.ssh',
        '/home/.ssh',
        '/proc',
        '/sys/kernel'
    ]
    
    # Check against dangerous paths
    for dangerous in dangerous_paths:
        if path.startswith(dangerous):
            return False
    
    # Only allow certain root directories
    allowed_roots = ['/', '/home', '/music', '/media', '/mnt', '/opt', '/usr', '/var']
    
    # Check if path starts with allowed root
    for root in allowed_roots:
        if path.startswith(root):
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

# Read port from environment variable, defaulting to 3000 if not set
port = int(os.getenv("FLASK_PORT", 3000))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=port)