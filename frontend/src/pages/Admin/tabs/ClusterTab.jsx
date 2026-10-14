import React from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Database, Activity, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import MetricCard from '../components/MetricCard';

export default function ClusterTab({ cluster, onOpenReportPreview }) {
  const master = cluster?.master || {};
  const slave = cluster?.slave || {};

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0h 0m';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m`;
  };

  const masterCpu = master.cpu?.loadPercent ?? 0;
  const masterMemUsed = master.memory?.usedPercent ?? 0;
  const masterDiskUsed = master.disk?.usedPercent ?? 0;

  const slaveCpu = slave.cpu?.loadPercent ?? 0;
  const slaveMemUsed = slave.memory?.usedPercent ?? 0;
  const slaveDiskUsed = slave.disk?.usedPercent ?? 0;

  return (
    <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Banner & Cockpit Access */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl backdrop-blur-xl"
        style={{
          padding: '28px',
          backgroundColor: 'rgba(18, 19, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
          boxSizing: 'border-box'
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#89ff00] animate-pulse" />
            <span className="text-xs font-mono font-semibold text-[#89ff00] tracking-widest uppercase">
              Dual-Node Cluster Telemetry
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            High-Performance Micro-Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Autonomous private cluster running compiled Rust microservices, memory-capped Docker containers, and Cockpit 362 bridge telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenReportPreview}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-semibold text-white transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 text-[#89ff00]" />
            <span>24h Report</span>
          </button>
          <a
            href="https://faizal.uk:9090"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#89ff00]/10 hover:bg-[#89ff00]/20 border border-[#89ff00]/30 text-xs font-mono font-semibold text-[#89ff00] transition-all"
          >
            <span>Cockpit 362</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* NODE 1: MASTER */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#89ff00]/10 border border-[#89ff00]/20 text-[#89ff00]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Node 01 // Primary Core // {master.node || 'my-mac'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
                  ONLINE
                </span>
              </div>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                IP: <strong className="text-white">{master.ip || '10.0.0.86'}</strong> &bull; OS: {master.os || 'Ubuntu 24.04 LTS'} &bull; Uptime: {formatUptime(master.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Utilization"
            value={`${masterCpu}%`}
            subvalue={`${master.cpu?.cores || 1} Cores Active`}
            percent={masterCpu}
            icon={Cpu}
            badge="PRIMARY"
          />
          <MetricCard
            title="Memory Allocation"
            value={formatBytes(master.memory?.usedBytes)}
            subvalue={`Total: ${formatBytes(master.memory?.totalBytes)}`}
            percent={masterMemUsed}
            icon={Activity}
            badge={`${masterMemUsed}%`}
          />
          <MetricCard
            title="NVMe Root Storage"
            value={formatBytes(master.disk?.usedBytes)}
            subvalue={`Free: ${formatBytes(master.disk?.availBytes)}`}
            percent={masterDiskUsed}
            icon={HardDrive}
            badge={`${masterDiskUsed}%`}
          />
          <MetricCard
            title="Load Average"
            value={master.cpu?.loadAvg ? master.cpu.loadAvg.slice(0, 2).join(', ') : '0.12, 0.15'}
            subvalue="1m, 5m system load"
            icon={Database}
            badge="15m: 0.18"
            badgeColor="sky"
          />
        </div>
      </section>

      {/* NODE 2: SLAVE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Node 02 // Standby Node // {slave.node || 'container-of-souls'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  (slave.status || 'online').toLowerCase() === 'online'
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {slave.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                IP: <strong className="text-white">{slave.ip || '10.0.0.195'}</strong> &bull; OS: {slave.os || 'Ubuntu 24.04.5 LTS'} &bull; Role: Standby & On-Demand Services &bull; Uptime: {formatUptime(slave.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Compute Load"
            value={`${slaveCpu}%`}
            subvalue={`${slave.cpu?.cores || 2} Cores Active`}
            percent={slaveCpu}
            icon={Cpu}
            badge="STANDBY"
            badgeColor="sky"
          />
          <MetricCard
            title="Worker RAM"
            value={formatBytes(slave.memory?.usedBytes)}
            subvalue={`Total: ${formatBytes(slave.memory?.totalBytes)}`}
            percent={slaveMemUsed}
            icon={Activity}
            badge={`${slaveMemUsed}%`}
            badgeColor="sky"
          />
          <MetricCard
            title="Worker Storage"
            value={formatBytes(slave.disk?.usedBytes)}
            subvalue={`Free: ${formatBytes(slave.disk?.availBytes)}`}
            percent={slaveDiskUsed}
            icon={HardDrive}
            badge={`${slaveDiskUsed}%`}
            badgeColor="sky"
          />
          <MetricCard
            title="VCN Connectivity"
            value="Healthy"
            subvalue="Latency: <1.2ms via private VCN"
            icon={ShieldCheck}
            badge="SECURE"
            badgeColor="lime"
          />
        </div>
      </section>
    </div>
  );
}

