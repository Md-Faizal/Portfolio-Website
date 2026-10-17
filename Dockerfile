# =============================================================================
# Rust Production Dockerfile — Ubuntu 24.04 runtime (GLIBC_2.39 compatible)
# Binary: dynamically-linked x86-64 Linux compiled on Ubuntu 24.04 (Rust 1.98)
# Image Size: ~140 MB | Runtime RSS: ~8–15 MB
# =============================================================================
FROM ubuntu:24.04 AS runtime

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates tzdata curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-compiled glibc Linux binary (compiled on Ubuntu 24.04 / Rust 1.98)
COPY personal-site-rust /app/personal-site-rust
RUN chmod +x /app/personal-site-rust

# Copy static frontend build & public assets
COPY frontend/dist /app/frontend/dist
COPY public /app/public

ENV PORT=3002 \
    RUST_LOG=info \
    TZ=UTC

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://127.0.0.1:3002/api/maintenance-status || exit 1

ENTRYPOINT ["/app/personal-site-rust"]
