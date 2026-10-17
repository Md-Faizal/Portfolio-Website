# =============================================================================
# Rust Production Dockerfile — Ubuntu 24.04 runtime (GLIBC_2.39 compatible)
# Binary: dynamically-linked x86-64 Linux compiled on Ubuntu 24.04 (Rust 1.98)
# Image Size: ~140 MB | Runtime RSS: ~8–15 MB
# =============================================================================
FROM ubuntu:24.04 AS runtime

# Copy global TLS CA certificates bundle (zero apt-get network calls needed)
COPY ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

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



ENTRYPOINT ["/app/personal-site-rust"]
