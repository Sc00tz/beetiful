# Beetiful Fork Changelog

## Sc00tz/beetiful vs Vansmak/beetiful

This document outlines the changes made in the Sc00tz fork compared to the original Vansmak/beetiful repository.

---

## Major Changes

### 🐳 **Docker Integration**
- **Added**: Complete Docker containerization support
- **Added**: `docker-compose.yml` configuration file
- **Added**: Simplified deployment using Docker containers
- **Changed**: Installation process now supports both traditional Python setup and Docker deployment

### 📁 **Configuration Management**
- **Enhanced**: Configuration directory structure
- **Added**: Config directory mounting (`/config` in container)
- **Added**: Music library volume mounting (`/music:ro` - read-only)
- **Added**: YAML validation for configuration editing

### 🎵 **Music Library Features**
- **Enhanced**: Responsive, dark-themed UI
- **Added**: Full lyrics support with LRC/timed lyrics capability
- **Enhanced**: Browse and search functionality
- **Enhanced**: Metadata editing for tracks, albums, and artists

### 🔧 **Plugin System**
- **Added**: Plugin management interface
- **Added**: Enable/disable built-in plugins functionality
- **Enhanced**: Better integration with beets plugins

### 🌐 **User Interface Improvements**
- **Enhanced**: Modern, responsive design
- **Added**: Dark theme as default
- **Enhanced**: Mobile-friendly layout
- **Improved**: Navigation and user experience

### ⚙️ **Installation & Setup**
- **Simplified**: Docker-based installation
- **Added**: Port configuration (default: 3000 for Docker, 3001 for local)
- **Enhanced**: Volume mounting for persistent data
- **Added**: Environment variable configuration

---

## Technical Changes

### Infrastructure
- **Added**: Docker containerization
- **Added**: Docker Compose orchestration
- **Enhanced**: Configuration management through mounted volumes

### Dependencies
- **Updated**: Requirements for Docker compatibility
- **Enhanced**: Flask backend optimization
- **Maintained**: Static HTML/JS frontend approach

### Configuration
- **Enhanced**: YAML configuration validation
- **Added**: Web-based config editor
- **Improved**: Plugin configuration management

---

## Installation Differences

### Original (Vansmak/beetiful)
```bash
git clone https://github.com/Vansmak/beetiful.git
cd beetiful
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Create .env file
python app.py
# Access at http://127.0.0.1:3001
```

### Fork (Sc00tz/beetiful)
```bash
git clone https://github.com/Sc00tz/beetiful.git
cd beetiful
# Edit docker-compose.yml for your paths
docker compose up -d
# Access at http://localhost:3000
```

---

## Feature Comparison

| Feature | Original | Fork |
|---------|----------|------|
| Docker Support | ❌ | ✅ |
| LRC/Timed Lyrics | ❌ | ✅ |
| Plugin Management UI | Basic | Enhanced |
| Dark Theme | ❌ | ✅ (Default) |
| Mobile Responsive | Basic | Enhanced |
| Config Validation | Basic | YAML Validation |
| Port Configuration | Fixed (3001) | Configurable (Default 3000) |
| Volume Mounting | N/A | Persistent config & music |

---

## Migration Notes

If migrating from the original to the fork:

1. **Backup your configuration**: Save your existing beets config
2. **Update installation method**: Switch to Docker-based deployment
3. **Configure volumes**: Set up proper volume mounts for music and config
4. **Update port access**: Change from port 3001 to 3000 (or configure as needed)

---

## Compatibility

- **Beets Compatibility**: Maintained full compatibility with beets
- **Configuration**: Existing beets configurations should work without modification
- **Library**: Existing music libraries remain fully compatible
- **Plugins**: All beets plugins continue to work as expected

---

## Future Enhancements (Roadmap differences)

The fork focuses on:
- Container-first deployment
- Enhanced user experience
- Better plugin integration
- Improved mobile support

vs. Original roadmap:
- Command builder expansion
- More beets commands
- Plugin manager improvements