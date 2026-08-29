FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python deps first (better layer caching).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app. The engine + static files are all it needs.
COPY main.py engine.py ./
COPY static ./static

# Run as an unprivileged user.
RUN useradd --create-home appuser && mkdir -p /data && chown appuser:appuser /data
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
