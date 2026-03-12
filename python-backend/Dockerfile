FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for ML libraries (xgboost, prophet)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=3000 --retries 10 -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose the port the API runs on
EXPOSE 8000

# Command to run the application
CMD ["python", "main.py"]
