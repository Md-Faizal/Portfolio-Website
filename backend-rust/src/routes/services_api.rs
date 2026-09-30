use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Duration;
use tokio::time::sleep;
use crate::SharedState;

// ─── Service / Container info ────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ServiceInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,   // "core" | "mail" | "game"
    pub group: String,      // display group label
    pub status: String,     // "running" | "stopped"
    pub control_type: String, // "docker" | "systemctl" | "none"
    pub enabled: bool,
    pub port: u16,
    pub memory_mb: f64,
}

#[derive(Deserialize)]
pub struct ServiceActionPayload {
    pub action: String,
}

async fn check_tcp_port(port: u16) -> bool {
    tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_ok()
}

/// Check if a Docker container is running
fn docker_running(name: &str) -> bool {
    std::process::Command::new("docker")
        .args(["inspect", "-f", "{{.State.Running}}", name])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false)
}

pub async fn list_services(
    State(_state): State<SharedState>,
) -> impl IntoResponse {
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
    let stall_running  = docker_running("stalwart-mail");
    let macos_running  = docker_running("macos-server-blue");

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
            enabled: true,
            port: 80,
            memory_mb: 0.0,
        },
        ServiceInfo {
            id: "personal-site-rust".into(),
            name: "Personal Site (Rust)".into(),
            description: "Main Axum backend — API, portfolio, health engine, admin dashboard".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: "running".into(),
            control_type: "docker".into(),
            enabled: true,
            port: 3002,
            memory_mb: 0.0,
        },
        ServiceInfo {
            id: "macos-server-blue".into(),
            name: "MacOS Desktop Server".into(),
            description: "Interactive macOS-themed virtual desktop portal (mac.faizal.uk)".into(),
            category: "core".into(),
            group: "Core Infrastructure".into(),
            status: if macos_running { "running".into() } else { "stopped".into() },
            control_type: "docker".into(),
            enabled: true,
            port: 3001,
            memory_mb: 0.0,
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
            enabled: true,
            port: 8080,
            memory_mb: 0.0,
        },
        ServiceInfo {
            id: "stalwart-smtps".into(),
            name: "  ↳ SMTPS / Submission".into(),
            description: "Outgoing mail ports 465 (TLS) and 587 (STARTTLS) — part of stalwart-mail container".into(),
            category: "mail".into(),
            group: "Mail Infrastructure".into(),
            status: if stall_smtps { "running".into() } else { "stopped".into() },
            control_type: "none".into(),
            enabled: stall_smtps,
            port: 465,
            memory_mb: 0.0,
        },
        ServiceInfo {
            id: "stalwart-imap".into(),
            name: "  ↳ IMAPS".into(),
            description: "Incoming mail port 993 (SSL/TLS) — part of stalwart-mail container".into(),
            category: "mail".into(),
            group: "Mail Infrastructure".into(),
            status: if stall_imap { "running".into() } else { "stopped".into() },
            control_type: "none".into(),
            enabled: stall_imap,
            port: 993,
            memory_mb: 0.0,
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
            enabled: false,
            port: 3005,
            memory_mb: if cs_online { 24.0 } else { 0.0 },
        },
        ServiceInfo {
            id: "mc-manager".into(),
            name: "Minecraft Bedrock Manager".into(),
            description: "Bedrock server + web management portal (mine.faizal.uk)".into(),
            category: "game".into(),
            group: "On-Demand Game Engines".into(),
            status: if mc_online { "running".into() } else { "stopped".into() },
            control_type: "systemctl".into(),
            enabled: false,
            port: 5000,
            memory_mb: if mc_online { 32.0 } else { 0.0 },
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
            enabled: false,
            port: 3010,
            memory_mb: 0.0,
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
        _ => return Json(serde_json::json!({ "success": false, "error": "Invalid action (use start, stop, or restart)" })),
    };

    // Determine control type from service ID
    let control_type = match service_id.as_str() {
        // Docker-controlled containers
        "stalwart-mail" | "macos-server-blue" | "personal-site-rust" => "docker",
        // Systemctl-controlled services  
        "cs-panel" | "mc-manager" | "nginx" | "nexus-backend" => "systemctl",
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
        Some(res) if res.contains("EXIT:0") => {
            Json(serde_json::json!({
                "success": true,
                "message": format!("'{}' {}ed successfully", service_id, valid_action)
            }))
        }
        Some(res) => {
            Json(serde_json::json!({
                "success": false,
                "error": format!("Action failed: {}", res.trim())
            }))
        }
        None => {
            Json(serde_json::json!({
                "success": false,
                "error": "Timeout waiting for host service daemon. Is stack-service-runner.service active?"
            }))
        }
    }
}
