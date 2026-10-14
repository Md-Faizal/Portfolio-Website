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
  Boxes
} from 'lucide-react';
import ServiceCard from '../components/ServiceCard';

export default function ServicesTab({ services = [], onServiceAction, onRefresh, refreshing }) {
  const [nodeFilter, setNodeFilter] = useState('all'); // 'all' | 'primary' | 'secondary' | 'both'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'docker' | 'systemctl'
  const [servingFilter, setServingFilter] = useState('all'); // 'all' | 'serving' | 'standby'

  const getNodeCategory = (service) => {
    const node = (service.node || '').toLowerCase();
    if (node === 'both' || node === 'cluster') return 'both';
    if (node === 'container-of-souls' || node === 'cos' || node === 'secondary') return 'secondary';
    return 'primary';
  };

  const getServingStatus = (service) => {
    return service.serving_state || (
      service.id === 'macos-server-green' ? 'standby' :
      (service.node === 'both' || service.id === 'personal-site-rust' || service.id === 'cockpit') ? 'both' :
      (service.status === 'running' || service.status === 'online') ? 'active' : 'idle'
    );
  };

  const isOnline = (s) => s.status === 'running' || s.status === 'online';
  const isActivelyServing = (s) => {
    const st = getServingStatus(s);
    return (st === 'active' || st === 'both') && isOnline(s);
  };
  const isStandby = (s) => getServingStatus(s) === 'standby';

  const matchesFilter = (s) => {
    if (typeFilter === 'docker' && s.type !== 'docker') return false;
    if (typeFilter === 'systemctl' && s.type !== 'systemctl') return false;
    if (servingFilter === 'serving' && !isActivelyServing(s)) return false;
    if (servingFilter === 'standby' && !isStandby(s)) return false;
    return true;
  };

  const primaryServices = services.filter((s) => getNodeCategory(s) === 'primary');
  const secondaryServices = services.filter((s) => getNodeCategory(s) === 'secondary');
  const bothServices = services.filter((s) => getNodeCategory(s) === 'both');

  const visiblePrimary = primaryServices.filter(matchesFilter);
  const visibleSecondary = secondaryServices.filter(matchesFilter);
  const visibleBoth = bothServices.filter(matchesFilter);

  const primaryOnline = primaryServices.filter(isOnline).length;
  const secondaryOnline = secondaryServices.filter(isOnline).length;
  const bothOnline = bothServices.filter(isOnline).length;
  const totalOnline = services.filter(isOnline).length;

  const activeServingCount = services.filter(isActivelyServing).length;
  const standbyCount = services.filter(isStandby).length;

  return (
    <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header bar */}
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
              Multi-Node Microservices Topology
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Container & System Orchestration
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Live telemetry detailing <strong className="text-[#89ff00]">actively serving engines</strong>,{' '}
            <strong className="text-sky-400">failover standby replicas</strong>, and dual-node cluster fabrics.
          </p>
        </div>

        {/* Global Controls & Traffic Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Actively Serving Pill */}
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

          {/* Standby Replicas Pill */}
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

          {/* Total Online Pill */}
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

      {/* Segment Navigation & Serving/Type Filters */}
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
            <span>Primary VM ({primaryServices.length})</span>
          </button>

          <button
            onClick={() => setNodeFilter('secondary')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              nodeFilter === 'secondary'
                ? 'bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-sky-400 hover:bg-sky-500/5 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Secondary VM ({secondaryServices.length})</span>
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
            <span>Both / Cluster ({bothServices.length})</span>
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
      {/* 1. PRIMARY VM (my-mac) */}
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
                    Primary VM // my-mac
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
                    MASTER CORE
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    10.0.0.86
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Edge reverse proxy, production stateful database, Stalwart mail daemon, and primary desktop servers.
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
              No matching services on Primary VM for active filters.
            </div>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. SECONDARY VM (container-of-souls) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(nodeFilter === 'all' || nodeFilter === 'secondary') && (
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
                    Secondary VM // container-of-souls
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    STANDBY & WORKER
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    10.0.0.195
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Dedicated isolated compute node hosting Bloomberg Terminal, Green standby desktop, and game engines.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                {secondaryOnline} of {secondaryServices.length} Active
              </span>
            </div>
          </div>

          {visibleSecondary.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleSecondary.map((service) => (
                <ServiceCard key={service.id} service={service} onAction={onServiceAction} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-mono">
              No matching services on Secondary VM for active filters.
            </div>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. BOTH / DUAL-NODE CLUSTER FABRIC */}
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
                    Dual-Node Cluster // Active-Standby Fabric
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    BOTH NODES
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10">
                    10.0.0.86 &bull; 10.0.0.195
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Redundant services replicated across both VMs for zero-downtime failover and unified multi-host management.
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
