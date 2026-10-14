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
    pub size: String,
    pub created: String,
    pub network: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerImageItem {
    pub repository: String,
    pub tag: String,
    pub id: String,
    pub size: String,
    pub created: String,
    pub containers: String,
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
pub struct Errors24h {
    pub systemd: Vec<String>,
    pub nginx: Vec<String>,
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
    pub slave: Option<serde_json::Value>,
    pub docker: Vec<DockerContainer>,
    pub docker_images: Vec<DockerImageItem>,
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
        let out = Command::new("sh").args(["-c", cmd]).output().ok()?;
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

    let total_mem_sys = sys.total_memory();
    let mut total_mem = total_mem_sys;
    let mut used_mem = sys.used_memory();
    let mut free_mem = sys.free_memory();
    let mut mem_used_pct = if total_mem > 0 {
        ((used_mem as f64 / total_mem as f64) * 100.0) as u64
    } else {
        0
    };

    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        let mut p_total: u64 = 0;
        let mut p_free: u64 = 0;
        let mut p_avail: u64 = 0;
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                p_total = line.split_whitespace().nth(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0) * 1024;
            } else if line.starts_with("MemFree:") {
                p_free = line.split_whitespace().nth(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0) * 1024;
            } else if line.starts_with("MemAvailable:") {
                p_avail = line.split_whitespace().nth(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0) * 1024;
            }
        }
        if p_total > 0 {
            let eff_free = if p_avail > 0 { p_avail } else { p_free };
            total_mem = p_total;
            free_mem = eff_free;
            used_mem = p_total.saturating_sub(eff_free);
            mem_used_pct = ((used_mem as f64 / p_total as f64) * 100.0).round() as u64;
        }
    }

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

    // Query Cluster Slave Node (container-of-souls via 127.0.0.1:9100 tunnel)
    let slave_data: Option<serde_json::Value> = {
        let connect_res = tokio::time::timeout(
            std::time::Duration::from_millis(1500),
            tokio::net::TcpStream::connect("127.0.0.1:9100"),
        )
        .await;

        if let Ok(Ok(mut stream)) = connect_res {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let req = "GET /stats HTTP/1.1\r\nHost: 127.0.0.1:9100\r\nConnection: close\r\n\r\n";
            if stream.write_all(req.as_bytes()).await.is_ok() {
                let mut buf = Vec::new();
                if stream.read_to_end(&mut buf).await.is_ok() {
                    let response = String::from_utf8_lossy(&buf);
                    let body = if let Some(pos) = response.find("\r\n\r\n") {
                        &response[pos + 4..]
                    } else {
                        &response
                    };
                    serde_json::from_str::<serde_json::Value>(body.trim()).ok()
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    };

    // Docker Inspection
    let mut docker_list = Vec::new();
    let mut docker_summary = DockerSummary { total: 0, running: 0, healthy: 0, unhealthy: 0, stopped: 0 };
    let docker_stdout = if cfg!(target_os = "windows") {
        run_cmd("docker ps -a --format \"{{json .}}\"")
    } else {
        Command::new("docker")
            .args(["ps", "-a", "--format", "{{json .}}"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };

    if let Some(stdout) = docker_stdout {
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
                    size: c["Size"].as_str().unwrap_or("N/A").to_string(),
                    created: c["RunningFor"].as_str().or_else(|| c["CreatedAt"].as_str()).unwrap_or("").to_string(),
                    network: c["Networks"].as_str().unwrap_or("bridge").to_string(),
                });
            }
        }
    }

    // Docker Images Catalog
    let mut docker_images = Vec::new();
    let images_stdout = if cfg!(target_os = "windows") {
        run_cmd("docker images --format \"{{json .}}\"")
    } else {
        Command::new("docker")
            .args(["images", "--format", "{{json .}}"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };

    if let Some(stdout) = images_stdout {
        for line in stdout.lines() {
            if let Ok(img) = serde_json::from_str::<serde_json::Value>(line) {
                let repo = img["Repository"].as_str().unwrap_or("").to_string();
                let tag = img["Tag"].as_str().unwrap_or("").to_string();
                if !repo.is_empty() && repo != "<none>" {
                    docker_images.push(DockerImageItem {
                        repository: repo,
                        tag,
                        id: img["ID"].as_str().unwrap_or("").to_string(),
                        size: img["Size"].as_str().unwrap_or("").to_string(),
                        created: img["CreatedSince"].as_str().or_else(|| img["CreatedAt"].as_str()).unwrap_or("").to_string(),
                        containers: img["Containers"].as_str().unwrap_or("0").to_string(),
                    });
                }
            }
        }
    }

    // Service probes — probe all known ports via TCP
    // Only "core" services raise health_issues when unreachable
    struct ProbeTarget {
        name: &'static str,
        port: u16,
        is_core: bool,       // triggers health alert if offline
        is_on_demand: bool,  // game engines / optional services
    }
    let probes = [
        ProbeTarget { name: "Nginx Web (HTTP)",          port: 80,   is_core: true,  is_on_demand: false },
        ProbeTarget { name: "Personal Site (Rust)",      port: 3002, is_core: true,  is_on_demand: false },
        ProbeTarget { name: "MacOS Server (Blue)",       port: 3001, is_core: false, is_on_demand: false },
        ProbeTarget { name: "Stalwart Mail Admin/API",   port: 8080, is_core: false, is_on_demand: false },
        // Stalwart TLS mail ports — may be inactive by config; not core alerts
        ProbeTarget { name: "Stalwart SMTPS (465)",      port: 465,  is_core: false, is_on_demand: false },
        ProbeTarget { name: "Stalwart Submission (587)", port: 587,  is_core: false, is_on_demand: false },
        ProbeTarget { name: "Stalwart IMAPS (993)",      port: 993,  is_core: false, is_on_demand: false },
        // On-demand game engines
        ProbeTarget { name: "CS Panel Web",              port: 3005, is_core: false, is_on_demand: true  },
        ProbeTarget { name: "Minecraft Manager",         port: 5000, is_core: false, is_on_demand: true  },
        // App backend remains startable during the gradual Rust migration
        ProbeTarget { name: "Nexus Backend",             port: 3010, is_core: false, is_on_demand: true  },
    ];

    let mut services = Vec::new();
    for p in &probes {
        let is_open = check_tcp_port(p.port).await;
        if !is_open && p.is_core {
            health_issues.push(format!("CRITICAL: Core service '{}' on port {} is unreachable!", p.name, p.port));
        }
        services.push(ServiceProbe {
            name: p.name.into(),
            port: p.port,
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

    if docker_summary.unhealthy > 0 {
        overall_status = "CRITICAL".into();
        health_issues.push(format!("Docker reports {} unhealthy container(s)", docker_summary.unhealthy));
    }

    if let Some(ref slave) = slave_data {
        if slave.get("status").and_then(|s| s.as_str()) != Some("online") {
            health_issues.push("Cluster Standby Node (container-of-souls) is unreachable or degraded!".into());
            if overall_status == "HEALTHY" {
                overall_status = "WARNING".into();
            }
        }
    } else {
        health_issues.push("Cluster Standby Node probe unreachable via 127.0.0.1:9100 tunnel!".into());
        if overall_status == "HEALTHY" {
            overall_status = "WARNING".into();
        }
    }

    if !health_issues.is_empty() && overall_status == "HEALTHY" {
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
        slave: slave_data,
        docker: docker_list,
        docker_images,
        docker_summary,
        services,
        errors24h: Errors24h {
            systemd: systemd_errors,
            nginx: nginx_errors,
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
    let (status_bg, status_text_color, status_border, status_text) = match data.overall_status.as_str() {
        "CRITICAL" => ("rgba(255, 51, 102, 0.15)", "#ff3366", "rgba(255, 51, 102, 0.4)", "CRITICAL ATTENTION REQUIRED"),
        "WARNING" => ("rgba(251, 191, 36, 0.15)", "#fbbf24", "rgba(251, 191, 36, 0.4)", "SYSTEM WARNINGS DETECTED"),
        _ => ("rgba(137, 255, 0, 0.12)", "#89ff00", "rgba(137, 255, 0, 0.35)", "ALL SYSTEMS OPERATIONAL"),
    };

    let issues_html = if data.health_issues.is_empty() {
        r#"<div style="background: rgba(137, 255, 0, 0.06); border: 1px solid rgba(137, 255, 0, 0.2); border-radius: 12px; padding: 14px 18px; color: #89ff00; font-size: 13px; font-family: monospace;">
            ✓ Zero critical health anomalies detected across cluster nodes in the past 24 hours.
        </div>"#.to_string()
    } else {
        let items = data.health_issues
            .iter()
            .map(|i| format!(r#"<li style="color: #ff3366; margin-bottom: 6px; font-family: monospace; font-size: 13px;">⚠ {}</li>"#, i))
            .collect::<Vec<_>>()
            .join("");
        format!(r#"<div style="background: rgba(255, 51, 102, 0.08); border-left: 3px solid #ff3366; border-radius: 12px; padding: 16px 20px;"><ul style="margin: 0; padding-left: 20px;">{}</ul></div>"#, items)
    };

    let cpu_pct = data.cpu.load_percent.min(100);
    let mem_pct = data.memory.used_percent.min(100);
    let disk_pct = data.disk.used_percent.min(100);

    let cpu_bar_color = if cpu_pct > 85 { "#ff3366" } else { "#89ff00" };
    let mem_bar_color = if mem_pct > 85 { "#ff3366" } else { "#89ff00" };
    let disk_bar_color = if disk_pct > 85 { "#ff3366" } else { "#89ff00" };

    // Slave Node Telemetry
    let slave_section = if let Some(ref slave) = data.slave {
        let is_online = slave.get("status").and_then(|s| s.as_str()) == Some("online");
        let badge_bg = if is_online { "rgba(137, 255, 0, 0.12)" } else { "rgba(255, 51, 102, 0.15)" };
        let badge_color = if is_online { "#89ff00" } else { "#ff3366" };
        let badge_border = if is_online { "rgba(137, 255, 0, 0.35)" } else { "rgba(255, 51, 102, 0.4)" };
        let badge_text = if is_online { "ONLINE // RESPONSIVE" } else { "OFFLINE // UNREACHABLE" };

        let slave_os = slave.get("os").and_then(|s| s.as_str()).unwrap_or("Ubuntu 26.04 LTS");
        let slave_uptime_secs = slave.get("uptime").and_then(|u| u.as_u64()).unwrap_or(0);
        let slave_uptime = format_uptime(slave_uptime_secs);

        let slave_cpu_pct = slave.get("cpu").and_then(|c| c.get("loadPercent")).and_then(|p| p.as_f64()).unwrap_or(0.0).round() as u64;
        let slave_cores = slave.get("cpu").and_then(|c| c.get("cores")).and_then(|p| p.as_u64()).unwrap_or(2);
        let slave_l1 = slave.get("cpu").and_then(|c| c.get("loadAvg")).and_then(|a| a.get(0)).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let slave_l5 = slave.get("cpu").and_then(|c| c.get("loadAvg")).and_then(|a| a.get(1)).and_then(|v| v.as_f64()).unwrap_or(0.0);

        let slave_mem_pct = slave.get("memory").and_then(|m| m.get("usedPercent")).and_then(|p| p.as_f64()).unwrap_or(0.0).round() as u64;
        let slave_used_mem = slave.get("memory").and_then(|m| m.get("usedBytes")).and_then(|b| b.as_u64()).unwrap_or(0);
        let slave_total_mem = slave.get("memory").and_then(|m| m.get("totalBytes")).and_then(|b| b.as_u64()).unwrap_or(0);

        let slave_disk_pct = slave.get("disk").and_then(|d| d.get("usedPercent")).and_then(|p| p.as_f64()).unwrap_or(0.0).round() as u64;
        let slave_used_disk = slave.get("disk").and_then(|d| d.get("usedBytes")).and_then(|b| b.as_u64()).unwrap_or(0);
        let slave_total_disk = slave.get("disk").and_then(|d| d.get("totalBytes")).and_then(|b| b.as_u64()).unwrap_or(0);

        let s_cpu_bar = if slave_cpu_pct > 85 { "#ff3366" } else { "#89ff00" };
        let s_mem_bar = if slave_mem_pct > 85 { "#ff3366" } else { "#89ff00" };
        let s_disk_bar = if slave_disk_pct > 85 { "#ff3366" } else { "#89ff00" };

        let mut daemons_html = String::new();
        if let Some(services) = slave.get("services").and_then(|s| s.as_array()) {
            for svc in services {
                let name = svc.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let st = svc.get("status").and_then(|s| s.as_str()).unwrap_or("unknown");
                let is_act = st == "active";
                let c = if is_act { "#89ff00" } else { "#ff3366" };
                daemons_html.push_str(&format!(
                    r#"<span style="display:inline-flex; align-items:center; margin-right:8px; margin-bottom:6px; padding:4px 10px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); font-family:monospace; font-size:11px; color:#cbd5e1;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:{}; margin-right:6px;"></span>{}: <strong style="color:{}; margin-left:4px;">{}</strong></span>"#,
                    c, name, c, st.to_uppercase()
                ));
            }
        }

        format!(
            r#"<div class="card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                    <div>
                        <div style="font-family:monospace; font-size:11px; font-weight:700; color:#89ff00; letter-spacing:0.12em; text-transform:uppercase;">NODE 02 // STANDBY CLUSTER NODE</div>
                        <h3 style="color:#ffffff; font-size:17px; margin-top:2px;">container-of-souls (10.0.0.195 / 129.154.32.125)</h3>
                        <div style="font-size:11px; font-family:monospace; color:#94a3b8; margin-top:3px;">Platform: {} &bull; Uptime: {}</div>
                    </div>
                    <span class="badge" style="background:{}; color:{}; border:1px solid {};">
                        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:{}; margin-right:6px;"></span>
                        {}
                    </span>
                </div>

                <table style="width:100%; margin:0 0 14px 0; border:none;">
                    <tr>
                        <td class="metric-col" style="width:32%;">
                            <div class="metric-lbl">CPU Load</div>
                            <div class="metric-val">{}%</div>
                            <div class="metric-sub">{} Cores &bull; {:.2}, {:.2}</div>
                            <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                        </td>
                        <td style="width:2%;"></td>
                        <td class="metric-col" style="width:32%;">
                            <div class="metric-lbl">RAM Usage</div>
                            <div class="metric-val">{}%</div>
                            <div class="metric-sub">{} / {}</div>
                            <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                        </td>
                        <td style="width:2%;"></td>
                        <td class="metric-col" style="width:32%;">
                            <div class="metric-lbl">NVMe Disk</div>
                            <div class="metric-val">{}%</div>
                            <div class="metric-sub">{} / {}</div>
                            <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                        </td>
                    </tr>
                </table>

                <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;">
                    <div style="font-family:monospace; font-size:11px; color:#94a3b8; margin-bottom:8px; text-transform:uppercase;">Standby Node Services:</div>
                    <div>{}</div>
                </div>
            </div>"#,
            slave_os, slave_uptime,
            badge_bg, badge_color, badge_border, badge_color, badge_text,
            slave_cpu_pct, slave_cores, slave_l1, slave_l5, slave_cpu_pct, s_cpu_bar,
            slave_mem_pct, format_bytes(slave_used_mem), format_bytes(slave_total_mem), slave_mem_pct, s_mem_bar,
            slave_disk_pct, format_bytes(slave_used_disk), format_bytes(slave_total_disk), slave_disk_pct, s_disk_bar,
            daemons_html
        )
    } else {
        r#"<div class="card" style="border-color: rgba(255, 51, 102, 0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-family:monospace; font-size:11px; font-weight:700; color:#ff3366; letter-spacing:0.12em; text-transform:uppercase;">NODE 02 // STANDBY CLUSTER NODE</div>
                    <h3 style="color:#ffffff; font-size:17px; margin-top:2px;">container-of-souls (10.0.0.195)</h3>
                    <div style="font-size:11px; font-family:monospace; color:#94a3b8; margin-top:3px;">Standby node probe offline or unreachable across private VCN tunnel</div>
                </div>
                <span class="badge" style="background:rgba(255,51,102,0.15); color:#ff3366; border:1px solid rgba(255,51,102,0.4);">
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ff3366; margin-right:6px;"></span>
                    OFFLINE
                </span>
            </div>
        </div>"#.to_string()
    };

    // Docker Containers Detailed Rows
    let docker_rows = data.docker.iter().map(|c| {
        let is_healthy = c.health == "healthy" || (c.state == "running" && c.health == "none");
        let color = if is_healthy { "#89ff00" } else { "#ff3366" };
        let health_label = if c.health == "healthy" {
            "RUNNING // HEALTHY"
        } else if c.state == "running" {
            "RUNNING"
        } else {
            "STOPPED"
        };
        let net_info = if !c.ports.is_empty() {
            c.ports.clone()
        } else {
            format!("net: {}", c.network)
        };

        format!(
            r#"<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 700; color: #ffffff; font-family: monospace; font-size: 13px;">{}</div>
                    <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 3px;">ID: {} &bull; {}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="color: #cbd5e1; font-family: monospace; font-size: 12px; font-weight: 600;">{}</div>
                    <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin-top: 3px;">Footprint: {}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <span style="display:inline-flex; align-items:center; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; font-family: monospace; background: rgba(255,255,255,0.03); color: {}; border: 1px solid rgba(255,255,255,0.08);">
                        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:{}; margin-right:6px;"></span>
                        {}
                    </span>
                    <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 3px;">{}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; color: #94a3b8; font-family: monospace; font-size: 11px;">
                    <div>{}</div>
                </td>
            </tr>"#,
            c.name, c.id, c.created,
            c.image, c.size,
            color, color, health_label, c.status,
            net_info
        )
    }).collect::<Vec<_>>().join("");

    // Docker Images Catalog Rows
    let docker_images_rows = data.docker_images.iter().map(|img| {
        format!(
            r#"<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                <td style="padding: 8px 10px; font-family: monospace; font-size: 12px; color: #ffffff; font-weight: 600;">
                    {}:<span style="color:#89ff00;">{}</span>
                </td>
                <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; color: #94a3b8;">{}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; color: #cbd5e1; font-weight: 700;">{}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; color: #64748b;">{}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; color: #94a3b8; text-align: center;">{}</td>
            </tr>"#,
            img.repository, img.tag, img.id, img.size, img.created, img.containers
        )
    }).collect::<Vec<_>>().join("");

    // Services Probes Matrix - Guaranteed Green for ONLINE & email-safe table grid
    let mut services_cells = Vec::new();
    for s in &data.services {
        let is_up = s.status.eq_ignore_ascii_case("online") || s.status.eq_ignore_ascii_case("running") || s.status.eq_ignore_ascii_case("active");
        let is_standby = s.name.contains("CS Panel") || s.name.contains("Minecraft") || s.name.contains("Nexus");

        let (dot_c, text_c, bg_c, border_c, label) = if is_up {
            ("#89ff00", "#89ff00", "rgba(137, 255, 0, 0.12)", "rgba(137, 255, 0, 0.35)", "ONLINE")
        } else if is_standby {
            ("#64748b", "#94a3b8", "rgba(255, 255, 255, 0.04)", "rgba(255, 255, 255, 0.08)", "STANDBY")
        } else {
            ("#ff3366", "#ff3366", "rgba(255, 51, 102, 0.15)", "rgba(255, 51, 102, 0.4)", "OFFLINE")
        };

        services_cells.push(format!(
            r#"<td style="width:50%; padding:4px; vertical-align:middle;">
                <table style="width:100%; margin:0; border:1px solid rgba(255,255,255,0.06); background:#070709; border-radius:8px; padding:8px 10px;">
                    <tr>
                        <td style="font-family:monospace; font-size:11px; color:#f8fafc; vertical-align:middle; white-space:nowrap;">
                            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:{}; margin-right:6px; vertical-align:middle;"></span>
                            {} <span style="color:#64748b;">:{}</span>
                        </td>
                        <td style="text-align:right; vertical-align:middle;">
                            <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:10px; font-weight:800; color:{}; background:{}; border:1px solid {};">
                                {}
                            </span>
                        </td>
                    </tr>
                </table>
            </td>"#,
            dot_c, s.name, s.port, text_c, bg_c, border_c, label
        ));
    }

    let mut service_grid = String::new();
    service_grid.push_str("<table style=\"width:100%; border:none; margin:0; border-collapse:collapse;\">");
    for chunk in services_cells.chunks(2) {
        service_grid.push_str("<tr>");
        for cell in chunk {
            service_grid.push_str(cell);
        }
        if chunk.len() == 1 {
            service_grid.push_str("<td style=\"width:50%; padding:4px;\"></td>");
        }
        service_grid.push_str("</tr>");
    }
    service_grid.push_str("</table>");

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Atelier Cluster 24h Supervision Report</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #f8fafc; margin: 0; padding: 30px 15px; -webkit-font-smoothing: antialiased; }}
.container {{ max-width: 680px; margin: 0 auto; }}
.card {{ background: #0c0d10; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 24px; margin-bottom: 20px; }}
.header-card {{ background: #0c0d10; border: 1px solid rgba(137, 255, 0, 0.25); border-radius: 16px; padding: 28px 24px; margin-bottom: 20px; }}
.badge {{ display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; font-family: monospace; letter-spacing: 0.1em; text-transform: uppercase; }}
.metric-col {{ background: #070709; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px; vertical-align: top; }}
.metric-val {{ font-size: 26px; font-weight: 800; font-family: monospace; color: #ffffff; margin: 4px 0; }}
.metric-lbl {{ font-size: 11px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.08em; }}
.metric-sub {{ font-size: 11px; font-family: monospace; color: #64748b; }}
.progress-bg {{ width: 100%; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; margin-top: 10px; overflow: hidden; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
th {{ text-align: left; padding: 8px 12px; color: #94a3b8; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }}
h2, h3 {{ margin: 0; font-weight: 700; letter-spacing: -0.02em; }}
</style>
</head>
<body>
<div class="container">
    <!-- Brand & Executive Header with FZ Monogram -->
    <div class="header-card">
        <table style="width:100%; border:none; margin:0; padding:0;">
            <tr>
                <td style="width:62px; vertical-align:middle; padding-right:16px;">
                    <div style="background:#050507; border:1px solid rgba(137,255,0,0.35); border-radius:12px; padding:10px 12px; text-align:center; box-shadow:0 0 20px rgba(137,255,0,0.12);">
                        <svg viewBox="0 0 171.63 91" width="52" height="27" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:0 auto;">
                            <path d="M43.82,70.3l64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43,27.69.85-25.84,61.15c-2.63,6.23-11.43,8.64-18.18,8.65l-111.12.13,41.64-20.2Z" fill="#ff3366" />
                            <path d="M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6-28.38-.02L41.22,9.13C43.67,3.32,52.08.55,58.48.55l110.96-.05-39.82,19.21Z" fill="#89ff00" />
                            <polygon points="44.55 69.8 51.04 53.07 93.98 33.19 59.67 32.61 64.74 20.95 128.88 20.22 121.68 37.77 78.77 57.7 113 58.08 108.01 69.85 44.55 69.8" fill="#111113" />
                            <path d="M128.13,20.73l-6.84,16.67-40.73,18.92-4,1.86,4.41.05,31.28.34-4.57,10.78-62.4-.05,6.16-15.86,40.77-18.88,3.96-1.83-4.36-.07-31.37-.53,4.64-10.68,63.06-.71M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6,64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43h0Z" fill="#ffffff" />
                        </svg>
                    </div>
                </td>
                <td style="vertical-align:middle;">
                    <div style="font-family:monospace; font-size:11px; font-weight:700; color:#89ff00; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:4px;">
                        MOHAMMAD FAIZAL // ATELIER CLUSTER
                    </div>
                    <h2 style="color:#ffffff; font-size:20px; font-weight:700; margin:0 0 4px 0; letter-spacing:-0.02em;">
                        24h System Health &amp; Supervision Report
                    </h2>
                    <div style="font-size:11px; font-family:monospace; color:#94a3b8; line-height:1.4;">
                        Master: {} (10.0.0.86) &bull; Platform: {} &bull; Uptime: {}
                    </div>
                </td>
            </tr>
        </table>
        <div style="margin-top:16px;">
            <span class="badge" style="background:{}; color:{}; border:1px solid {};">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:{}; margin-right:8px;"></span>
                {}
            </span>
        </div>
    </div>

    <!-- Cluster Diagnostics & Status Alerts -->
    <div class="card">
        <h3 style="color: #ffffff; font-size: 16px; margin-bottom: 4px;">Anomalies & Health Audit</h3>
        <p style="font-size: 12px; font-family: monospace; color: #94a3b8; margin: 0 0 14px 0;">Automated 24h Cluster Node Inspection</p>
        {}
    </div>

    <!-- Node 01: Master Core -->
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
            <div>
                <div style="font-family:monospace; font-size:11px; font-weight:700; color:#89ff00; letter-spacing:0.12em; text-transform:uppercase;">NODE 01 // MASTER INGRESS & CORE</div>
                <h3 style="color:#ffffff; font-size:17px; margin-top:2px;">{} (10.0.0.86 / 68.233.115.138)</h3>
                <div style="font-size:11px; font-family:monospace; color:#94a3b8; margin-top:3px;">Platform: {} &bull; Uptime: {}</div>
            </div>
            <span class="badge" style="background:rgba(137,255,0,0.12); color:#89ff00; border:1px solid rgba(137,255,0,0.35);">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#89ff00; margin-right:6px;"></span>
                ONLINE // MASTER
            </span>
        </div>
        
        <table style="width:100%; margin:0; border:none;">
            <tr>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">CPU Load</div>
                    <div class="metric-val">{}%</div>
                    <div class="metric-sub">{} vCPUs Active</div>
                    <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                </td>
                <td style="width:2%;"></td>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">RAM Usage</div>
                    <div class="metric-val">{}%</div>
                    <div class="metric-sub">{} / {}</div>
                    <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                </td>
                <td style="width:2%;"></td>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">NVMe Disk (/)</div>
                    <div class="metric-val">{}%</div>
                    <div class="metric-sub">{} / {}</div>
                    <div class="progress-bg"><div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div></div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Node 02: Standby Node (container-of-souls) -->
    {}

    <!-- Docker Orchestration & Image Registry -->
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div>
                <h3 style="color: #ffffff; font-size: 16px;">Docker Orchestration &amp; Virtual Units ({})</h3>
                <div style="font-size: 11px; font-family: monospace; color: #94a3b8; margin-top: 2px;">Primary container runtime environment</div>
            </div>
            <span class="badge" style="background:rgba(137,255,0,0.1); color:#89ff00; border:1px solid rgba(137,255,0,0.3);">
                DOCKER ENGINE
            </span>
        </div>
        <table>
            <thead><tr><th>Container Unit</th><th>Image &amp; Footprint</th><th>Health &amp; Status</th><th>Network &amp; Ports</th></tr></thead>
            <tbody>{}</tbody>
        </table>

        <!-- Docker Image Catalog -->
        <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                <div style="font-family:monospace; font-size:11px; font-weight:700; color:#89ff00; text-transform:uppercase; letter-spacing:0.08em;">
                    Docker Image Catalog ({})
                </div>
                <div style="font-family:monospace; font-size:10px; color:#64748b;">HOST IMAGE CACHE</div>
            </div>
            <table>
                <thead><tr><th>Repository &amp; Tag</th><th>Image ID</th><th>Virtual Size</th><th>Created</th><th style="text-align:center;">Containers</th></tr></thead>
                <tbody>{}</tbody>
            </table>
        </div>
    </div>

    <!-- Active Network Services Matrix -->
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
                <h3 style="color: #ffffff; font-size: 16px;">Network Services &amp; Port Probes</h3>
                <div style="font-size: 11px; font-family: monospace; color: #94a3b8; margin-top: 2px;">Real-time TCP socket listeners on host</div>
            </div>
            <span style="font-family:monospace; font-size:11px; color:#89ff00; font-weight:700;">TCP SOCKETS</span>
        </div>
        <div>{}</div>
    </div>

    <!-- 24h Traffic & Inquiries Summary -->
    <div class="card">
        <h3 style="color: #ffffff; font-size: 16px; margin-bottom: 4px;">24h Traffic & Client Telemetry</h3>
        <p style="font-size: 12px; font-family: monospace; color: #94a3b8; margin: 0 0 14px 0;">Audience engagement and inbound leads</p>
        <table style="width:100%; margin:0; border:none;">
            <tr>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">Page Views</div>
                    <div class="metric-val" style="color:#89ff00;">{}</div>
                    <div class="metric-sub">Recorded visits</div>
                </td>
                <td style="width:2%;"></td>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">Unique Visitors</div>
                    <div class="metric-val">{}</div>
                    <div class="metric-sub">Distinct client IPs</div>
                </td>
                <td style="width:2%;"></td>
                <td class="metric-col" style="width:32%;">
                    <div class="metric-lbl">Client Messages</div>
                    <div class="metric-val" style="color:#89ff00;">{}</div>
                    <div class="metric-sub">Inbound contact queries</div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-family: monospace; font-size: 11px; margin-top: 30px; letter-spacing: 0.05em;">
        MOHAMMAD FAIZAL &bull; ATELIER CLUSTER TELEMETRY &bull; PURE RUST AXUM
    </div>
</div>
</body>
</html>"##,
        data.hostname, data.platform, data.uptime_formatted,
        status_bg, status_text_color, status_border, status_text_color, status_text,
        issues_html,
        data.hostname, data.platform, data.uptime_formatted,
        cpu_pct, data.cpu.cores, cpu_pct, cpu_bar_color,
        mem_pct, format_bytes(data.memory.used_bytes), format_bytes(data.memory.total_bytes), mem_pct, mem_bar_color,
        disk_pct, format_bytes(data.disk.used_bytes), format_bytes(data.disk.total_bytes), disk_pct, disk_bar_color,
        slave_section,
        data.docker.len(), docker_rows,
        data.docker_images.len(), docker_images_rows,
        service_grid,
        data.analytics24h.views, data.analytics24h.unique_visitors, data.analytics24h.messages_received
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

