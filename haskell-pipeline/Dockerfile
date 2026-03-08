FROM haskell:9.6 AS builder

WORKDIR /app

# Copy dependency files first for caching
COPY package.yaml stack.yaml stack.yaml.lock haskell-pipeline.cabal ./
RUN stack setup --no-terminal
RUN stack build --only-dependencies --no-terminal

# Copy source and build
COPY app/ app/
COPY src/ src/

RUN stack build --no-terminal --copy-bins

# Minimal runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgmp10 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary
COPY --from=builder /root/.local/bin/haskell-pipeline-exe ./haskell-pipeline

# Copy the raw data
COPY data/ data/

# Output will be written to /app/cleaned_crop_data.csv
CMD ["./haskell-pipeline"]
