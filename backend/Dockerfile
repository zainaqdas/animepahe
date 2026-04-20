FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    ffmpeg \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Clone animepahe-dl library
RUN git clone https://github.com/ayushjaipuriyar/animepahe-dl /app/animepahe-dl

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application
COPY backend/app/ ./app/

# Build frontend and copy to static
COPY frontend/package*.json /tmp/frontend/
COPY frontend /tmp/frontend/
RUN cd /tmp/frontend && npm ci && npm run build
RUN mkdir -p /app/static && cp -r /tmp/frontend/dist/* /app/static/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
