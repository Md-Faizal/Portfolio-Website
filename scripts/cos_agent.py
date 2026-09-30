#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import subprocess
import time

PORT = 9100

def get_cpu_info():
    try:
        with open("/proc/loadavg") as f:
            loads = f.read().strip().split()
        cores = os.cpu_count() or 1
        load_1 = float(loads[0])
        load_5 = float(loads[1])
        load_15 = float(loads[2])
        load_pct = min(100.0, round((load_1 / cores) * 100, 1))
        return {
            "cores": cores,
            "loadAvg": [load_1, load_5, load_15],
            "loadPercent": load_pct
        }
    except Exception as e:
        return {"cores": 1, "loadAvg": [0, 0, 0], "loadPercent": 0, "error": str(e)}

def get_mem_info():
    try:
        mem = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = int(parts[1].strip().split()[0]) * 1024
                    mem[key] = val
        total = mem.get("MemTotal", 1)
        avail = mem.get("MemAvailable", mem.get("MemFree", 0))
        used = total - avail
        pct = round((used / total) * 100, 1)
        return {
            "totalBytes": total,
            "usedBytes": used,
            "freeBytes": avail,
            "usedPercent": pct
        }
    except Exception as e:
        return {"totalBytes": 0, "usedBytes": 0, "freeBytes": 0, "usedPercent": 0, "error": str(e)}

def get_disk_info():
    try:
        st = os.statvfs('/')
        total = st.f_blocks * st.f_frsize
        free = st.f_bavail * st.f_frsize
        used = total - free
        pct = round((used / total) * 100, 1)
        return {
            "totalBytes": total,
            "usedBytes": used,
            "availBytes": free,
            "usedPercent": pct
        }
    except Exception as e:
        return {"totalBytes": 0, "usedBytes": 0, "availBytes": 0, "usedPercent": 0, "error": str(e)}

def get_uptime():
    try:
        with open("/proc/uptime") as f:
            return int(float(f.read().split()[0]))
    except Exception:
        return 0

def get_services():
    services = ["cockpit.socket", "ssh"]
    res = []
    for s in services:
        try:
            status = subprocess.check_output(["systemctl", "is-active", s], text=True).strip()
        except subprocess.CalledProcessError as e:
            status = e.output.strip() if e.output else "inactive"
        except Exception:
            status = "unknown"
        res.append({"name": s, "status": status})
    return res

class SlaveHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ['/stats', '/health', '/metrics', '/']:
            data = {
                "node": "container-of-souls",
                "role": "Slave (Compute & Workers)",
                "ip": "10.0.0.195",
                "status": "online",
                "os": "Ubuntu 26.04 LTS",
                "uptime": get_uptime(),
                "cpu": get_cpu_info(),
                "memory": get_mem_info(),
                "disk": get_disk_info(),
                "services": get_services(),
                "timestamp": int(time.time())
            }
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), SlaveHandler) as httpd:
        httpd.serve_forever()
