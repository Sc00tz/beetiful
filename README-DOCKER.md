# Beetiful Docker Deployment Guide

This guide explains how to run Beetiful (a web UI for beets) using Docker and Docker Compose.

---

## Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- Your music library on disk (FLAC, MP3, etc.)

---

## 1. Clone the Repository
```sh
git clone https://github.com/yourusername/beetiful.git
cd beetiful
```

---

## 2. Configure Docker Compose
Edit `docker-compose.yml` and set the correct path to your music library:

```yaml
volumes:
  - /path/to/your/music:/music:ro  # <-- Change this to your music folder
  - ./config:/config                # Beets config and database
  - beetiful_data:/app/instance     # App state (optional)
```

You can also adjust the exposed port (default: 3000).

---

## 3. Start Beetiful
```sh
docker compose up -d
```

---

## 4. Access the Web UI
Open your browser and go to:

[http://localhost:3000](http://localhost:3000)

---

## 5. Configuration & Plugins
- The beets config is stored in the `config` directory (mounted as `/config`).
- Use the web UI to edit config, enable plugins, and manage your library.

---

## 6. Updating
To update Beetiful:
```sh
git pull
docker compose build --no-cache
docker compose up -d
```

---

## 7. Troubleshooting
- **No music appears:** Check your music path and permissions.
- **Lyrics not showing:** Ensure the `lyrics` field is present in your beets library. Use the web UI or run:
  ```sh
  docker exec -it beetiful beet ls -f '$lyrics' id:<track_id>
  ```
- **Permission errors:** Make sure the `config` and `music` folders are readable by the container user.

---

## License
MIT