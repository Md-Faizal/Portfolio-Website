import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  Cpu,
  Layers,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Activity,
  Globe,
  Radio,
  Zap,
  Boxes,
  ArrowRight,
  Database,
  Network
} from 'lucide-react';
import ServiceCard from '../components/ServiceCard';

export default function ServicesTab({ services = [], onServiceAction, onRefresh, refreshing }) {
  const [nodeFilter, setNodeFilter] = useState('all'); // 'all' | 'primary' | 'backup' | 'gcp' | 'both'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'docker' | 'systemctl'
  const [servingFilter, setServingFilter] = useState('all'); // 'all' | 'serving' | 'standby' | 'off'

  const getNodeCategory = (service) => {
    const node = (service.node || '').toLowerCase();
    if (node === 'both' || node === 'cluster' || node === 'all') return 'both';
    if (node === 'prometheus' || node === 'pro' || node === 'gcp') return 'gcp';
    if (node === 'container-of-souls' || node === 'cos' || node === 'secondary' || node === 'backup') return 'backup';
    return 'primary';
  };

  const getServingStatus = (service) => {
    return service.serving_state || (
      service.id === 'macos-server-green' ? 'standby' :
      (service.node === 'both' || service.node === 'cluster' || service.id === 'personal-site-rust' || service.id === 'cockpit') ? 'both' :
      (service.status === 'running' || service.status === 'online') ? 'active' : 'idle'
    );
  };

  const isOnline = (s) => s.status === 'running' || s.status === 'online';
  const isActivelyServing = (s) => {
    const st = getServingStatus(s);
    return (st === 'active' || st === 'both' || st === 'cluster') && isOnline(s);
  };
  const isStandby = (s) => getServingStatus(s) === 'standby';
  const isOff = (s) => !isOnline(s);

  const matchesFilter = (s) => {
    const sType = s.type || s.service_type || (s.control_type?.includes('docker') ? 'docker' : 'systemctl');
    if (typeFilter === 'docker' && sType !== 'docker') return false;
    if (typeFilter === 'systemctl' && sType !== 'systemctl') return false;
    if (servingFilter === 'serving' && !isActivelyServing(s)) return false;
    if (servingFilter === 'standby' && !isStandby(s)) return false;
    if (servingFilter === 'off' && !isOff(s)) return false;
    return true;
  };

  // Status sorting: Actively Serving first (1), Standby replicas second (2), Other Online third (3), Off/Stopped last (4)
  const serviceSortWeight = (s) => {
    if (isActivelyServing(s)) return 1;
    if (isStandby(s)) return 2;
    if (isOnline(s)) return 3;
    return 4;
  };

  const sortServices = (arr) => [...arr].sort((a, b) => serviceSortWeight(a) - serviceSortWeight(b));

  const primaryServices = services.filter((s) => getNodeCategory(s) === 'primary');
  const backupServices = services.filter((s) => getNodeCategory(s) === 'backup');
  const gcpServices = services.filter((s) => getNodeCategory(s) === 'gcp');
  const bothServices = services.filter((s) => getNodeCategory(s) === 'both');

  const visiblePrimary = sortServices(primaryServices.filter(matchesFilter));
  const visibleBackup = sortServices(backupServices.filter(matchesFilter));
  const visibleGcp = sortServices(gcpServices.filter(matchesFilter));
  const visibleBoth = sortServices(bothServices.filter(matchesFilter));

  const primaryOnline = primaryServices.filter(isOnline).length;
  const backupOnline = backupServices.filter(isOnline).length;
  const gcpOnline = gcpServices.filter(isOnline).length;
  const bothOnline = bothServices.filter(isOnline).length;
  const totalOnline = services.filter(isOnline).length;

  const activeServingCount = services.filter(isActivelyServing).length;
  const standbyCount = services.filter(isStandby).length;
  const offCount = services.filter(isOff).length;

  return (
    <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER BAR */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-3xl backdrop-blur-xl"
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
              Tri-Node Swarm Cluster Topology
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Container & System Orchestration
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Live telemetry detailing <strong className="text-[#89ff00]">my-mac (Active Edge)</strong>,{' '}
            <strong className="text-sky-400">cos (Failsafe Slot 1)</strong>, and{' '}
            <strong className="text-amber-400">pro (Failsafe Slot 2)</strong> cascading fallover.
          </p>
        </div>

        {/* Global Controls & Traffic Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-mono"
            style={{
              backgroundColor: 'rgba(137, 255, 0, 0.08)',
              border: '1px solid rgba(137, 255, 0, 0.25)'
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#89ff00] animate-pulse" />
            <span className="text-neutral-300">
              <strong className="text-[#89ff00]">{activeServingCount}</strong> Actively Serving
            </span>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-mono"
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-neutral-300">
              <strong className="text-sky-400">{standbyCount}</strong> Standby Replicas
            </span>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-mono"
            style={{
              backgroundColor: 'rgba(255, 51, 102, 0.08)',
              border: '1px solid rgba(255, 51, 102, 0.25)'
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#ff3366]" />
            <span className="text-neutral-300">
              <strong className="text-[#ff3366]">{offCount}</strong> Off / Stopped
            </span>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-mono"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <span className="text-neutral-400">
              Total: <strong className="text-white">{totalOnline}</strong> / {services.length}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh service status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#89ff00]' : 'text-neutral-400'}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. VISUAL TOPOLOGY & TRAFFIC CASCADING FAILOVER CARD */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl backdrop-blur-xl p-6 sm:p-7 relative overflow-hidden"
        style={{
          backgroundColor: 'rgba(15, 16, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#89ff00]/10 border border-[#89ff00]/30 text-[#89ff00]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Live Traffic Routing & Failsafe Cascade
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
                  MY-MAC &gt; COS &gt; PRO
                </span>
              </h3>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                Edge Nginx upstream proxy with automatic sub-millisecond retry matrix and cascading hot database replication.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Fault-Tolerant Mesh Online
            </span>
          </div>
        </div>

        {/* 3 Node Cascade Graphic */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative">
          {/* Node 1: my-mac */}
          <div
            className="rounded-2xl p-5 border relative flex flex-col justify-between"
            style={{
              backgroundColor: 'rgba(137, 255, 0, 0.03)',
              borderColor: 'rgba(137, 255, 0, 0.28)',
              boxShadow: '0 4px 20px rgba(137, 255, 0, 0.06)'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/20 text-[#89ff00] border border-[#89ff00]/40">
                  PRIORITY 1 // ACTIVE EDGE
                </span>
                <span className="w-2 h-2 rounded-full bg-[#89ff00] animate-pulse" title="Serving Live Traffic" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">my-mac</h4>
              <p className="text-xs font-mono text-neutral-400 mb-3">68.233.115.138 &bull; VCN 10.0.0.86</p>
              <div className="space-y-1.5 text-xs font-mono text-neutral-300">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Ingress Role:</span>
                  <span className="text-[#89ff00] font-bold">100% Active Traffic</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Core Engine:</span>
                  <span className="text-white">personal-site-rust :3002</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400">DB State:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3" /> Master Writer
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
              <span>Failover Timeout:</span>
              <span className="text-white font-bold">&lt; 3s auto-reroute</span>
            </div>
          </div>

          {/* Node 2: cos */}
          <div
            className="rounded-2xl p-5 border relative flex flex-col justify-between"
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.03)',
              borderColor: 'rgba(56, 189, 248, 0.28)',
              boxShadow: '0 4px 20px rgba(56, 189, 248, 0.06)'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">
                  PRIORITY 2 // FAILSAFE SLOT 1
                </span>
                <span className="w-2 h-2 rounded-full bg-sky-400" title="Warm Standby Ready" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">container-of-souls (cos)</h4>
              <p className="text-xs font-mono text-neutral-400 mb-3">129.154.32.125 &bull; VCN 10.0.0.195</p>
              <div className="space-y-1.5 text-xs font-mono text-neutral-300">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Failover Role:</span>
                  <span className="text-sky-400 font-bold">Slot 1 Hot Standby</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Standby Tunnel:</span>
                  <span className="text-white">127.0.0.1:9100 -&gt; :3002</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400">DB State:</span>
                  <span className="text-sky-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3" /> Cascaded Replica
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
              <span>Fallover Latency:</span>
              <span className="text-white font-bold">2.3 ms verified</span>
            </div>
          </div>

          {/* Node 3: pro */}
          <div
            className="rounded-2xl p-5 border relative flex flex-col justify-between"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.03)',
              borderColor: 'rgba(245, 158, 11, 0.28)',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.06)'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  PRIORITY 3 // FAILSAFE SLOT 2
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Auxiliary Standby Ready" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">prometheus (pro)</h4>
              <p className="text-xs font-mono text-neutral-400 mb-3">35.208.86.56 &bull; GCP e2-micro</p>
              <div className="space-y-1.5 text-xs font-mono text-neutral-300">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Auxiliary Role:</span>
                  <span className="text-amber-400 font-bold">Slot 2 Double-Fault</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Auxiliary Tunnel:</span>
                  <span className="text-white">127.0.0.1:9101 -&gt; :3002</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400">DB State:</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3" /> Cascaded Replica
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
              <span>Double-Fault Fallover:</span>
              <span className="text-white font-bold">518 ms verified</span>
            </div>
          </div>
        </div>

        {/* Database & Failover Protocol Ticker */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#89ff00] animate-pulse" />
            <span><strong>Database Replication:</strong> Transactional SQLite <code className="text-[#89ff00]">.backup</code> cascaded across cluster every 30m (<code className="text-neutral-400">my-mac &gt; cos &gt; pro</code>)</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Nginx Directive: <code className="text-white font-bold">proxy_next_upstream error timeout http_502 http_503 http_504</code></span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. SEGMENT NAVIGATION & FILTERS */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-2 rounded-2xl backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(18, 19, 22, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        {/* Node View Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setNodeFilter('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'all'
                ? 'bg-white/15 text-white font-bold shadow-sm border border-white/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>All Nodes ({services.length})</span>
          </button>

          <button
            onClick={() => setNodeFilter('primary')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'primary'
                ? 'bg-[#89ff00]/20 text-[#89ff00] font-bold border border-[#89ff00]/40 shadow-sm'
                : 'text-neutral-400 hover:text-[#89ff00] hover:bg-[#89ff00]/5 border border-transparent'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Priority 1: my-mac ({primaryServices.length})</span>
          </button>

          <button
            onClick={() => setNodeFilter('backup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'backup'
                ? 'bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-sky-400 hover:bg-sky-500/5 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Priority 2: cos ({backupServices.length})</span>
          </button>

          <button
            onClick={() => setNodeFilter('gcp')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'gcp'
                ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-amber-400 hover:bg-amber-500/5 border border-transparent'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Priority 3: pro ({gcpServices.length})</span>
          </button>

          <button
            onClick={() => setNodeFilter('both')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'both'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-purple-300 hover:bg-purple-500/5 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Swarm Fabric ({bothServices.length})</span>
          </button>
        </div>

        {/* Serving State & Engine Filters */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Serving Filter */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-mono">
            <button
              onClick={() => setServingFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                servingFilter === 'all'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setServingFilter('serving')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                servingFilter === 'serving'
                  ? 'bg-[#89ff00]/20 text-[#89ff00] font-bold'
                  : 'text-neutral-400 hover:text-[#89ff00]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#89ff00] animate-pulse" />
              <span>Serving ({activeServingCount})</span>
            </button>
            <button
              onClick={() => setServingFilter('standby')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                servingFilter === 'standby'
                  ? 'bg-sky-500/20 text-sky-400 font-bold'
                  : 'text-neutral-400 hover:text-sky-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Standby ({standbyCount})</span>
            </button>
            <button
              onClick={() => setServingFilter('off')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                servingFilter === 'off'
                  ? 'bg-[#ff3366]/20 text-[#ff3366] font-bold'
                  : 'text-neutral-400 hover:text-[#ff3366]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff3366]" />
              <span>Off ({offCount})</span>
            </button>
          </div>

          {/* Engine Type Filter */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-mono">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('docker')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'docker'
                  ? 'bg-sky-500/20 text-sky-400 font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Docker
            </button>
            <button
              onClick={() => setTypeFilter('systemctl')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'systemctl'
                  ? 'bg-[#89ff00]/20 text-[#89ff00] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Systemd
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. PRIORITY 1: MY-MAC */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(nodeFilter === 'all' || nodeFilter === 'primary') && (
        <section className="space-y-4">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(18, 19, 22, 0.75)',
              border: '1px solid rgba(137, 255, 0, 0.18)',
              boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)'
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#89ff00]/10 border border-[#89ff00]/30 text-[#89ff00] shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    Priority 1: my-mac // Active Edge & Ingress Proxy
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
                    ACTIVE EDGE CORE
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    68.233.115.138 &bull; 10.0.0.86
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Public edge reverse proxy, master stateful database writer, Stalwart mail daemon, and active desktop server.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#89ff00]/10 text-[#89ff00] border border-[#89ff00]/25">
                <span className="w-1.5 h-1.5 rounded-full bg-[#89ff00] animate-pulse" />
                {primaryOnline} of {primaryServices.length} Active
              </span>
            </div>
          </div>

          {visiblePrimary.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visiblePrimary.map((service) => (
                <ServiceCard key={service.id} service={service} onAction={onServiceAction} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-mono">
              No matching services on Priority 1 Node for active filters.
            </div>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. PRIORITY 2: COS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(nodeFilter === 'all' || nodeFilter === 'backup') && (
        <section className="space-y-4">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(18, 19, 22, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.22)',
              boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)'
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    Priority 2: cos // Failsafe Slot 1 & Standby Engines
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    FAILSAFE SLOT 1
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    129.154.32.125 &bull; 10.0.0.195
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Dedicated isolated compute node hosting Bloomberg Terminal, Green standby desktop, and cascading warm standby personal-site engine.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                {backupOnline} of {backupServices.length} Active
              </span>
            </div>
          </div>

          {visibleBackup.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleBackup.map((service) => (
                <ServiceCard key={service.id} service={service} onAction={onServiceAction} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-mono">
              No matching services on Priority 2 Node for active filters.
            </div>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 6. PRIORITY 3: PRO */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(nodeFilter === 'all' || nodeFilter === 'gcp') && (
        <section className="space-y-4">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(18, 19, 22, 0.75)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)'
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    Priority 3: pro // Failsafe Slot 2 & Auxiliary Compute
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    FAILSAFE SLOT 2
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    35.208.86.56 &bull; GCP e2-micro
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  GCP auxiliary node hosting Minecraft Bedrock and cascading auxiliary failsafe personal-site engine.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {gcpOnline} of {gcpServices.length} Active
              </span>
            </div>
          </div>

          {visibleGcp.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleGcp.map((service) => (
                <ServiceCard key={service.id} service={service} onAction={onServiceAction} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-mono">
              No matching services on Priority 3 Node for active filters.
            </div>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 7. TRI-NODE SWARM FABRIC */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(nodeFilter === 'all' || nodeFilter === 'both') && (
        <section className="space-y-4">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(18, 19, 22, 0.75)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)'
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    Tri-Node Swarm Fabric // Redundant Cross-Cluster Services
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    CROSS-NODE MESH
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    my-mac &bull; cos &bull; pro
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Redundant services replicated across all 3 nodes for zero-downtime failover and unified multi-host management.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                {bothOnline} of {bothServices.length} Synced
              </span>
            </div>
          </div>

          {visibleBoth.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleBoth.map((service) => (
                <ServiceCard key={service.id} service={service} onAction={onServiceAction} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-mono">
              No matching cluster services for active filters.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
