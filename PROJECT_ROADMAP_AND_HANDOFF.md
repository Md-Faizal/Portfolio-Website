# Infrastructure Handoff & Modernization Roadmap

**Machine Target**: Oracle Cloud VM (`my-mac`)  
**OS**: Ubuntu 24.04 LTS (1 vCPU, 954 MB RAM, 48 GB Disk)  
**Host IP**: Accessible via SSH alias `my-mac`  

---

## 1. High-Level Objectives (The Big Picture)

1. **Storage Stability**: Keep root disk space safe (was critically low at 1.4 GB; now healthy with 13-20 GB free). Avoid bloat from caches, unused snaps, and build artifacts.
2. **RAM & Performance Optimization (Rust + Docker)**:
   - System baseline memory is constrained (~954 MB total RAM).
   - Migrate workloads from heavy PM2 / Node daemons to lightweight, compiled Rust micro-services and memory-capped Docker containers.
   - Goal: Drop baseline memory usage from ~600 MB down to <380 MB.
3. **Industrial Standard Structure & 100% Portability**:
   - Establish `/opt/stack/` directory standard.
   - Completely decouple code (Git repositories) from state (databases, configs, uploads).
   - Provide 1-click zero-downtime backup (`backup.sh`) and restore (`restore.sh`) so the entire VM or parts of it can be cloned to a new VM in under 3 minutes.

---

## 2. Current Status & Progress Summary

### Completed Milestones ✅
1. **Emergency Disk Space Recovery**:
   - Purged ~14 GB of stale VS Code server revisions (`~/.vscode-server/cli/servers`).
   - Purged ~12 GB of unneeded desktop GUI snaps (`firefox`, `thunderbird`, `chromium`, `cups`, `gnome-46`, `mesa-2404`).
   - Cleaned build and download caches (`~/.cache`, `/var/lib/snapd/cache`).
   - **Result**: Free space jumped from **1.4 GB (3%) to 13–20 GB (>30-40% free)**.
2. **Personal Site (`faizal.uk`) Migrated to Rust**:
   - Replaced PM2 Node.js process with a standalone compiled Rust Axum binary (`personal-site-rust` container).
   - Memory dropped from **~50 MB &rarr; 4.58 MB RAM**.
   - Connected directly to Stalwart ESMTP on `127.0.0.1:25`.
3. **Backup & Restore System Operational**:
   - [`/opt/stack/ops/scripts/backup.sh`](file:///opt/stack/ops/scripts/backup.sh): Takes transactional `VACUUM INTO` snapshots of live SQLite databases (`nexus_portal.db`, `panel.db`, `MacOS.db`), backs up Nginx configs and compose manifests into an **11 MB `.tar.gz` bundle** in `/opt/backups/`.
   - [`/opt/stack/ops/scripts/restore.sh`](file:///opt/stack/ops/scripts/restore.sh): 1-command restore script with safety rollbacks.
4. **MacOS Desktop Service Emergency Restoration**:
   - Restored displaced files back to `/home/ubuntu/MacOS-Production/`.
   - `macos-server-blue` container verified online and healthy on `https://mac.faizal.uk` (port 3001).

---

## 3. Current Live Services State

All active production services are verified healthy:
- **`https://mac.faizal.uk`** &rarr; `macos-server-blue` Docker container (port 3001, HTTP 200 OK)
- **`https://faizal.uk`** &rarr; `personal-site-rust` Docker container (port 3002, HTTP 200 OK)
- **`https://nexus.faizal.uk`** &rarr; `nexus-backend` in PM2 (port 3010, HTTP 200 OK)
- **`http://cs.faizal.uk`** &rarr; `cs-panel-web` in PM2 (port 3005, HTTP 200 OK)
- **Mail Server** &rarr; `stalwartlabs/stalwart:latest` Docker container (ports 25, 8080, healthy)

---

## 4. Immediate Next Steps for the Next Agent

### Step 1: Complete the `/opt/stack` Layout with Symlinks
Ensure existing host paths never break by creating the standard layout in `/opt/stack` and symlinking `/home/ubuntu/*` to `/opt/stack/*`:

```
/opt/stack/
├── compose.env
├── docker-compose.yml               # Central orchestrator using Compose 'include:'
├── apps/
│   ├── personal-site/               # docker-compose.yml (Live)
│   ├── nexus/                       # docker-compose.yml, data/ (nexus_portal.db)
│   ├── macos-desktop/               # docker-compose.yml -> /home/ubuntu/MacOS-Production
│   ├── cs-panel/                    # docker-compose.yml
│   └── mailserver/                  # docker-compose.yml (Stalwart configuration)
├── games/
│   ├── cs16/                        # Symlink from /home/ubuntu/cs16_server
│   └── minecraft/                   # Symlink from /home/ubuntu/minecraft-server
└── ops/
    ├── scripts/ (backup.sh, restore.sh, update.sh)
    └── nginx/ (virtual hosts backup & sync)
```
> [!CAUTION]
> Always verify paths before moving. Prefer symlinking `/opt/stack/apps/<name>` to existing folders or ensure Docker bind-mounts point directly to the new directory before stopping containers.

### Step 2: Rewrite / Containerize `nexus-backend` in Rust
- `nexus-backend` currently runs under PM2 (PID 1561983) with `nexus_portal.db` (213 MB SQLite database, 15 tables).
- **Core Endpoints to Port to Axum + rusqlite**:
  1. Profile & Authentication (`/api/profiles`, `/api/auth/set_pin`, `/api/auth/verify_pin`)
  2. Telemetry & Ride Tracker (`/api/timeline/*`, `/api/ridetracker/*`)
  3. Static Asset & Sandbox serving (`/public`, `/sandbox`, `/uploads`)
- **Impact**: Drops memory from ~60 MB to <8 MB and allows retiring PM2.

### Step 3: Containerize `cs-panel` & Completely Retire PM2
- Move `cs-panel` into a lightweight container or standalone daemon.
- Once both `nexus-backend` and `cs-panel` are containerized:
  ```bash
  pm2 kill && sudo systemctl disable pm2-ubuntu
  ```
- **Reclaims ~35 MB of RAM** consumed solely by the PM2 master daemon, agent, and logrotate.

### Step 4: Automate Nightly Offsite Backups
- Add a cron job to run `/opt/stack/ops/scripts/backup.sh` daily at 03:00.
- Optional: Add an `rclone sync /opt/backups remote:backups/` line to sync the 11 MB snapshot offsite.
