FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenCV and other libraries
# RUN apt-get update && apt-get install -y \
#     libgl1 \
#     libglib2.0-0 \
#     libsm6 \
#     libxext6 \
#     libxrender-dev \
#     libgomp1 \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (overwritten when volumes are provided)
COPY . .

RUN chmod +x entry.sh

ENTRYPOINT ["./entry.sh"]
# Expose the port

EXPOSE 8080

# Run the application (no --reload for production)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
