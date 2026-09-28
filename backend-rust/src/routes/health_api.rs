use crate::health::{collect_system_health, generate_report_html};
use crate::mailer::send_report_email;
use crate::models::{HealthConfigUpdate, SendReportRequest};
use crate::state::SharedState;
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use rusqlite::params;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use tracing::error;

pub async fn get_system_stats(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );
    sys.refresh_all();

    let os_stats = serde_json::json!({
        "platform": System::name().unwrap_or_else(|| "Linux".into()),
        "release": System::os_version().unwrap_or_else(|| "".into()),
        "uptime": System::uptime(),
        "totalMem": sys.total_memory(),
        "freeMem": sys.free_memory(),
        "cpus": sys.cpus().len(),
        "loadAvg": [System::load_average().one, System::load_average().five, System::load_average().fifteen]
    });

    let conn = state.db.lock().await;
    let (views, unique_v): (i64, i64) = conn
        .query_row(
            "SELECT COUNT(*), COUNT(DISTINCT ip) FROM visitors",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    let mut stmt = conn
        .prepare("SELECT ip, user_agent, path, timestamp FROM visitors ORDER BY timestamp DESC LIMIT 10")
        .ok();

    let recent = stmt
        .as_mut()
        .map(|s| {
            s.query_map([], |r| {
                Ok(serde_json::json!({
                    "ip": r.get::<_, Option<String>>(0)?,
                    "user_agent": r.get::<_, Option<String>>(1)?,
                    "path": r.get::<_, Option<String>>(2)?,
                    "timestamp": r.get::<_, Option<String>>(3)?,
                }))
            })
            .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
            .unwrap_or_default()
        })
        .unwrap_or_default();

    // Call pm2 jlist if available
    let pm2_data: Vec<serde_json::Value> = if let Ok(out) = std::process::Command::new("pm2").arg("jlist").output() {
        serde_json::from_slice::<serde_json::Value>(&out.stdout)
            .ok()
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    Json(serde_json::json!({
        "success": true,
        "stats": {
            "os": os_stats,
            "pm2": pm2_data,
            "analytics": {
                "totalViews": views,
                "uniqueVisitors": unique_v,
                "recentVisitors": recent
            }
        }
    }))
}

pub async fn get_health_data(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let data = collect_system_health(&state.db).await;
    Json(serde_json::json!({ "success": true, "data": data }))
}

pub async fn get_health_preview(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let data = collect_system_health(&state.db).await;
    let html = generate_report_html(&data);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "text/html; charset=utf-8".parse().unwrap());
    (StatusCode::OK, headers, html).into_response()
}

pub async fn send_health_report(
    State(state): State<SharedState>,
    payload: Option<Json<SendReportRequest>>,
) -> impl IntoResponse {
    let recipient_override = payload.and_then(|p| p.recipient.clone()).unwrap_or_default();
    let recipient = if !recipient_override.trim().is_empty() {
        recipient_override
    } else {
        crate::db::get_setting(&state.db, "report_recipient_email")
            .await
            .unwrap_or_else(|| "me@faizal.uk".into())
    };

    let data = collect_system_health(&state.db).await;
    let html = generate_report_html(&data);
    let subject = format!(
        "[{}] Faizal VM Manual Health Report — {}",
        data.overall_status,
        Utc::now().format("%b %d, %Y %H:%M UTC")
    );

    let result = send_report_email(&state.config, &state.db, &recipient, &subject, html).await;

    let (status_str, err_msg) = match result {
        Ok(_) => ("SUCCESS".to_string(), None),
        Err(e) => (format!("FAILED: {}", e), Some(e)),
    };

    let _ = crate::db::set_setting(&state.db, "last_report_timestamp", &Utc::now().to_rfc3339()).await;
    let _ = crate::db::set_setting(&state.db, "last_report_status", &status_str).await;

    // Log to health_reports table
    {
        let conn = state.db.lock().await;
        let _ = conn.execute(
            "INSERT INTO health_reports (recipient, overall_health, error_count, trigger_source, delivery_status, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                recipient,
                data.overall_status,
                data.errors24h.total_error_count as i64,
                "admin_dashboard",
                status_str,
                serde_json::to_string(&data.health_issues).unwrap_or_default()
            ],
        );
    }

    if let Some(err) = err_msg {
        Json(serde_json::json!({ "success": false, "error": err }))
    } else {
        Json(serde_json::json!({
            "success": true,
            "message": format!("Report successfully dispatched to {}", recipient)
        }))
    }
}

pub async fn get_health_status(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let recipient = crate::db::get_setting(&state.db, "report_recipient_email")
        .await
        .unwrap_or_else(|| "me@faizal.uk".into());
    let enabled = crate::db::get_setting(&state.db, "report_enabled")
        .await
        .map(|v| v != "false")
        .unwrap_or(true);
    let time = crate::db::get_setting(&state.db, "report_time")
        .await
        .unwrap_or_else(|| "08:00".into());
    let last_sent = crate::db::get_setting(&state.db, "last_report_timestamp").await;
    let last_status = crate::db::get_setting(&state.db, "last_report_status").await;

    let conn = state.db.lock().await;
    let mut stmt = conn
        .prepare("SELECT id, timestamp, recipient, overall_health, error_count, trigger_source, delivery_status, details FROM health_reports ORDER BY timestamp DESC LIMIT 15")
        .ok();

    let history = stmt
        .as_mut()
        .map(|s| {
            s.query_map([], |r| {
                Ok(serde_json::json!({
                    "id": r.get::<_, i64>(0)?,
                    "timestamp": r.get::<_, String>(1)?,
                    "recipient": r.get::<_, Option<String>>(2)?,
                    "overall_health": r.get::<_, Option<String>>(3)?,
                    "error_count": r.get::<_, Option<i64>>(4)?,
                    "trigger_source": r.get::<_, Option<String>>(5)?,
                    "delivery_status": r.get::<_, Option<String>>(6)?,
                    "details": r.get::<_, Option<String>>(7)?,
                }))
            })
            .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
            .unwrap_or_default()
        })
        .unwrap_or_default();

    Json(serde_json::json!({
        "success": true,
        "settings": {
            "recipient": recipient,
            "enabled": enabled,
            "time": time,
            "lastSent": last_sent,
            "lastStatus": last_status
        },
        "history": history
    }))
}

pub async fn update_health_config(
    State(state): State<SharedState>,
    Json(payload): Json<HealthConfigUpdate>,
) -> impl IntoResponse {
    if let Some(r) = payload.recipient {
        let _ = crate::db::set_setting(&state.db, "report_recipient_email", &r).await;
    }
    if let Some(e) = payload.enabled {
        let val_str = match e {
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::String(s) => s,
            _ => "true".into(),
        };
        let _ = crate::db::set_setting(&state.db, "report_enabled", &val_str).await;
    }
    if let Some(t) = payload.time {
        let _ = crate::db::set_setting(&state.db, "report_time", &t).await;
    }

    Json(serde_json::json!({
        "success": true,
        "message": "Health report settings updated."
    }))
}

pub async fn get_health_errors(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let data = collect_system_health(&state.db).await;
    Json(serde_json::json!({
        "success": true,
        "errors": data.errors24h,
        "healthIssues": data.health_issues
    }))
}

pub async fn test_email(
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let recipient = crate::db::get_setting(&state.db, "notification_email")
        .await
        .unwrap_or_else(|| "me@faizal.uk".into());

    let subject = "Test Email from Personal Site (Rust Backend)";
    let body = r#"<div style="font-family:sans-serif;padding:20px;background:#0b0b0c;color:#fff;">
        <h2 style="color:#d4af37">Test Email Successful!</h2>
        <p>Your Rust Axum server and Brevo SMTP relay are operating flawlessly.</p>
    </div>"#.to_string();

    match send_report_email(&state.config, &state.db, &recipient, subject, body).await {
        Ok(_) => Json(serde_json::json!({ "success": true })),
        Err(e) => {
            error!("Test email error: {}", e);
            Json(serde_json::json!({ "success": false, "error": e }))
        }
    }
}
