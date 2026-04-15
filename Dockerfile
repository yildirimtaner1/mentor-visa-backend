# Backend Render deployment config
FROM python:3.11-slim

WORKDIR /app

# Install build tools just in case psycopg2 needs them
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the server on Render's dynamic PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
