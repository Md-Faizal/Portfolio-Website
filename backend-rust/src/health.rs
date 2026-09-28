use crate::config::AppConfig;
use crate::db::DbPool;
use crate::mailer::send_report_email;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use tokio::time::sleep;
use tracing::info;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CpuData {
    pub cores: usize,
    pub model: String,
    pub load_avg_1m: String,
    pub load_avg_5m: String,
    pub load_avg_15m: String,
    pub load_percent: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryData {
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub used_percent: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub swap_used_percent: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiskData {
    pub filesystem: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub avail_bytes: u64,
    pub used_percent: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pm2Process {
    pub name: String,
    pub id: i64,
    pub pid: i64,
    pub status: String,
    pub cpu: f64,
    pub memory_bytes: u64,
    pub memory_formatted: String,
    pub restarts: i64,
    pub uptime_formatted: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pm2Summary {
    pub total: usize,
    pub online: usize,
    pub errored: usize,
    pub stopped: usize,
    pub total_memory_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub health: String,
    pub cpu: String,
    pub memory: String,
    pub net_io: String,
    pub ports: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerSummary {
    pub total: usize,
    pub running: usize,
    pub healthy: usize,
    pub unhealthy: usize,
    pub stopped: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServiceProbe {
    pub name: String,
    pub port: u16,
    pub status: String,
    pub badge_class: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pm2LogFile {
    pub file: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Errors24h {
    pub systemd: Vec<String>,
    pub nginx: Vec<String>,
    pub pm2: Vec<Pm2LogFile>,
    pub kernel: Vec<String>,
    pub ssh_auth_failures: usize,
    pub total_error_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Analytics24h {
    pub views: i64,
    pub unique_visitors: i64,
    pub messages_received: i64,
    pub admin_logins_success: i64,
    pub admin_logins_failed: i64,
    pub banned_ips_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemHealthData {
    pub collected_at: String,
    pub hostname: String,
    pub platform: String,
    pub release: String,
    pub arch: String,
    pub uptime_seconds: u64,
    pub uptime_formatted: String,
    pub cpu: CpuData,
    pub memory: MemoryData,
    pub disk: DiskData,
    pub pm2: Vec<Pm2Process>,
    pub pm2_summary: Pm2Summary,
    pub docker: Vec<DockerContainer>,
    pub docker_summary: DockerSummary,
    pub services: Vec<ServiceProbe>,
    pub errors24h: Errors24h,
    pub analytics24h: Analytics24h,
    pub overall_status: String,
    pub health_issues: Vec<String>,
}

pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn format_uptime(secs: u64) -> String {
    let d = secs / (3600 * 24);
    let h = (secs % (3600 * 24)) / 3600;
    let m = (secs % 3600) / 60;
    if d > 0 {
        format!("{}d {}h {}m", d, h, m)
    } else if h > 0 {
        format!("{}h {}m", h, m)
    } else {
        format!("{}m", m)
    }
}

fn run_cmd(cmd: &str) -> Option<String> {
    if cfg!(target_os = "windows") {
        let out = Command::new("powershell").args(["-Command", cmd]).output().ok()?;
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let out = Command::new("bash").args(["-c", cmd]).output().ok()?;
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
}

async fn check_tcp_port(port: u16) -> bool {
    tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_ok()
}

pub async fn collect_system_health(db: &DbPool) -> SystemHealthData {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );
    sys.refresh_all();

    let uptime = System::uptime();
    let hostname = System::host_name().unwrap_or_else(|| "faizal-vm".into());
    let os_name = System::name().unwrap_or_else(|| "Linux".into());
    let os_version = System::os_version().unwrap_or_else(|| "".into());
    let arch = std::env::consts::ARCH.to_string();

    let cpu_count = sys.cpus().len().max(1);
    let cpu_model = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Generic CPU".into());
    let load_avg = System::load_average();

    let load_pct = if cpu_count > 0 {
        ((load_avg.one / cpu_count as f64) * 100.0).clamp(0.0, 100.0) as u64
    } else {
        0
    };

    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let free_mem = sys.free_memory();
    let mem_used_pct = if total_mem > 0 {
        ((used_mem as f64 / total_mem as f64) * 100.0) as u64
    } else {
        0
    };

    let total_swap = sys.total_swap();
    let used_swap = sys.used_swap();
    let swap_used_pct = if total_swap > 0 {
        ((used_swap as f64 / total_swap as f64) * 100.0) as u64
    } else {
        0
    };

    // Disks
    let disks = Disks::new_with_refreshed_list();
    let root_disk = disks.iter().find(|d| d.mount_point().to_str() == Some("/") || d.mount_point().to_str() == Some("C:\\"));
    let (disk_fs, disk_total, disk_avail, disk_used, disk_used_pct) = if let Some(d) = root_disk {
        let total = d.total_space();
        let avail = d.available_space();
        let used = total.saturating_sub(avail);
        let pct = if total > 0 { ((used as f64 / total as f64) * 100.0) as u64 } else { 0 };
        (d.name().to_string_lossy().to_string(), total, avail, used, pct)
    } else {
        ("root".into(), 0, 0, 0, 0)
    };

    let mut health_issues = Vec::new();

    // PM2 Inspection
    let mut pm2_list = Vec::new();
    let mut pm2_summary = Pm2Summary { total: 0, online: 0, errored: 0, stopped: 0, total_memory_bytes: 0 };
    if let Some(stdout) = run_cmd("pm2 jlist") {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if let Some(arr) = val.as_array() {
                pm2_summary.total = arr.len();
                for p in arr {
                    let name = p["name"].as_str().unwrap_or("unknown").to_string();
                    let status = p["pm2_env"]["status"].as_str().unwrap_or("stopped").to_string();
                    let mem = p["monit"]["memory"].as_u64().unwrap_or(0);
                    let cpu = p["monit"]["cpu"].as_f64().unwrap_or(0.0);
                    let restarts = p["pm2_env"]["restart_time"].as_i64().unwrap_or(0);
                    let pm_uptime = p["pm2_env"]["pm_uptime"].as_i64().unwrap_or(0);
                    let up_secs = if pm_uptime > 0 {
                        ((chrono::Utc::now().timestamp_millis() - pm_uptime) / 1000).max(0) as u64
                    } else {
                        0
                    };

                    if status == "online" {
                        pm2_summary.online += 1;
                    } else if status == "errored" {
                        pm2_summary.errored += 1;
                        health_issues.push(format!("PM2 process '{}' is in ERRORED state!", name));
                    } else {
                        pm2_summary.stopped += 1;
                    }

                    if restarts > 50 {
                        health_issues.push(format!("PM2 process '{}' has excessive restarts ({})", name, restarts));
                    }

                    pm2_summary.total_memory_bytes += mem;

                    pm2_list.push(Pm2Process {
                        name,
                        id: p["pm_id"].as_i64().unwrap_or(0),
                        pid: p["pid"].as_i64().unwrap_or(0),
                        status,
                        cpu,
                        memory_bytes: mem,
                        memory_formatted: format_bytes(mem),
                        restarts,
                        uptime_formatted: format_uptime(up_secs),
                    });
                }
            }
        }
    }

    // Docker Inspection
    let mut docker_list = Vec::new();
    let mut docker_summary = DockerSummary { total: 0, running: 0, healthy: 0, unhealthy: 0, stopped: 0 };
    if let Some(stdout) = run_cmd("docker ps -a --format '{{json .}}'") {
        for line in stdout.lines() {
            if let Ok(c) = serde_json::from_str::<serde_json::Value>(line) {
                let name = c["Names"].as_str().unwrap_or("").to_string();
                let status_str = c["Status"].as_str().unwrap_or("").to_string();
                let state = c["State"].as_str().unwrap_or("").to_string();
                let is_running = state == "running";
                let health = if status_str.contains("(healthy)") {
                    "healthy".to_string()
                } else if status_str.contains("(unhealthy)") {
                    "unhealthy".to_string()
                } else {
                    "none".to_string()
                };

                docker_summary.total += 1;
                if is_running {
                    docker_summary.running += 1;
                } else {
                    docker_summary.stopped += 1;
                }

                if health == "healthy" {
                    docker_summary.healthy += 1;
                } else if health == "unhealthy" {
                    docker_summary.unhealthy += 1;
                    health_issues.push(format!("Docker container '{}' is UNHEALTHY!", name));
                }

                docker_list.push(DockerContainer {
                    id: c["ID"].as_str().unwrap_or("").chars().take(12).collect(),
                    name,
                    image: c["Image"].as_str().unwrap_or("").to_string(),
                    state,
                    status: status_str,
                    health,
                    cpu: "0.0%".into(),
                    memory: "0B".into(),
                    net_io: "0B / 0B".into(),
                    ports: c["Ports"].as_str().unwrap_or("").to_string(),
                });
            }
        }
    }

    // Service probes
    let ports = [
        ("Nginx Web (HTTP)", 80),
        ("Personal Site (Rust)", 3002),
        ("Stalwart Mail Admin/API", 8080),
        ("Stalwart SMTPS (465)", 465),
        ("Stalwart Submission (587)", 587),
        ("Stalwart IMAPS (993)", 993),
        ("MacOS Server (Blue)", 3001),
        ("CS Panel Web", 3005),
        ("Nexus Backend", 3010),
    ];

    let mut services = Vec::new();
    for (name, port) in ports {
        let is_open = check_tcp_port(port).await;
        if !is_open && (name.contains("Nginx") || name.contains("Personal Site") || name.contains("Stalwart Submission")) {
            health_issues.push(format!("Core service '{}' on port {} is unreachable", name, port));
        }
        services.push(ServiceProbe {
            name: name.into(),
            port,
            status: if is_open { "ONLINE".into() } else { "OFFLINE".into() },
            badge_class: if is_open { "status-online".into() } else { "status-fail".into() },
        });
    }

    // Errors 24h
    let mut systemd_errors = Vec::new();
    let mut ssh_failures = 0;
    if let Some(stdout) = run_cmd("journalctl --since '24 hours ago' -p 3 --no-pager -n 40 2>/dev/null") {
        for line in stdout.lines() {
            if line.contains("sshd") && (line.contains("Failed") || line.contains("invalid user")) {
                ssh_failures += 1;
            } else if !line.trim().is_empty() {
                systemd_errors.push(line.to_string());
            }
        }
    }

    let mut kernel_errors = Vec::new();
    if let Some(stdout) = run_cmd("dmesg -l err,crit,alert,emerg --color=never 2>/dev/null | tail -n 15") {
        for line in stdout.lines() {
            if !line.trim().is_empty() {
                kernel_errors.push(line.to_string());
            }
        }
    }

    let mut nginx_errors = Vec::new();
    if let Some(stdout) = run_cmd("tail -n 20 /var/log/nginx/error.log 2>/dev/null") {
        for line in stdout.lines() {
            if !line.trim().is_empty() {
                nginx_errors.push(line.to_string());
            }
        }
    }

    let total_err_count = systemd_errors.len() + kernel_errors.len() + nginx_errors.len();

    // Analytics from SQLite
    let (views, unique_v, msgs, admin_ok, admin_fail, ban_cnt) = {
        let conn = db.lock().await;
        let v: i64 = conn.query_row(
            "SELECT COUNT(*) FROM visitors WHERE timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        let uv: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT ip) FROM visitors WHERE timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        let m: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        let a_ok: i64 = conn.query_row(
            "SELECT COUNT(*) FROM access_logs WHERE status = 'SUCCESS' AND timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        let a_fail: i64 = conn.query_row(
            "SELECT COUNT(*) FROM access_logs WHERE status = 'FAILURE' AND timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        let b: i64 = conn.query_row(
            "SELECT COUNT(*) FROM banned_ips",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        (v, uv, m, a_ok, a_fail, b)
    };

    // Calculate overall status
    let mut overall_status = "HEALTHY".to_string();
    if disk_used_pct >= 92 {
        overall_status = "CRITICAL".into();
        health_issues.push(format!("Disk usage critically high: {}%", disk_used_pct));
    } else if disk_used_pct >= 85 {
        overall_status = "WARNING".into();
        health_issues.push(format!("Disk space usage elevated: {}%", disk_used_pct));
    }

    if mem_used_pct >= 92 {
        if overall_status != "CRITICAL" {
            overall_status = "WARNING".into();
        }
        health_issues.push(format!("RAM usage elevated: {}%", mem_used_pct));
    }

    if pm2_summary.errored > 0 || docker_summary.unhealthy > 0 {
        overall_status = "CRITICAL".into();
    } else if !health_issues.is_empty() && overall_status == "HEALTHY" {
        overall_status = "WARNING".into();
    }

    SystemHealthData {
        collected_at: Utc::now().to_rfc3339(),
        hostname,
        platform: os_name,
        release: os_version,
        arch,
        uptime_seconds: uptime,
        uptime_formatted: format_uptime(uptime),
        cpu: CpuData {
            cores: cpu_count,
            model: cpu_model,
            load_avg_1m: format!("{:.2}", load_avg.one),
            load_avg_5m: format!("{:.2}", load_avg.five),
            load_avg_15m: format!("{:.2}", load_avg.fifteen),
            load_percent: load_pct,
        },
        memory: MemoryData {
            total_bytes: total_mem,
            free_bytes: free_mem,
            used_bytes: used_mem,
            used_percent: mem_used_pct,
            swap_total_bytes: total_swap,
            swap_used_bytes: used_swap,
            swap_used_percent: swap_used_pct,
        },
        disk: DiskData {
            filesystem: disk_fs,
            total_bytes: disk_total,
            used_bytes: disk_used,
            avail_bytes: disk_avail,
            used_percent: disk_used_pct,
        },
        pm2: pm2_list,
        pm2_summary,
        docker: docker_list,
        docker_summary,
        services,
        errors24h: Errors24h {
            systemd: systemd_errors,
            nginx: nginx_errors,
            pm2: Vec::new(),
            kernel: kernel_errors,
            ssh_auth_failures: ssh_failures,
            total_error_count: total_err_count,
        },
        analytics24h: Analytics24h {
            views,
            unique_visitors: unique_v,
            messages_received: msgs,
            admin_logins_success: admin_ok,
            admin_logins_failed: admin_fail,
            banned_ips_count: ban_cnt,
        },
        overall_status,
        health_issues,
    }
}

pub fn generate_report_html(data: &SystemHealthData) -> String {
    let (status_color, status_text) = match data.overall_status.as_str() {
        "CRITICAL" => ("#ef4444", "CRITICAL ATTENTION REQUIRED"),
        "WARNING" => ("#f59e0b", "SYSTEM WARNINGS DETECTED"),
        _ => ("#10b981", "ALL SYSTEMS OPERATIONAL"),
    };

    let issues_html = if data.health_issues.is_empty() {
        "<p style=\"color: #10b981; margin: 0;\">✓ Zero active critical health anomalies detected.</p>".to_string()
    } else {
        data.health_issues
            .iter()
            .map(|i| format!("<li style=\"color: #f59e0b; margin-bottom: 4px;\">⚠️ {}</li>", i))
            .collect::<Vec<_>>()
            .join("")
    };

    let pm2_rows = data.pm2.iter().map(|p| {
        let is_online = p.status == "online";
        let color = if is_online { "#10b981" } else { "#ef4444" };
        format!(
            r#"<tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 10px 12px; font-weight: 600; color: #ffffff;">{}</td>
                <td style="padding: 10px 12px;"><span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: {};">{}</span></td>
                <td style="padding: 10px 12px; color: #cbd5e1;">{}%</td>
                <td style="padding: 10px 12px; color: #cbd5e1;">{}</td>
                <td style="padding: 10px 12px; color: #94a3b8; font-size: 12px;">{}</td>
            </tr>"#,
            p.name, color, p.status.to_uppercase(), p.cpu, p.memory_formatted, p.uptime_formatted
        )
    }).collect::<Vec<_>>().join("");

    let docker_rows = data.docker.iter().map(|c| {
        let is_healthy = c.health == "healthy" || (c.state == "running" && c.health == "none");
        let color = if is_healthy { "#10b981" } else { "#ef4444" };
        format!(
            r#"<tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 10px 12px; font-weight: 600; color: #ffffff;">{}</td>
                <td style="padding: 10px 12px; color: #94a3b8; font-size: 12px;">{}</td>
                <td style="padding: 10px 12px;"><span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: {};">{}</span></td>
            </tr>"#,
            c.name, c.image, color, c.state.to_uppercase()
        )
    }).collect::<Vec<_>>().join("");

    format!(
        r##"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0b0d; color: #e2e8f0; margin: 0; padding: 20px; }}
.card {{ background: #16161a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
.header {{ border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 15px; margin-bottom: 20px; }}
.badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }}
.metric {{ display: inline-block; width: 30%; min-width: 150px; margin-bottom: 15px; }}
.metric-val {{ font-size: 22px; font-weight: bold; color: #ffffff; }}
.metric-lbl {{ font-size: 12px; color: #94a3b8; }}
table {{ width: 100%; border-collapse: collapse; }}
th {{ text-align: left; padding: 8px 12px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }}
</style>
</head>
<body>
<div style="max-width: 720px; margin: 0 auto;">
    <div class="card header">
        <h2 style="color: #d4af37; margin: 0 0 8px 0;">VM 24h Executive Health Report</h2>
        <div style="font-size: 13px; color: #94a3b8;">Host: {} &bull; {} &bull; Uptime: {}</div>
        <div style="margin-top: 12px;">
            <span class="badge" style="background: {}; color: #000;">{}</span>
        </div>
    </div>

    <div class="card">
        <h3 style="color: #d4af37; margin-top: 0;">System Performance Core</h3>
        <div class="metric">
            <div class="metric-lbl">CPU Load (1m)</div>
            <div class="metric-val">{}%</div>
            <div class="metric-lbl">{} cores</div>
        </div>
        <div class="metric">
            <div class="metric-lbl">RAM Usage</div>
            <div class="metric-val">{}%</div>
            <div class="metric-lbl">{} / {}</div>
        </div>
        <div class="metric">
            <div class="metric-lbl">Disk Usage (/)</div>
            <div class="metric-val">{}%</div>
            <div class="metric-lbl">{} / {}</div>
        </div>
    </div>

    <div class="card">
        <h3 style="color: #d4af37; margin-top: 0;">Anomalies & Status</h3>
        <ul style="padding-left: 20px; margin: 0;">
            {}
        </ul>
    </div>

    <div class="card">
        <h3 style="color: #d4af37; margin-top: 0;">PM2 Applications ({})</h3>
        <table>
            <thead><tr><th>Process</th><th>Status</th><th>CPU</th><th>RAM</th><th>Uptime</th></tr></thead>
            <tbody>{}</tbody>
        </table>
    </div>

    <div class="card">
        <h3 style="color: #d4af37; margin-top: 0;">Docker Services ({})</h3>
        <table>
            <thead><tr><th>Container</th><th>Image</th><th>Status</th></tr></thead>
            <tbody>{}</tbody>
        </table>
    </div>

    <div style="text-align: center; color: #64748b; font-size: 12px; margin-top: 20px;">
        Generated natively by Faizal Rust Axum Daemon &bull; {}
    </div>
</div>
</body>
</html>"##,
        data.hostname, data.platform, data.uptime_formatted,
        status_color, status_text,
        data.cpu.load_percent, data.cpu.cores,
        data.memory.used_percent, format_bytes(data.memory.used_bytes), format_bytes(data.memory.total_bytes),
        data.disk.used_percent, format_bytes(data.disk.used_bytes), format_bytes(data.disk.total_bytes),
        issues_html,
        data.pm2.len(), pm2_rows,
        data.docker.len(), docker_rows,
        data.collected_at
    )
}

pub async fn run_scheduled_reporter(config: AppConfig, db: DbPool) {
    loop {
        sleep(Duration::from_secs(60)).await;

        let enabled = crate::db::get_setting(&db, "report_enabled")
            .await
            .map(|v| v == "true")
            .unwrap_or(true);

        if !enabled {
            continue;
        }

        let scheduled_time = crate::db::get_setting(&db, "report_time")
            .await
            .unwrap_or_else(|| "08:00".into());

        let now: DateTime<Utc> = Utc::now();
        let current_hm = now.format("%H:%M").to_string();

        if current_hm == scheduled_time {
            let last_sent = crate::db::get_setting(&db, "last_report_timestamp").await;
            let current_date = now.format("%Y-%m-%d").to_string();

            if let Some(ref last) = last_sent {
                if last.starts_with(&current_date) {
                    continue; // Already sent today
                }
            }

            let recipient = crate::db::get_setting(&db, "report_recipient_email")
                .await
                .unwrap_or_else(|| "me@faizal.uk".into());

            info!("Triggering scheduled daily health report for {}", recipient);
            let health_data = collect_system_health(&db).await;
            let html = generate_report_html(&health_data);
            let subject = format!(
                "[{}] Faizal VM 24h Health Report — {}",
                health_data.overall_status,
                now.format("%b %d, %Y")
            );

            let status_result = match send_report_email(&config, &db, &recipient, &subject, html).await {
                Ok(_) => "SUCCESS".to_string(),
                Err(e) => format!("FAILED: {}", e),
            };

            let _ = crate::db::set_setting(&db, "last_report_timestamp", &now.to_rfc3339()).await;
            let _ = crate::db::set_setting(&db, "last_report_status", &status_result).await;

            // Log to health_reports table
            let conn = db.lock().await;
            let _ = conn.execute(
                "INSERT INTO health_reports (recipient, overall_health, error_count, trigger_source, delivery_status, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    recipient,
                    health_data.overall_status,
                    health_data.errors24h.total_error_count as i64,
                    "scheduled_cron",
                    status_result,
                    serde_json::to_string(&health_data.health_issues).unwrap_or_default()
                ],
            );
        }
    }
}
