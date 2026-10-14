use crate::SharedState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Duration;
use tokio::time::sleep;

// ─── Service / Container info ────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ServiceInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,     // "core" | "mail" | "game"
    pub group: String,        // display group label
    pub status: String,       // "running" | "stopped"
    pub control_type: String, // "docker" | "systemctl" | "none"
    #[serde(rename = "type")]
    pub service_type: String,
    pub node: String,
    pub enabled: bool,
    pub port: u16,
    pub memory_mb: f64,
    pub cpu_usage: String,
    pub ram_usage: String,
    pub storage_usage: String,
    pub serving_state: String,
    pub traffic_route: String,
}

#[derive(Deserialize)]
pub struct ServiceActionPayload {
    pub action: String,
}

async fn check_tcp_port(port: u16) -> bool {
    tokio::net::TcpStream::connect(("127.0.0.1", port))
        .await
        .is_ok()
}

/// Check if a Docker container is running
fn docker_running(name: &str) -> bool {
    std::process::Command::new("docker")
        .args(["inspect", "-f", "{{.State.Running}}", name])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false)
}

async fn bloomberg_terminal_status() -> &'static str {
    let req_id = format!(
        "bloomberg-terminal_status_{}",
        chrono::Utc::now().timestamp_micros()
    );
    let req_path = format!("/run/stack-service-ipc/{}.req", req_id);
    let res_path = format!("/run/stack-service-ipc/{}.res", req_id);

    if let Err(error) = fs::write(&req_path, "remote-docker status bloomberg-terminal\n") {
        tracing::warn!(%error, "failed to request Bloomberg Terminal status");
        return "unknown";
    }

    for _ in 0..10 {
        sleep(Duration::from_millis(250)).await;
        match fs::read_to_string(&res_path) {
            Ok(response) => {
                let _ = fs::remove_file(&res_path);
                if response.lines().any(|line| line == "EXIT:0") {
                    return match response
                        .lines()
                        .find_map(|line| line.strip_prefix("OUTPUT:"))
                    {
                        Some("RUNNING") => "running",
                        Some("STOPPED") => "stopped",
                        _ => {
                            tracing::warn!(%response, "unexpected Bloomberg Terminal status response");
                            "unknown"
                        }
                    };
                }
                tracing::warn!(%response, "Bloomberg Terminal status request failed");
                return "unknown";
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                tracing::warn!(%error, "failed to read Bloomberg Terminal status response");
                return "unknown";
            }
        }
    }

    let _ = fs::remove_file(&req_path);
    tracing::warn!("timed out requesting Bloomberg Terminal status");
    "unknown"
}

pub async fn list_services(State(_state): State<SharedState>) -> impl IntoResponse {
    // Probe ports concurrently
    let (cs_online, mc_online, stall_admin, stall_smtps, stall_imap, nexus_online) = tokio::join!(
        check_tcp_port(3005),
        check_tcp_port(5000),
        check_tcp_port(8080),
        check_tcp_port(465),
        check_tcp_port(993),
        check_tcp_port(3010),
    );

    // Docker container states
    let stall_running = docker_running("stalwart-mail");
    let macos_running = docker_running("macos-server-blue");

    let bloomberg_status = bloomberg_terminal_status().await;
    let services = vec![
        // ── Core ─────────────────────────────────────────────────────────────
        ServiceInfo {
            id: "nginx".into(),
            name: "Nginx Reverse Proxy".into(),
            description: "Public-facing HTTP(S) gateway — routes all traffic to backend services".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: "running".into(), // always on, no probe needed
            control_type: "systemctl".into(),
            service_type: "systemctl".into(),
            node: "my-mac".into(),
            enabled: true,
            port: 80,
            memory_mb: 18.0,
            cpu_usage: "0.4% avg".into(),
            ram_usage: "18 MB".into(),
            storage_usage: "45 MB".into(),
            serving_state: "active".into(),
            traffic_route: "Public Edge Ingress (Ports 80 & 443 SSL) on my-mac".into(),
        },
        ServiceInfo {
            id: "personal-site-rust".into(),
            name: "Personal Site (Rust Engine)".into(),
            description: "Main Axum backend — API, portfolio, health engine, active-standby redundant across nodes".into(),
            category: "core".into(),
            group: "Cluster Fabric".into(),
            status: "running".into(),
            control_type: "docker".into(),
            service_type: "docker".into(),
            node: "both".into(),
            enabled: true,
            port: 3002,
            memory_mb: 24.0,
            cpu_usage: "0.3% avg".into(),
            ram_usage: "24 MB".into(),
            storage_usage: "62 MB".into(),
            serving_state: "both".into(),
            traffic_route: "Actively Serving: my-mac (:3002) • Standby Replica: container-of-souls (:3002)".into(),
        },
        ServiceInfo {
            id: "cockpit".into(),
            name: "Cockpit Multi-Host Bridge".into(),
            description: "Unified web console spanning my-mac and container-of-souls (port 9090)".into(),
            category: "core".into(),
            group: "Cluster Fabric".into(),
            status: "running".into(),
            control_type: "systemctl".into(),
            service_type: "systemctl".into(),
            node: "both".into(),
            enabled: true,
            port: 9090,
            memory_mb: 32.0,
            cpu_usage: "0.3% avg".into(),
            ram_usage: "32 MB".into(),
            storage_usage: "85 MB".into(),
            serving_state: "both".into(),
            traffic_route: "Multi-Host Console: my-mac & container-of-souls (:9090)".into(),
        },
        ServiceInfo {
            id: "macos-server-blue".into(),
            name: "MacOS Desktop (Blue Primary)".into(),
            description: "Interactive macOS-themed virtual desktop primary node (mac.faizal.uk)".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: if macos_running { "running".into() } else { "stopped".into() },
            control_type: "docker".into(),
            service_type: "docker".into(),
            node: "my-mac".into(),
            enabled: true,
            port: 3001,
            memory_mb: if macos_running { 180.0 } else { 0.0 },
            cpu_usage: (if macos_running { "2.4% avg" } else { "0.0%" }).into(),
            ram_usage: (if macos_running { "180 MB" } else { "0 MB" }).into(),
            storage_usage: "520 MB".into(),
            serving_state: if macos_running { "active".into() } else { "stopped".into() },
            traffic_route: "Actively Serving: mac.faizal.uk -> my-mac (:3001 Active Slot)".into(),
        },
        ServiceInfo {
            id: "macos-server-green".into(),
            name: "MacOS Desktop (Green Standby)".into(),
            description: "Interactive macOS-themed virtual desktop standby replica on container-of-souls".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: "running".into(),
            control_type: "remote-docker".into(),
            service_type: "docker".into(),
            node: "container-of-souls".into(),
            enabled: true,
            port: 3004,
            memory_mb: 140.0,
            cpu_usage: "0.5% avg".into(),
            ram_usage: "140 MB".into(),
            storage_usage: "520 MB".into(),
            serving_state: "standby".into(),
            traffic_route: "Hot Standby Slot: container-of-souls (:3004 Failover Target)".into(),
        },
        // ── Stalwart Mail (all under one Docker container) ───────────────────
        ServiceInfo {
            id: "stalwart-mail".into(),
            name: "Stalwart Mail Server".into(),
            description: "Full mail stack — SMTP/SMTPS/IMAP/Admin all in one container (stalwart-mail)".into(),
            category: "mail".into(),
            group: "Mail Infrastructure".into(),
            status: if stall_running { "running".into() } else { "stopped".into() },
            control_type: "docker".into(),
            service_type: "docker".into(),
            node: "my-mac".into(),
            enabled: true,
            port: 8080,
            memory_mb: if stall_running { 95.0 } else { 0.0 },
            cpu_usage: (if stall_running { "1.2% avg" } else { "0.0%" }).into(),
            ram_usage: (if stall_running { "95 MB" } else { "0 MB" }).into(),
            storage_usage: "280 MB".into(),
            serving_state: if stall_running { "active".into() } else { "stopped".into() },
            traffic_route: "Actively Serving: Primary Mail Host (MX & Webmail :8080) on my-mac".into(),
        },
        ServiceInfo {
            id: "stalwart-smtps".into(),
            name: "  ↳ SMTPS / Submission".into(),
            description: "Outgoing mail ports 465 (TLS) and 587 (STARTTLS) — part of stalwart-mail container".into(),
            category: "mail".into(),
            group: "Mail Infrastructure".into(),
            status: if stall_smtps { "running".into() } else { "stopped".into() },
            control_type: "none".into(),
            service_type: "none".into(),
            node: "my-mac".into(),
            enabled: stall_smtps,
            port: 465,
            memory_mb: if stall_smtps { 15.0 } else { 0.0 },
            cpu_usage: (if stall_smtps { "0.2% avg" } else { "0.0%" }).into(),
            ram_usage: (if stall_smtps { "15 MB" } else { "0 MB" }).into(),
            storage_usage: "40 MB".into(),
            serving_state: if stall_smtps { "active".into() } else { "stopped".into() },
            traffic_route: "Actively Serving: Outbound Submission (Ports 465/587) on my-mac".into(),
        },
        ServiceInfo {
            id: "stalwart-imap".into(),
            name: "  ↳ IMAPS".into(),
            description: "Incoming mail port 993 (SSL/TLS) — part of stalwart-mail container".into(),
            category: "mail".into(),
            group: "Mail Infrastructure".into(),
            status: if stall_imap { "running".into() } else { "stopped".into() },
            control_type: "none".into(),
            service_type: "none".into(),
            node: "my-mac".into(),
            enabled: stall_imap,
            port: 993,
            memory_mb: if stall_imap { 20.0 } else { 0.0 },
            cpu_usage: (if stall_imap { "0.3% avg" } else { "0.0%" }).into(),
            ram_usage: (if stall_imap { "20 MB" } else { "0 MB" }).into(),
            storage_usage: "80 MB".into(),
            serving_state: if stall_imap { "active".into() } else { "stopped".into() },
            traffic_route: "Actively Serving: Inbound IMAPS (Port 993) on my-mac".into(),
        },
        // ── Game Engines (on-demand) ─────────────────────────────────────────
        ServiceInfo {
            id: "cs-panel".into(),
            name: "Counter-Strike 1.6 Panel".into(),
            description: "CS 1.6 dedicated server + web management RCON portal (cs.faizal.uk)".into(),
            category: "game".into(),
            group: "On-Demand Game Engines".into(),
            status: if cs_online { "running".into() } else { "stopped".into() },
            control_type: "systemctl".into(),
            service_type: "systemctl".into(),
            node: "my-mac".into(),
            enabled: false,
            port: 3005,
            memory_mb: if cs_online { 48.0 } else { 0.0 },
            cpu_usage: (if cs_online { "3.5% avg" } else { "0.0%" }).into(),
            ram_usage: (if cs_online { "48 MB" } else { "0 MB" }).into(),
            storage_usage: "1.1 GB".into(),
            serving_state: if cs_online { "active".into() } else { "idle".into() },
            traffic_route: "cs.faizal.uk (Port 3005) - On-Demand Game Engine".into(),
        },
        ServiceInfo {
            id: "mc-manager".into(),
            name: "Minecraft Bedrock Manager".into(),
            description: "Bedrock server + web management portal on container-of-souls compute node (mine.faizal.uk)".into(),
            category: "game".into(),
            group: "On-Demand Game Engines".into(),
            status: if mc_online { "running".into() } else { "stopped".into() },
            control_type: "systemctl".into(),
            service_type: "systemctl".into(),
            node: "container-of-souls".into(),
            enabled: false,
            port: 5000,
            memory_mb: if mc_online { 180.0 } else { 0.0 },
            cpu_usage: (if mc_online { "4.2% avg" } else { "0.0%" }).into(),
            ram_usage: (if mc_online { "180 MB" } else { "0 MB" }).into(),
            storage_usage: "1.8 GB".into(),
            serving_state: if mc_online { "active".into() } else { "idle".into() },
            traffic_route: "mine.faizal.uk (Port 5000 / 19132) on container-of-souls".into(),
        },
        // ── Core application backends ───────────────────────────────────────
        ServiceInfo {
            id: "nexus-backend".into(),
            name: "Nexus Backend".into(),
            description: "Nexus portal API (Node.js) — available during the gradual migration of app and game backends to Rust".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: if nexus_online { "running".into() } else { "stopped".into() },
            control_type: "systemctl".into(),
            service_type: "systemctl".into(),
            node: "my-mac".into(),
            enabled: false,
            port: 3010,
            memory_mb: if nexus_online { 45.0 } else { 0.0 },
            cpu_usage: (if nexus_online { "0.6% avg" } else { "0.0%" }).into(),
            ram_usage: (if nexus_online { "45 MB" } else { "0 MB" }).into(),
            storage_usage: "110 MB".into(),
            serving_state: if nexus_online { "active".into() } else { "idle".into() },
            traffic_route: "Internal App API (Port 3010) on my-mac".into(),
        },
        ServiceInfo {
            id: "bloomberg-terminal".into(),
            name: "Bloomberg Market Terminal".into(),
            description: "Bloomberg-inspired demo terminal hosted independently on container-of-souls (bloom.faizal.uk)".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: bloomberg_status.into(),
            control_type: "remote-docker".into(),
            service_type: "docker".into(),
            node: "container-of-souls".into(),
            enabled: true,
            port: 443,
            memory_mb: if bloomberg_status == "running" { 90.0 } else { 0.0 },
            cpu_usage: (if bloomberg_status == "running" { "1.6% avg" } else { "0.0%" }).into(),
            ram_usage: (if bloomberg_status == "running" { "90 MB" } else { "0 MB" }).into(),
            storage_usage: "340 MB".into(),
            serving_state: if bloomberg_status == "running" { "active".into() } else { "idle".into() },
            traffic_route: "bloom.faizal.uk (Port 443) on container-of-souls".into(),
        },
    ];

    Json(serde_json::json!({
        "success": true,
        "services": services
    }))
}

pub async fn control_service(
    State(_state): State<SharedState>,
    Path(service_id): Path<String>,
    Json(payload): Json<ServiceActionPayload>,
) -> impl IntoResponse {
    let action = payload.action.to_lowercase();
    let valid_action = match action.as_str() {
        "start" | "stop" | "restart" => action.as_str(),
        _ => {
            return Json(
                serde_json::json!({ "success": false, "error": "Invalid action (use start, stop, or restart)" }),
            )
        }
    };

    // Determine control type from service ID
    let control_type = match service_id.as_str() {
        // Docker-controlled containers
        "stalwart-mail" | "macos-server-blue" | "personal-site-rust" => "docker",
        "bloomberg-terminal" | "bedrock-server" | "minecraft" | "macos-server-green" => "remote-docker",
        // Systemctl-controlled services
        "cs-panel" | "mc-manager" | "nginx" | "nexus-backend" | "cockpit" => "systemctl",
        // Sub-ports: no direct control (controlled via parent container)
        "stalwart-smtps" | "stalwart-imap" | "stalwart-admin" => {
            return Json(serde_json::json!({
                "success": false,
                "error": "This is a sub-service of stalwart-mail. Control the parent container instead."
            }));
        }
        _ => return Json(serde_json::json!({ "success": false, "error": "Unknown service ID" })),
    };

    // Write IPC request for host runner
    let req_id = format!("{}_{}", service_id, chrono::Utc::now().timestamp_millis());
    let req_path = format!("/run/stack-service-ipc/{}.req", req_id);
    let res_path = format!("/run/stack-service-ipc/{}.res", req_id);

    // Format: "<control_type> <action> <service>"
    let content = format!("{} {} {}\n", control_type, valid_action, service_id);
    if let Err(e) = fs::write(&req_path, &content) {
        return Json(serde_json::json!({
            "success": false,
            "error": format!("Failed to create action request: {}", e)
        }));
    }

    // Wait up to 8 seconds for host runner to respond
    let mut response_text = None;
    for _ in 0..16 {
        sleep(Duration::from_millis(500)).await;
        if let Ok(res) = fs::read_to_string(&res_path) {
            response_text = Some(res);
            let _ = fs::remove_file(&res_path);
            break;
        }
    }

    match response_text {
        Some(res) if res.contains("EXIT:0") => Json(serde_json::json!({
            "success": true,
            "message": format!("'{}' {}ed successfully", service_id, valid_action)
        })),
        Some(res) => Json(serde_json::json!({
            "success": false,
            "error": format!("Action failed: {}", res.trim())
        })),
        None => Json(serde_json::json!({
            "success": false,
            "error": "Timeout waiting for host service daemon. Is stack-service-runner.service active?"
        })),
    }
}
