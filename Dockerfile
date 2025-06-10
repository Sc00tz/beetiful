FROM python:3.11-slim

# Install system dependencies for beets and audio processing
RUN apt-get update && apt-get install -y \
    # Build tools and compilers
    build-essential \
    gcc \
    g++ \
    pkg-config \
    # Required for beets
    python3-dev \
    # Audio libraries for various formats
    ffmpeg \
    # For ReplayGain calculation (optional)
    mp3gain \
    vorbisgain \
    # For fetching album art and lyrics
    curl \
    wget \
    # General utilities
    git \
    # Image processing for album art
    libjpeg-dev \
    libpng-dev \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 beetiful && \
    chown -R beetiful:beetiful /app

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies from requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Beets with the latest stable version and core plugins as extras
# Beets 1.6.1 is the latest stable release and includes the 'plugin' command.
RUN pip install --no-cache-dir 'beets==1.6.1' \
    'beets[fetchart]' \
    'beets[lyrics]' \
    'beets[lastgenre]' \
    'beets[discogs]' \
    requests pillow mutagen

# Install python-discogs-client and beautifulsoup4 separately, allowing failure
# These might not always have compatible wheels for all architectures/Python versions
# or might not be strictly necessary if beets[discogs] handles its own dependency.
RUN pip install --no-cache-dir python-discogs-client || true
RUN pip install --no-cache-dir beautifulsoup4 || true

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