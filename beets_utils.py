"""
Beets utility functions
"""
import os
import subprocess
import yaml
import logging

logger = logging.getLogger(__name__)

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

def clean_field(value, field_name):
    """Clean field values and handle cases where beets returns literal field names"""
    if not value or value.strip() == '' or value == f'${field_name}':
        return None
    return value.strip()

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