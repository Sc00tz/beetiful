FROM python:3.11-slim

# Install system dependencies for beets and audio processing
RUN apt-get update && apt-get install -y \
    # Required for beets
    python3-dev \
    # Audio libraries for various formats
    ffmpeg \
    # For ReplayGain calculation
    mp3gain \
    vorbisgain \
    # For fetching album art and lyrics
    curl \
    # General utilities
    git \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 beetiful && \
    chown -R beetiful:beetiful /app

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install beets with additional plugins
RUN pip install --no-cache-dir beets[fetchart,lyrics,lastgenre,web,replaygain,acousticbrainz,discogs,spotify]

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /config /music /app/instance && \
    chown -R beetiful:beetiful /config /music /app

# Switch to non-root user
USER beetiful

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV BEETSDIR=/config
ENV LIBRARY_PATH=/music
ENV FLASK_PORT=5000

# Expose the port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Start the application
CMD ["python", "app.py"]