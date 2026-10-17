use crate::config::AppConfig;
use crate::db::DbPool;
use crate::mailer::send_report_email;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use tokio::time::sleep;
use tracing::{info, warn};

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
    pub category: String,
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
    #[serde(default)]
    pub node_role: String,
    #[serde(default)]
    pub is_standby: bool,
    #[serde(default)]
    pub node_ip: String,
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
    let hostname = System::host_name().unwrap_or_else(|| "macos".into());
    let os_name = System::name().unwrap_or_else(|| "Ubuntu".into());
    let os_version = System::os_version().unwrap_or_else(|| "24.04 LTS".into());
    let arch = std::env::consts::ARCH.to_string();

    let env_node_role = std::env::var("NODE_ROLE").unwrap_or_else(|_| "primary".into());
    let env_node_name = std::env::var("NODE_NAME").unwrap_or_default();
    let is_current_standby = hostname.contains("container-of-souls")
        || env_node_role.eq_ignore_ascii_case("standby")
        || env_node_name.contains("container-of-souls");

    let node_role = if is_current_standby { "standby".to_string() } else { "primary".to_string() };
    let node_ip = if is_current_standby { "10.0.0.195".to_string() } else { "10.0.0.86".to_string() };

    let cpu_count = sys.cpus().len().max(1);
    let cpu_model = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Generic Cloud vCPU".into());
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

    // Query Cluster Standby Node (container-of-souls via 127.0.0.1:9100 tunnel)
    // Only query if this instance is the PRIMARY node.
    let slave_data: Option<serde_json::Value> = if !is_current_standby {
        let connect_res = tokio::time::timeout(
            std::time::Duration::from_millis(2500),
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
    } else {
        None
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

    // Service probes with logical categorization
    struct ProbeTarget {
        name: &'static str,
        port: u16,
        is_core: bool,
        category: &'static str,
    }
    let probes = [
        ProbeTarget { name: "Nginx Web (HTTP)",          port: 80,   is_core: true,  category: "Core Web" },
        ProbeTarget { name: "Personal Site (Rust)",      port: 3002, is_core: true,  category: "Core Web" },
        ProbeTarget { name: "MacOS Server (Blue)",       port: 3001, is_core: false, category: "Core Web" },
        ProbeTarget { name: "Stalwart Mail Admin/API",   port: 8080, is_core: false, category: "Mail" },
        ProbeTarget { name: "Stalwart SMTPS (465)",      port: 465,  is_core: false, category: "Mail" },
        ProbeTarget { name: "Stalwart Submission (587)", port: 587,  is_core: false, category: "Mail" },
        ProbeTarget { name: "Stalwart IMAPS (993)",      port: 993,  is_core: false, category: "Mail" },
        ProbeTarget { name: "CS Panel Web",              port: 3005, is_core: false, category: "On-Demand" },
        ProbeTarget { name: "Minecraft Manager",         port: 5000, is_core: false, category: "On-Demand" },
        ProbeTarget { name: "Nexus Backend",             port: 3010, is_core: false, category: "On-Demand" },
    ];

    let mut services = Vec::new();
    for p in &probes {
        let is_open = check_tcp_port(p.port).await;
        if !is_open && p.is_core && !is_current_standby {
            health_issues.push(format!("CRITICAL: Core service '{}' on port {} is unreachable!", p.name, p.port));
        }
        services.push(ServiceProbe {
            name: p.name.into(),
            port: p.port,
            status: if is_open { "ONLINE".into() } else if p.category == "On-Demand" { "STANDBY".into() } else { "OFFLINE".into() },
            badge_class: if is_open { "status-online".into() } else { "status-fail".into() },
            category: p.category.into(),
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

    // 24h Analytics & Contact Telemetry
    let (views, unique_v, msgs, admin_ok, admin_fail, ban_cnt) = {
        let conn = db.lock().await;
        let views: i64 = conn.query_row(
            "SELECT COUNT(*) FROM visitors WHERE timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let unique_v: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT ip) FROM visitors WHERE timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let msgs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let admin_ok: i64 = conn.query_row(
            "SELECT COUNT(*) FROM access_logs WHERE status = 'SUCCESS' AND timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let admin_fail: i64 = conn.query_row(
            "SELECT COUNT(*) FROM access_logs WHERE status = 'FAILED' AND timestamp >= datetime('now', '-24 hours')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let ban_cnt: i64 = conn.query_row("SELECT COUNT(*) FROM banned_ips", [], |r| r.get(0)).unwrap_or(0);

        (views, unique_v, msgs, admin_ok, admin_fail, ban_cnt)
    };

    // Calculate Overall Status
    let mut overall_status = "HEALTHY".to_string();

    if disk_used_pct >= 90 {
        overall_status = "CRITICAL".into();
        health_issues.push(format!("Primary Disk critical: {}% used", disk_used_pct));
    } else if disk_used_pct >= 82 {
        overall_status = "WARNING".into();
        health_issues.push(format!("Primary Disk warning: {}% used", disk_used_pct));
    }

    if mem_used_pct >= 92 {
        if overall_status != "CRITICAL" {
            overall_status = "WARNING".into();
        }
        health_issues.push(format!("Primary RAM usage elevated: {}%", mem_used_pct));
    }

    if docker_summary.unhealthy > 0 {
        overall_status = "CRITICAL".into();
        health_issues.push(format!("Docker reports {} unhealthy container(s)", docker_summary.unhealthy));
    }

    // Check Standby Node status ONLY if this is the Master Node
    if !is_current_standby {
        if let Some(ref slave) = slave_data {
            if slave.get("status").and_then(|s| s.as_str()) != Some("online") {
                health_issues.push("Cluster Standby Node (container-of-souls) is unreachable or degraded.".into());
                if overall_status == "HEALTHY" {
                    overall_status = "WARNING".into();
                }
            }
        } else {
            health_issues.push("Cluster Standby Node probe unreachable via 127.0.0.1:9100 tunnel (SSH tunnel to 10.0.0.195).".into());
            if overall_status == "HEALTHY" {
                overall_status = "WARNING".into();
            }
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
        node_role,
        is_standby: is_current_standby,
        node_ip,
    }
}

pub fn generate_report_html(data: &SystemHealthData) -> String {
    let is_critical = data.overall_status == "CRITICAL";
    let is_warning = data.overall_status == "WARNING";
    let is_healthy = data.overall_status == "HEALTHY";

    // Dynamic Light Theme Hero Status Banner
    let hero_status_banner = if is_healthy {
        r#"<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ecfdf5; border:1px solid #a7f3d0; border-left:4px solid #10b981; border-radius:12px; padding:16px 20px;">
          <tr>
            <td valign="middle">
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:800; color:#047857; letter-spacing:0.08em; text-transform:uppercase;">
                ● ALL SYSTEMS OPERATIONAL
              </div>
              <div style="font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#065f46; margin-top:3px; font-weight:500;">
                ✓ Zero critical health anomalies detected across cluster nodes in the past 24 hours.
              </div>
            </td>
          </tr>
        </table>"#
    } else {
        let (border_c, title_c, badge_text, bg_c) = if is_critical {
            ("#f87171", "#b91c1c", "CRITICAL ANOMALIES DETECTED", "#fef2f2")
        } else {
            ("#fcd34d", "#b45309", "SYSTEM WARNINGS DETECTED", "#fffbeb")
        };

        let mut issues_items = String::new();
        for issue in &data.health_issues {
            issues_items.push_str(&format!(
                r#"<li style="color:#b91c1c; margin-bottom:5px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:600;">⚠ {}</li>"#,
                issue
            ));
        }

        &format!(
            r#"<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:{}; border:1px solid {}; border-left:4px solid {}; border-radius:12px; padding:16px 20px;">
              <tr>
                <td valign="middle">
                  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:800; color:{}; letter-spacing:0.08em; text-transform:uppercase;">
                    ▲ {}
                  </div>
                  <div style="font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#475569; margin-top:3px; margin-bottom:8px;">
                    Automated cluster supervision flagged the following issues:
                  </div>
                  <ul style="margin:0; padding-left:18px;">
                    {}
                  </ul>
                </td>
              </tr>
            </table>"#,
            bg_c, border_c, border_c, title_c, badge_text, issues_items
        )
    };

    // Node 01 Gauges (Light Theme)
    let n1_cpu_pct = data.cpu.load_percent.min(100);
    let n1_mem_pct = data.memory.used_percent.min(100);
    let n1_disk_pct = data.disk.used_percent.min(100);

    let n1_cpu_bar = if n1_cpu_pct > 85 { "#ef4444" } else if n1_cpu_pct > 70 { "#f59e0b" } else { "#10b981" };
    let n1_mem_bar = if n1_mem_pct > 85 { "#ef4444" } else if n1_mem_pct > 70 { "#f59e0b" } else { "#10b981" };
    let n1_disk_bar = if n1_disk_pct > 85 { "#ef4444" } else if n1_disk_pct > 70 { "#f59e0b" } else { "#10b981" };

    // Node 02 Card (Standby Node - Light Theme)
    let node_02_card = if let Some(ref slave) = data.slave {
        let is_online = slave.get("status").and_then(|s| s.as_str()) == Some("online");
        let badge_bg = if is_online { "#ecfdf5" } else { "#fef2f2" };
        let badge_color = if is_online { "#047857" } else { "#b91c1c" };
        let badge_border = if is_online { "#a7f3d0" } else { "#fecaca" };
        let badge_text = if is_online { "ONLINE // RESPONSIVE" } else { "OFFLINE // UNREACHABLE" };

        let slave_os = slave.get("os").and_then(|s| s.as_str()).unwrap_or("Ubuntu 24.04 LTS");
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

        let s_cpu_bar = if slave_cpu_pct > 85 { "#ef4444" } else if slave_cpu_pct > 70 { "#f59e0b" } else { "#10b981" };
        let s_mem_bar = if slave_mem_pct > 85 { "#ef4444" } else if slave_mem_pct > 70 { "#f59e0b" } else { "#10b981" };
        let s_disk_bar = if slave_disk_pct > 85 { "#ef4444" } else if slave_disk_pct > 70 { "#f59e0b" } else { "#10b981" };

        let mut daemons_html = String::new();
        if let Some(services) = slave.get("services").and_then(|s| s.as_array()) {
            for svc in services {
                let name = svc.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let st = svc.get("status").and_then(|s| s.as_str()).unwrap_or("unknown");
                let is_act = st == "active";
                let (dot_c, text_c, bg_c) = if is_act { ("#10b981", "#047857", "#ecfdf5") } else { ("#ef4444", "#b91c1c", "#fef2f2") };
                daemons_html.push_str(&format!(
                    r#"<span style="display:inline-flex; align-items:center; margin-right:8px; margin-bottom:6px; padding:4px 9px; border-radius:6px; background:{}; border:1px solid rgba(0,0,0,0.06); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#334155;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:{}; margin-right:6px;"></span>{}: <strong style="color:{}; margin-left:4px;">{}</strong></span>"#,
                    bg_c, dot_c, name, text_c, st.to_uppercase()
                ));
            }
        }

        format!(
            r#"<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
                    <tr>
                      <td valign="top">
                        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; color:#0284c7; letter-spacing:0.12em; text-transform:uppercase;">
                          NODE 02 // STANDBY COMPUTE &amp; WORKERS
                        </div>
                        <div style="color:#0f172a; font-size:16px; font-weight:700; margin-top:2px;">
                          container-of-souls <span style="font-size:12px; color:#64748b; font-weight:500;">(10.0.0.195 / 129.154.32.125)</span>
                        </div>
                        <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                          Platform: {} &bull; Uptime: {} &bull; <span style="color:#059669; font-weight:600;">Tunnel 127.0.0.1:9100 Connected</span>
                        </div>
                      </td>
                      <td align="right" valign="top">
                        <span style="display:inline-block; padding:4px 9px; border-radius:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; background:{}; color:{}; border:1px solid {}; text-transform:uppercase;">
                          ● {}
                        </span>
                      </td>
                    </tr>
                  </table>

                  <table class="metric-row" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">CPU LOAD</div>
                        <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} Cores &bull; {:.2}, {:.2}</div>
                        <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                          <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                        </div>
                      </td>
                      <td class="hide-mobile" width="2%"></td>
                      <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">RAM USAGE</div>
                        <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} / {}</div>
                        <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                          <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                        </div>
                      </td>
                      <td class="hide-mobile" width="2%"></td>
                      <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">NVME DISK</div>
                        <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} / {}</div>
                        <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                          <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="border-top:1px solid #f1f5f9; margin-top:12px; padding-top:10px;">
                    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#64748b; margin-bottom:6px; text-transform:uppercase; font-weight:700;">Standby Daemons:</div>
                    <div>{}</div>
                  </div>
                </td>
              </tr>
            </table>"#,
            slave_os, slave_uptime,
            badge_bg, badge_color, badge_border, badge_text,
            slave_cpu_pct, slave_cores, slave_l1, slave_l5, slave_cpu_pct, s_cpu_bar,
            slave_mem_pct, format_bytes(slave_used_mem), format_bytes(slave_total_mem), slave_mem_pct, s_mem_bar,
            slave_disk_pct, format_bytes(slave_used_disk), format_bytes(slave_total_disk), slave_disk_pct, s_disk_bar,
            daemons_html
        )
    } else {
        r#"<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#fff1f2; border:1px solid #fecdd3; border-radius:16px; padding:20px;">
          <tr>
            <td valign="middle">
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; color:#e11d48; letter-spacing:0.12em; text-transform:uppercase;">
                NODE 02 // STANDBY COMPUTE &amp; WORKERS
              </div>
              <div style="color:#0f172a; font-size:16px; font-weight:700; margin-top:2px;">
                container-of-souls <span style="font-size:12px; color:#64748b; font-weight:500;">(10.0.0.195)</span>
              </div>
              <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#b91c1c; margin-top:3px;">
                Standby node probe unreachable across private VCN tunnel (127.0.0.1:9100). Workloads remain operational on Node 01.
              </div>
            </td>
            <td align="right" valign="middle">
              <span style="display:inline-block; padding:4px 9px; border-radius:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; background:#ffe4e6; color:#b91c1c; border:1px solid #fecdd3; text-transform:uppercase;">
                ▲ OFFLINE
              </span>
            </td>
          </tr>
        </table>"#.to_string()
    };

    // Docker Containers (Light Theme Cards)
    let mut docker_containers_html = String::new();
    if data.docker.is_empty() {
        docker_containers_html.push_str(r#"<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#64748b;">No active container workloads detected on this node host.</div>"#);
    } else {
        for c in &data.docker {
            let is_healthy = c.health == "healthy" || (c.state == "running" && c.health == "none");
            let (badge_bg, badge_c, badge_border, status_label) = if is_healthy {
                ("#ecfdf5", "#047857", "#a7f3d0", "RUNNING // HEALTHY")
            } else if c.state == "running" {
                ("#f0f9ff", "#0369a1", "#bae6fd", "RUNNING")
            } else {
                ("#f1f5f9", "#475569", "#cbd5e1", "STOPPED")
            };

            let net_info = if !c.ports.is_empty() {
                c.ports.clone()
            } else {
                format!("net: {}", c.network)
            };

            docker_containers_html.push_str(&format!(
                r#"<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:8px;">
                  <tr>
                    <td valign="top">
                      <div style="font-weight:700; color:#0f172a; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px;">
                        {}
                      </div>
                      <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                        ID: {} &bull; {}
                      </div>
                      <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#334155; margin-top:4px;">
                        Image: <span style="color:#0f172a; font-weight:600;">{}</span> &bull; Footprint: <span style="color:#0f172a; font-weight:600;">{}</span>
                      </div>
                      <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                        Ports: <span style="color:#475569;">{}</span>
                      </div>
                    </td>
                    <td align="right" valign="top">
                      <span style="display:inline-block; padding:3px 8px; border-radius:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:9px; font-weight:800; background:{}; color:{}; border:1px solid {}; white-space:nowrap;">
                        ● {}
                      </span>
                      <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:4px;">
                        {}
                      </div>
                    </td>
                  </tr>
                </table>"#,
                c.name, c.id, c.created,
                c.image, c.size,
                net_info,
                badge_bg, badge_c, badge_border, status_label,
                c.status
            ));
        }
    }

    // Collapsible Docker Image Catalog (Light Theme)
    let docker_images_collapsible = if !data.docker_images.is_empty() {
        let mut image_rows = String::new();
        for img in &data.docker_images {
            image_rows.push_str(&format!(
                r#"<tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#0f172a;">{}:<span style="color:#059669; font-weight:700;">{}</span></td>
                  <td style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#64748b;">{}</td>
                  <td style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#0f172a; font-weight:700;">{}</td>
                </tr>"#,
                img.repository, img.tag, img.id, img.size
            ));
        }

        format!(
            r#"<div style="margin-top:14px; border-top:1px solid #f1f5f9; padding-top:10px;">
              <details style="cursor:pointer;">
                <summary style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; font-weight:700; color:#0284c7; outline:none; user-select:none;">
                  ▸ Tap to Inspect Host Docker Image Cache ({})
                </summary>
                <div style="margin-top:8px; overflow-x:auto;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                    <thead>
                      <tr style="border-bottom:1px solid #e2e8f0; text-align:left;">
                        <th style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#64748b; text-transform:uppercase;">Repository &amp; Tag</th>
                        <th style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#64748b; text-transform:uppercase;">Image ID</th>
                        <th style="padding:6px 8px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#64748b; text-transform:uppercase;">Virtual Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>"#,
            data.docker_images.len(),
            image_rows
        )
    } else {
        String::new()
    };

    // Services Probes Grid (Light Theme)
    let mut services_cells = Vec::new();
    for s in &data.services {
        let is_up = s.status.eq_ignore_ascii_case("online");
        let is_standby = s.status.eq_ignore_ascii_case("standby");

        let (dot_c, text_c, bg_c, border_c, label) = if is_up {
            ("#10b981", "#047857", "#ecfdf5", "#a7f3d0", "ONLINE")
        } else if is_standby {
            ("#94a3b8", "#64748b", "#f8fafc", "#e2e8f0", "STANDBY")
        } else {
            ("#ef4444", "#b91c1c", "#fef2f2", "#fecaca", "OFFLINE")
        };

        services_cells.push(format!(
            r#"<td class="fluid-cell" width="50%" style="padding:4px;" valign="middle">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px;">
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:#0f172a; vertical-align:middle; white-space:nowrap; font-weight:600;">
                      <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:{}; margin-right:6px; vertical-align:middle;"></span>
                      {} <span style="color:#64748b; font-weight:400;">:{}</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block; padding:2px 7px; border-radius:4px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:9px; font-weight:800; color:{}; background:{}; border:1px solid {};">
                        {}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>"#,
            dot_c, s.name, s.port, text_c, bg_c, border_c, label
        ));
    }

    let mut services_grid_html = String::new();
    services_grid_html.push_str("<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">");
    for chunk in services_cells.chunks(2) {
        services_grid_html.push_str("<tr>");
        for cell in chunk {
            services_grid_html.push_str(cell);
        }
        if chunk.len() == 1 {
            services_grid_html.push_str("<td class=\"fluid-cell\" width=\"50%\" style=\"padding:4px;\"></td>");
        }
        services_grid_html.push_str("</tr>");
    }
    services_grid_html.push_str("</table>");

    // Diagnostic Logs Collapsible Section
    let diagnostic_logs_section = if data.errors24h.total_error_count > 0 {
        let mut err_lines = String::new();
        for line in &data.errors24h.systemd {
            err_lines.push_str(&format!("systemd: {}\n", line));
        }
        for line in &data.errors24h.kernel {
            err_lines.push_str(&format!("kernel: {}\n", line));
        }
        for line in &data.errors24h.nginx {
            err_lines.push_str(&format!("nginx: {}\n", line));
        }

        format!(
            r#"<tr>
              <td style="padding: 0 0 16px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                  <tr>
                    <td>
                      <details style="cursor:pointer;">
                        <summary style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:700; color:#b45309; outline:none; user-select:none;">
                          ▸ Tap to View 24h Diagnostic Audit Traces ({} incident records)
                        </summary>
                        <div style="margin-top:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; overflow-x:auto;">
                          <pre style="margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#334155; line-height:1.4; white-space:pre-wrap;">{}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>"#,
            data.errors24h.total_error_count,
            err_lines
        )
    } else {
        String::new()
    };

    let reporting_node_label = if data.is_standby {
        format!("container-of-souls (Standby Worker • {})", data.node_ip)
    } else {
        format!("macos (Primary Core • {})", data.node_ip)
    };

    let docker_summary_text = format!(
        "{} Running, {} Healthy, {} Stopped",
        data.docker_summary.running, data.docker_summary.healthy, data.docker_summary.stopped
    );

    let gen_time = Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();

    format!(
        r##"<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Atelier Cluster 24h Supervision Report</title>
<style>
  body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
  body {{ margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9 !important; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }}
  .touch-btn {{ display: inline-block !important; min-height: 44px !important; line-height: 44px !important; padding: 0 16px !important; text-align: center !important; text-decoration: none !important; font-weight: 700 !important; font-size: 11px !important; border-radius: 10px !important; box-sizing: border-box !important; }}
  @media only screen and (max-width: 620px) {{
    .email-container {{ width: 100% !important; max-width: 100% !important; }}
    .fluid-cell {{ display: block !important; width: 100% !important; box-sizing: border-box !important; padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 8px !important; }}
    .metric-row {{ display: block !important; width: 100% !important; }}
    .metric-tile {{ display: block !important; width: 100% !important; margin-bottom: 8px !important; box-sizing: border-box !important; }}
    .header-logo-td {{ display: block !important; width: 100% !important; text-align: left !important; margin-bottom: 12px !important; }}
    .header-text-td {{ display: block !important; width: 100% !important; }}
    .action-bar-btn {{ display: block !important; width: 100% !important; margin-bottom: 8px !important; text-align: center !important; padding-left: 0 !important; padding-right: 0 !important; }}
    .hide-mobile {{ display: none !important; }}
  }}
</style>
</head>
<body style="margin:0; padding:24px 8px; background-color:#f1f5f9; color:#0f172a;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9; margin:0; padding:0;">
<tr>
<td align="center" style="padding: 10px 4px;">
  
  <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:640px; width:100%; margin:0 auto;">
    
    <!-- EXECUTIVE BRAND & ORIGIN CARD (LIGHT THEME + FULL NEON MONOGRAM) -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
          <tr>
            <td class="header-logo-td" width="56" valign="middle" style="padding-right:16px;">
              <!-- Full Neon FZ Monogram in Sleek Dark Pill -->
              <div style="background:#090d16; border:1px solid rgba(137,255,0,0.5); border-radius:12px; padding:10px; text-align:center; box-shadow:0 0 20px rgba(137,255,0,0.25);">
                <svg viewBox="0 0 171.63 91" width="46" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:0 auto;">
                  <path d="M43.82,70.3l64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43,27.69.85-25.84,61.15c-2.63,6.23-11.43,8.64-18.18,8.65l-111.12.13,41.64-20.2Z" fill="#89ff00" />
                  <path d="M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6-28.38-.02L41.22,9.13C43.67,3.32,52.08.55,58.48.55l110.96-.05-39.82,19.21Z" fill="#89ff00" />
                  <polygon points="44.55 69.8 51.04 53.07 93.98 33.19 59.67 32.61 64.74 20.95 128.88 20.22 121.68 37.77 78.77 57.7 113 58.08 108.01 69.85 44.55 69.8" fill="#0f172a" />
                  <path d="M128.13,20.73l-6.84,16.67-40.73,18.92-4,1.86,4.41.05,31.28.34-4.57,10.78-62.4-.05,6.16-15.86,40.77-18.88,3.96-1.83-4.36-.07-31.37-.53,4.64-10.68,63.06-.71M129.63,19.71l-65.22.74-5.49,12.65,32.87.55-41.14,19.05-6.83,17.6,64.52.05,5.42-12.76-32.78-.36,41.09-19.08,7.56-18.43h0Z" fill="#ffffff" />
                </svg>
              </div>
            </td>
            <td class="header-text-td" valign="middle">
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:11px; font-weight:800; color:#059669; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:4px;">
                MOHAMMAD FAIZAL // ATELIER CLUSTER
              </div>
              <h1 style="color:#0f172a; font-size:20px; font-weight:800; margin:0 0 6px 0; letter-spacing:-0.02em; line-height:1.2;">
                24h System Health &amp; Supervision Report
              </h1>
              <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; color:#64748b; line-height:1.5;">
                <span style="color:#0284c7; font-weight:700;">Reporting Node:</span> {} &bull; <span style="color:#334155; font-weight:600;">{}</span> &bull; <span style="color:#64748b;">Uptime: {}</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- REAL-TOUCH QUICK-ACTION TOUCH BAR -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td class="action-bar-btn" width="32%" style="padding-right:6px;">
              <a href="https://faizal.uk/admin.html" class="touch-btn" style="display:block; background:#0f172a; color:#89ff00; border:1px solid #0f172a; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; text-align:center; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                ⚡ CLUSTER ADMIN
              </a>
            </td>
            <td class="action-bar-btn" width="32%" style="padding-right:6px; padding-left:6px;">
              <a href="https://faizal.uk" class="touch-btn" style="display:block; background:#ffffff; color:#0284c7; border:1px solid #cbd5e1; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; text-align:center; text-decoration:none; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                🌐 LIVE PORTFOLIO
              </a>
            </td>
            <td class="action-bar-btn" width="32%" style="padding-left:6px;">
              <a href="https://faizal.uk/api/system-stats" class="touch-btn" style="display:block; background:#ffffff; color:#334155; border:1px solid #cbd5e1; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; text-align:center; text-decoration:none; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                🩺 TELEMETRY API
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- STATUS HERO BANNER -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        {}
      </td>
    </tr>

    <!-- CLUSTER TOPOLOGY: NODE 01 (PRIMARY CORE & INGRESS) -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
                <tr>
                  <td valign="top">
                    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; color:#059669; letter-spacing:0.12em; text-transform:uppercase;">
                      NODE 01 // PRIMARY INGRESS &amp; CORE
                    </div>
                    <div style="color:#0f172a; font-size:16px; font-weight:700; margin-top:2px;">
                      macos <span style="font-size:12px; color:#64748b; font-weight:500;">(10.0.0.86 / 68.233.115.138)</span>
                    </div>
                    <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                      Platform: {} &bull; Uptime: {}
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block; padding:4px 9px; border-radius:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; text-transform:uppercase;">
                      ● ONLINE // MASTER
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Node 01 Gauges -->
              <table class="metric-row" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">CPU LOAD</div>
                    <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} vCPUs Active</div>
                    <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                      <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                    </div>
                  </td>
                  <td class="hide-mobile" width="2%"></td>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">RAM USAGE</div>
                    <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} / {}</div>
                    <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                      <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                    </div>
                  </td>
                  <td class="hide-mobile" width="2%"></td>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">NVME DISK (/)</div>
                    <div style="font-size:22px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a; margin:3px 0;">{}%</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">{} / {}</div>
                    <div style="height:5px; background:#e2e8f0; border-radius:2px; margin-top:8px; overflow:hidden;">
                      <div style="height:100%; width:{}%; background:{}; border-radius:2px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CLUSTER TOPOLOGY: NODE 02 (STANDBY NODE) -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        {}
      </td>
    </tr>

    <!-- WORKLOADS: DOCKER VIRTUAL UNITS -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
                <tr>
                  <td>
                    <h3 style="color:#0f172a; font-size:15px; font-weight:700; margin:0;">
                      Docker Orchestration &amp; Virtual Units ({})
                    </h3>
                    <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                      Container runtime instances &bull; {}
                    </div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block; padding:4px 9px; border-radius:6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; font-weight:800; background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0;">
                      DOCKER ENGINE
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Docker Container Cards -->
              {}

              <!-- Collapsible Image Catalog -->
              {}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- NETWORK SERVICES & TCP SOCKET PROBES -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;">
                <tr>
                  <td>
                    <h3 style="color:#0f172a; font-size:15px; font-weight:700; margin:0;">
                      Network Services &amp; Port Listeners
                    </h3>
                    <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin-top:2px;">
                      Real-time TCP socket probes across cluster ingress
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; color:#059669; font-weight:800;">
                      TCP SOCKETS
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Services Grid -->
              {}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- 24H AUDIENCE & TRAFFIC TELEMETRY -->
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <h3 style="color:#0f172a; font-size:15px; font-weight:700; margin:0 0 3px 0;">
                24h Traffic &amp; Client Telemetry
              </h3>
              <div style="font-size:11px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; margin:0 0 14px 0;">
                Inbound visitor audience &amp; contact inquiries
              </div>

              <table class="metric-row" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">PAGE VIEWS</div>
                    <div style="font-size:24px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#059669; margin:3px 0;">{}</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">Recorded visits</div>
                  </td>
                  <td class="hide-mobile" width="2%"></td>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">UNIQUE VISITORS</div>
                    <div style="font-size:24px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#0284c7; margin:3px 0;">{}</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">Distinct client IPs</div>
                  </td>
                  <td class="hide-mobile" width="2%"></td>
                  <td class="metric-tile" width="32%" valign="top" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">CLIENT MESSAGES</div>
                    <div style="font-size:24px; font-weight:800; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#7c3aed; margin:3px 0;">{}</div>
                    <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b;">Inbound inquiries</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- EXPANDABLE REAL-TOUCH DIAGNOSTIC LOGS -->
    {}

    <!-- FOOTER -->
    <tr>
      <td style="padding: 16px 8px 30px 8px; text-align: center;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.08em; text-transform:uppercase;">
          MOHAMMAD FAIZAL &bull; ATELIER CLUSTER TELEMETRY &bull; PURE RUST AXUM ENGINE
        </div>
        <div style="font-size:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:#94a3b8; margin-top:4px;">
          Generated: {} &bull; Single-Source Rust Health Daemon &bull; Automated 24h Cron
        </div>
      </td>
    </tr>

  </table>
</td>
</tr>
</table>
</body>
</html>"##,
        reporting_node_label, data.platform, data.uptime_formatted,
        hero_status_banner,
        data.platform, data.uptime_formatted,
        n1_cpu_pct, data.cpu.cores, n1_cpu_pct, n1_cpu_bar,
        n1_mem_pct, format_bytes(data.memory.used_bytes), format_bytes(data.memory.total_bytes), n1_mem_pct, n1_mem_bar,
        n1_disk_pct, format_bytes(data.disk.used_bytes), format_bytes(data.disk.total_bytes), n1_disk_pct, n1_disk_bar,
        node_02_card,
        data.docker.len(), docker_summary_text,
        docker_containers_html,
        docker_images_collapsible,
        services_grid_html,
        data.analytics24h.views, data.analytics24h.unique_visitors, data.analytics24h.messages_received,
        diagnostic_logs_section,
        gen_time
    )
}

pub async fn run_scheduled_reporter(config: AppConfig, db: DbPool) {
    // OPTION 2 FIX: Gatekeeper to ensure ONLY Master Core runs the daily report.
    // Standby worker node (container-of-souls) exits immediately, preventing duplicate
    // and false-alarm 1:30 PM warning emails.
    if config.is_standby() {
        warn!(
            "Node '{}' detected as STANDBY / WORKER (NODE_ROLE={}). Scheduled 24h health email runner is DISABLED on this instance to prevent false alarms.",
            config.node_name,
            config.node_role
        );
        return;
    }

    info!(
        "Scheduled 24h health reporter activated for Primary Ingress node '{}' (NODE_ROLE={})",
        config.node_name,
        config.node_role
    );

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
                "[{}] Atelier Cluster 24h Health Report - {}",
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
