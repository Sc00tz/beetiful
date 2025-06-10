# Docker Setup for Beetiful

This guide will help you run Beetiful using Docker, making it easy to deploy and manage your music library interface.

## Prerequisites

- Docker and Docker Compose installed on your system
- A music library directory on your host system
- Basic familiarity with Docker concepts

## Quick Start

### 1. Clone and Prepare

```bash
git clone https://github.com/Vansmak/beetiful.git
cd beetiful
```

### 2. Configure Volumes

Edit the `docker-compose.yml` file to point to your actual music directory:

```yaml
volumes:
  - /path/to/your/music:/music:ro  # Change this to your music directory
```

### 3. Create Config Directory

```bash
mkdir -p config
```

### 4. Build and Run

```bash
# Build and start the container
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 5. Access the Application

Open your browser and navigate to: `http://localhost:3000`

## Configuration

### Environment Variables

You can customize the application by setting environment variables in the `docker-compose.yml` file or by creating a `.env` file:

```bash
BEETSDIR=/config
LIBRARY_PATH=/music
FLASK_PORT=5000
FLASK_ENV=production
```

### Beets Configuration

The beets configuration file will be created in the `./config` directory on your host. You can:

1. Use the web interface config editor
2. Manually edit `./config/config.yaml` on your host
3. Mount an existing config directory

Example beets config for Docker setup:

```yaml
directory: /music
library: /config/musiclibrary.db

import:
    move: no
    copy: no
    write: yes

paths:
    default: $albumartist/$album/$track $title
```

## Volume Mounting Options

### Music Library (Required)
```yaml
volumes:
  - /host/path/to/music:/music:ro
```
- Mount as read-only (`:ro`) to prevent accidental modifications
- Change `/host/path/to/music` to your actual music directory

### Config Persistence (Recommended)
```yaml
volumes:
  - ./config:/config
```
- Stores beets database and configuration
- Persists between container restarts

### Application Data (Optional)
```yaml
volumes:
  - beetiful_data:/app/instance
```
- Stores Flask application data
- Automatically managed by Docker

## Docker Commands

### Build and Run
```bash
# Build the image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Management Commands
```bash
# Access container shell
docker-compose exec beetiful bash

# Restart services
docker-compose restart

# Update and rebuild
docker-compose down
docker-compose pull
docker-compose up --build -d
```

### Direct Docker Commands
```bash
# Build image directly
docker build -t beetiful .

# Run container directly
docker run -d \
  --name beetiful \
  -p 3000:5000 \
  -v /path/to/music:/music:ro \
  -v $(pwd)/config:/config \
  beetiful
```

## Troubleshooting

### Common Issues

1. **Permission Issues**
   ```bash
   # Fix ownership of config directory
   sudo chown -R 1000:1000 ./config
   ```

2. **Port Already in Use**
   ```bash
   # Change the host port in docker-compose.yml
   ports:
     - "3001:5000"  # Use port 3001 instead
   ```

3. **Music Files Not Found**
   - Verify the music directory path in docker-compose.yml
   - Ensure the directory exists and is accessible
   - Check file permissions

4. **Beets Database Issues**
   ```bash
   # Reset beets database (removes all metadata)
   rm -f ./config/musiclibrary.db
   docker-compose restart
   ```

### Logs and Debugging

```bash
# View application logs
docker-compose logs beetiful

# Follow logs in real-time
docker-compose logs -f beetiful

# Access container for debugging
docker-compose exec beetiful bash
```

## Security Considerations

- The container runs as a non-root user (UID 1000)
- Music files are mounted read-only by default
- Consider using Docker secrets for sensitive configuration
- Regularly update the base image for security patches

## Performance Optimization

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
```

### Storage Optimization
- Use SSD storage for the config directory (database)
- Consider NFS/network storage for large music libraries
- Regular database maintenance through beets commands

## Backup and Restore

### Backup Configuration
```bash
# Backup beets config and database
tar -czf beetiful-backup.tar.gz config/
```

### Restore Configuration
```bash
# Restore from backup
tar -xzf beetiful-backup.tar.gz
docker-compose restart
```

## Production Deployment

For production deployments, consider:

1. Using a reverse proxy (nginx, traefik)
2. SSL/HTTPS termination
3. Regular automated backups
4. Monitoring and logging
5. Resource limits and health checks

Example with nginx reverse proxy:
```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - beetiful
```

This Docker setup provides a robust, portable way to run Beetiful while maintaining proper separation between your music files, application code, and configuration data.