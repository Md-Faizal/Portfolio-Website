import React from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Database, Activity, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import VmTelemetryChart from '../components/VmTelemetryChart';

export default function ClusterTab({ cluster, onOpenReportPreview }) {
  const primary = cluster?.primary || cluster?.master || {};
  const backup = cluster?.backup || cluster?.slave || {};

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

  const primaryCpu = primary.cpu?.loadPercent ?? 0;
  const primaryMemUsed = primary.memory?.usedPercent ?? 0;
  const primaryDiskUsed = primary.disk?.usedPercent ?? 0;

  const backupCpu = backup.cpu?.loadPercent ?? 0;
  const backupMemUsed = backup.memory?.usedPercent ?? 0;
  const backupDiskUsed = backup.disk?.usedPercent ?? 0;

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
              High-Availability Cluster Telemetry
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Multi-Node Autonomous Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Cloud-agnostic private cluster running compiled Rust microservices, memory-capped Docker containers, and live telemetry across primary and backup nodes.
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
            <span>Cockpit Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* NODE 1: PRIMARY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#89ff00]/10 border border-[#89ff00]/20 text-[#89ff00]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Node 01 // Primary Node // {primary.node || 'Primary Core'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
                  ONLINE
                </span>
              </div>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                IP: <strong className="text-white">{primary.ip || '10.0.0.86'}</strong> &bull; OS: {primary.os || 'Ubuntu 24.04 LTS'} &bull; Uptime: {formatUptime(primary.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Utilization"
            value={`${primaryCpu}%`}
            subvalue={`${primary.cpu?.cores || 1} Cores Active`}
            percent={primaryCpu}
            icon={Cpu}
            badge="PRIMARY"
          />
          <MetricCard
            title="Memory Allocation"
            value={formatBytes(primary.memory?.usedBytes)}
            subvalue={`Total: ${formatBytes(primary.memory?.totalBytes)}`}
            percent={primaryMemUsed}
            icon={Activity}
            badge={`${primaryMemUsed}%`}
          />
          <MetricCard
            title="Root Storage"
            value={formatBytes(primary.disk?.usedBytes)}
            subvalue={`Free: ${formatBytes(primary.disk?.availBytes)}`}
            percent={primaryDiskUsed}
            icon={HardDrive}
            badge={`${primaryDiskUsed}%`}
          />
          <MetricCard
            title="Load Average"
            value={primary.cpu?.loadAvg ? primary.cpu.loadAvg.slice(0, 2).join(', ') : '0.12, 0.15'}
            subvalue="1m, 5m system load"
            icon={Database}
            badge="15m: 0.18"
            badgeColor="sky"
          />
        </div>

        {/* Detailed 24h Telemetry Chart for Node 01 */}
        <VmTelemetryChart
          nodeName="my-mac"
          roleLabel="Primary Stateful Core & Web Ingress"
          theme="neon"
          currentCpu={primaryCpu}
          currentRam={primaryMemUsed}
          currentDisk={primaryDiskUsed}
          ramUsedFormatted={formatBytes(primary.memory?.usedBytes)}
          ramTotalFormatted={formatBytes(primary.memory?.totalBytes)}
          diskUsedFormatted={formatBytes(primary.disk?.usedBytes)}
          diskTotalFormatted={formatBytes(primary.disk?.totalBytes)}
          history={primary.history}
          summary={primary.summary24h}
        />
      </section>

      {/* NODE 2: BACKUP */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Node 02 // Backup Node // {backup.node || 'Backup Worker'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  (backup.status || 'online').toLowerCase() === 'online'
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {backup.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                IP: <strong className="text-white">{backup.ip || '10.0.0.195'}</strong> &bull; OS: {backup.os || 'Ubuntu 26.04 LTS'} &bull; Role: Standby & On-Demand Services &bull; Uptime: {formatUptime(backup.uptime)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Utilization"
            value={`${backupCpu}%`}
            subvalue={`${backup.cpu?.cores || 2} Cores Active`}
            percent={backupCpu}
            icon={Cpu}
            badge="BACKUP"
            badgeColor="sky"
          />
          <MetricCard
            title="Memory Allocation"
            value={formatBytes(backup.memory?.usedBytes)}
            subvalue={`Total: ${formatBytes(backup.memory?.totalBytes)}`}
            percent={backupMemUsed}
            icon={Activity}
            badge={`${backupMemUsed}%`}
            badgeColor="sky"
          />
          <MetricCard
            title="Root Storage"
            value={formatBytes(backup.disk?.usedBytes)}
            subvalue={`Free: ${formatBytes(backup.disk?.availBytes)}`}
            percent={backupDiskUsed}
            icon={HardDrive}
            badge={`${backupDiskUsed}%`}
            badgeColor="sky"
          />
          <MetricCard
            title="Load Average"
            value={backup.cpu?.loadAvg ? backup.cpu.loadAvg.slice(0, 2).join(', ') : '0.05, 0.08'}
            subvalue="1m, 5m system load"
            icon={Database}
            badge="15m: 0.10"
            badgeColor="sky"
          />
        </div>

        {/* Detailed 24h Telemetry Chart for Node 02 */}
        <VmTelemetryChart
          nodeName="container-of-souls"
          roleLabel="Dedicated Compute Worker, Bloomberg & Game Engines"
          theme="sky"
          currentCpu={backupCpu}
          currentRam={backupMemUsed}
          currentDisk={backupDiskUsed}
          ramUsedFormatted={formatBytes(backup.memory?.usedBytes)}
          ramTotalFormatted={formatBytes(backup.memory?.totalBytes)}
          diskUsedFormatted={formatBytes(backup.disk?.usedBytes)}
          diskTotalFormatted={formatBytes(backup.disk?.totalBytes)}
          history={backup.history}
          summary={backup.summary24h}
        />
      </section>
    </div>
  );
}

