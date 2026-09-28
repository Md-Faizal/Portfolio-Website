# =============================================================================
# Minimal Rust Production Dockerfile — Pre-compiled Static Musl Binary
# Image Size: ~15 MB | Runtime RSS: ~5–12 MB
# =============================================================================
FROM alpine:3.20 AS runtime

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy pre-compiled static Linux musl binary
COPY personal-site-rust /app/personal-site-rust

# Copy static frontend build & public assets
COPY frontend/dist /app/frontend/dist
COPY public /app/public

ENV PORT=3002 \
    RUST_LOG=info \
    TZ=UTC

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3002/api/maintenance-status || exit 1

ENTRYPOINT ["/app/personal-site-rust"]
