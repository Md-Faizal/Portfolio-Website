use crate::models::{AccessLogItem, BanIpRequest, BannedIpItem, VerifyPinRequest};
use crate::state::SharedState;
use axum::{
    extract::{ConnectInfo, Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use rusqlite::params;
use std::net::SocketAddr;
use tracing::info;

pub async fn get_access_logs(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let conn = state.db.lock().await;
    let mut stmt = match conn.prepare(
        "SELECT id, ip, status, timestamp FROM access_logs ORDER BY timestamp DESC LIMIT 50",
    ) {
        Ok(s) => s,
        Err(e) => return Json(serde_json::json!({ "success": false, "error": e.to_string(), "logs": [] })),
    };

    let logs = stmt
        .query_map([], |row| {
            Ok(AccessLogItem {
                id: row.get(0)?,
                ip: row.get(1)?,
                status: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })
        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
        .unwrap_or_default();

    Json(serde_json::json!({
        "success": true,
        "logs": logs
    }))
}

pub async fn get_banned_ips(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let conn = state.db.lock().await;
    let mut stmt = match conn.prepare("SELECT ip, reason, timestamp FROM banned_ips") {
        Ok(s) => s,
        Err(e) => return Json(serde_json::json!({ "success": false, "error": e.to_string(), "ips": [] })),
    };

    let ips = stmt
        .query_map([], |row| {
            Ok(BannedIpItem {
                ip: row.get(0)?,
                reason: row.get(1)?,
                timestamp: row.get(2)?,
            })
        })
        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
        .unwrap_or_default();

    Json(serde_json::json!({
        "success": true,
        "ips": ips
    }))
}

pub async fn ban_ip(
    State(state): State<SharedState>,
    Json(payload): Json<BanIpRequest>,
) -> impl IntoResponse {
    let conn = state.db.lock().await;
    match conn.execute(
        "INSERT OR REPLACE INTO banned_ips (ip, reason) VALUES (?1, ?2)",
        params![payload.ip, payload.reason],
    ) {
        Ok(_) => Json(serde_json::json!({ "success": true })),
        Err(e) => Json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn unban_ip(
    State(state): State<SharedState>,
    Path(ip): Path<String>,
) -> impl IntoResponse {
    let conn = state.db.lock().await;
    match conn.execute("DELETE FROM banned_ips WHERE ip = ?1", params![ip]) {
        Ok(_) => Json(serde_json::json!({ "success": true })),
        Err(e) => Json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn verify_pin(
    State(state): State<SharedState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<VerifyPinRequest>,
) -> impl IntoResponse {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .unwrap_or_else(|| addr.ip().to_string());

    let is_valid = payload.pin == state.config.admin_pin;
    let status_str = if is_valid { "SUCCESS" } else { "FAILURE" };

    info!("PIN verification from {} - {}", ip, status_str);

    let conn = state.db.lock().await;
    let _ = conn.execute(
        "INSERT INTO access_logs (ip, status) VALUES (?1, ?2)",
        params![ip, status_str],
    );

    Json(serde_json::json!({ "success": is_valid }))
}
