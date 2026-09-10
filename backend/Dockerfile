FROM python:3.11-slim

# System libraries: rasterio/geopandas/fiona ship manylinux wheels with GDAL
# vendored, but libpq/build-essential are still useful as a fallback if any
# dependency needs to compile from source on a platform without a matching wheel.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libexpat1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY models ./models
COPY data ./data
COPY scripts ./scripts

RUN mkdir -p /app/uploads

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
