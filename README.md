# Beetiful: A Modern Web UI for Beets

Beetiful is a modern, user-friendly web frontend for the [beets](https://beets.io/) music library manager. It lets you browse, search, edit, and manage your music collection from any browser, with full support for lyrics, plugins, and more.

---

## Features
- Browse and search your beets music library
- View and edit track, album, and artist metadata
- Fetch and display lyrics (with LRC/timed support)
- Plugin management (enable/disable built-in plugins)
- Config editor with YAML validation
- Responsive, dark-themed UI
- Dockerized for easy deployment

---

## Quick Start (Docker)

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/beetiful.git
   cd beetiful
   ```

2. **Edit `docker-compose.yml`:**
   - Set the path to your music library in the `volumes` section (e.g. `/path/to/your/music:/music:ro`).
   - Optionally, adjust ports and config paths as needed.

3. **Start Beetiful:**
   ```sh
   docker compose up -d
   ```

4. **Open in your browser:**
   - Visit [http://localhost:3000](http://localhost:3000)

---

## Configuration
- The beets config is stored in the `config` directory (mounted as `/config` in the container).
- Edit your config using the web UI or by editing `config.yaml` directly.
- Plugins can be enabled/disabled from the Plugins page.

---

## Requirements
- Docker and Docker Compose
- Your music library (FLAC, MP3, etc.)

---

## Development
- The app is a Flask backend with a static HTML/JS frontend.
- To run locally (without Docker):
  1. Install Python 3.11 and [beets](https://beets.io/)
  2. `pip install -r requirements.txt`
  3. `python app.py`

---

## Troubleshooting
- If lyrics are not showing, ensure your beets library has the `lyrics` field populated. Use the web UI or run:
  ```sh
  beet ls -f '$lyrics' id:<track_id>
  ```
- For permission issues, check your Docker volume mounts and user permissions.

---

## License
MIT

