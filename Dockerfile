# Stage 1: Build stage
FROM python:3.11-slim as builder

# Install build dependencies only
RUN apt-get update && apt-get install -y --fix-missing \
    build-essential \
    gcc \
    g++ \
    pkg-config \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir 'beets==2.3.1' requests pillow beautifulsoup4 langdetect

# Copy the application code
COPY . /build/

# Stage 2: Runtime stage
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --fix-missing \
    ffmpeg \
    mp3gain \
    vorbisgain \
    curl \
    wget \
    git \
    libjpeg-dev \
    libpng-dev \
    python3-pip \
    && pip3 install --no-cache-dir 'beets==2.3.1' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 beetiful && \
    chown -R beetiful:beetiful /app

# Copy from builder - more explicit paths
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /build/app /app
COPY --from=builder /build/static /app/static
COPY --from=builder /build/templates /app/templates

# Create directories with explicit permissions
RUN mkdir -p /config /music /app/instance && \
    chown -R beetiful:beetiful /config /music /app

USER beetiful

# Environment variables in alphabetical order
ENV BEETSDIR=/config \
    FLASK_APP=app.py \
    FLASK_ENV=production \
    FLASK_PORT=5000 \
    LIBRARY_PATH=/music \
    PYTHONUNBUFFERED=1

EXPOSE 5000

# Start the Flask application
CMD ["python", "app.py"]