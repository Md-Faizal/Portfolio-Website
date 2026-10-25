import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Network,
  Server,
  Cpu,
  ShieldCheck,
  Layers,
  Radio,
  ArrowRight,
  Database,
  Activity,
  Zap,
  Mail,
  Monitor,
  Terminal,
  Gamepad2,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  Share2
} from 'lucide-react';

// ─── Extensible Multi-Service Topology Registry ─────────────────────────────
export const CLUSTER_SERVICES_REGISTRY = [
  {
    id: 'personal-site-rust',
    name: 'Faizal.uk Core (Rust Engine)',
    category: 'Web & API Engine',
    domain: 'faizal.uk',
    ingressPort: '443 / 80',
    color: '#89ff00', // emerald green
    accentBg: 'rgba(137, 255, 0, 0.12)',
    accentBorder: 'rgba(137, 255, 0, 0.35)',
    icon: Globe,
    dbSync: true,
    dbSyncProtocol: 'Hot SQLite .backup (every 30m)',
    failoverStrategy: 'Nginx proxy_next_upstream (error timeout 502 503 504)',
    cascade: [
      {
        nodeId: 'my-mac',
        label: 'my-mac',
        ip: '68.233.115.138',
        internalIp: '10.0.0.86',
        port: 3002,
        role: 'Active Ingress Core',
        priority: 1,
        status: 'active',
        latency: '1.2 ms',
        trafficShare: '100% (Normal)'
      },
      {
        nodeId: 'cos',
        label: 'container-of-souls',
        ip: '129.154.32.125',
        internalIp: '10.0.0.195',
        port: 9100,
        role: 'Failsafe Slot 1 (Hot Standby)',
        priority: 2,
        status: 'standby',
        latency: '2.3 ms',
        trafficShare: '0% (Standby)'
      },
      {
        nodeId: 'pro',
        label: 'prometheus (pro)',
        ip: '35.208.86.56',
        internalIp: 'GCP VPC',
        port: 9101,
        role: 'Failsafe Slot 2 (Auxiliary)',
        priority: 3,
        status: 'standby',
        latency: '14.8 ms',
        trafficShare: '0% (Standby)'
      }
    ]
  },
  {
    id: 'stalwart-mail',
    name: 'Stalwart Mail & JMAP Stack',
    category: 'Mail Infrastructure',
    domain: 'mail.faizal.uk',
    ingressPort: '443 / 8080 / 465 / 993',
    color: '#38bdf8', // sky blue
    accentBg: 'rgba(56, 189, 248, 0.12)',
    accentBorder: 'rgba(56, 189, 248, 0.35)',
    icon: Mail,
    dbSync: true,
    dbSyncProtocol: 'Maildir / SQLite Volume Sync',
    failoverStrategy: 'Dual-Host Inbound Tunnel & Standby Replica',
    cascade: [
      {
        nodeId: 'my-mac',
        label: 'my-mac',
        ip: '68.233.115.138',
        internalIp: '10.0.0.86',
        port: 8080,
        role: 'Primary Mail Host (MX: 10)',
        priority: 1,
        status: 'active',
        latency: '1.2 ms',
        trafficShare: '100% Inbound'
      },
      {
        nodeId: 'cos',
        label: 'container-of-souls',
        ip: '129.154.32.125',
        internalIp: '10.0.0.195',
        port: 8080,
        role: 'Standby Mail Replica (MX: 20)',
        priority: 2,
        status: 'standby',
        latency: '2.3 ms',
        trafficShare: '0% (Standby)'
      }
    ]
  },
  {
    id: 'macos-server',
    name: 'MacOS Web Desktop',
    category: 'Interactive Desktop Server',
    domain: 'mac.faizal.uk',
    ingressPort: '443',
    color: '#c084fc', // purple
    accentBg: 'rgba(192, 132, 252, 0.12)',
    accentBorder: 'rgba(192, 132, 252, 0.35)',
    icon: Monitor,
    dbSync: false,
    dbSyncProtocol: 'Stateless Session / Redis Auth',
    failoverStrategy: 'Blue/Green Dynamic Slot Ingress Proxy',
    cascade: [
      {
        nodeId: 'my-mac',
        label: 'my-mac',
        ip: '68.233.115.138',
        internalIp: '10.0.0.86',
        port: 3001,
        role: 'Blue Slot (Active Desktop)',
        priority: 1,
        status: 'active',
        latency: '1.2 ms',
        trafficShare: '100% Active'
      },
      {
        nodeId: 'cos',
        label: 'container-of-souls',
        ip: '129.154.32.125',
        internalIp: '10.0.0.195',
        port: 3004,
        role: 'Green Slot (Standby Replica)',
        priority: 2,
        status: 'standby',
        latency: '2.3 ms',
        trafficShare: '0% (Standby)'
      }
    ]
  },
  {
    id: 'bloomberg-terminal',
    name: 'Bloomberg Market Terminal',
    category: 'Financial Analytics Web App',
    domain: 'bloom.faizal.uk',
    ingressPort: '443',
    color: '#fbbf24', // amber
    accentBg: 'rgba(251, 191, 36, 0.12)',
    accentBorder: 'rgba(251, 191, 36, 0.35)',
    icon: Terminal,
    dbSync: false,
    dbSyncProtocol: 'Market Data In-Memory Cache',
    failoverStrategy: 'Slot Supervisor Healthwatch (Active Slot: Blue on 18081)',
    cascade: [
      {
        nodeId: 'cos',
        label: 'container-of-souls',
        ip: '129.154.32.125',
        internalIp: '10.0.0.195',
        port: 18081,
        role: 'Blue Active Slot (Web & API)',
        priority: 1,
        status: 'active',
        latency: '2.3 ms',
        trafficShare: '100% Active'
      },
      {
        nodeId: 'cos',
        label: 'container-of-souls',
        ip: '129.154.32.125',
        internalIp: '10.0.0.195',
        port: 18082,
        role: 'Green Warm Slot',
        priority: 2,
        status: 'standby',
        latency: '2.3 ms',
        trafficShare: '0% (Standby)'
      }
    ]
  },
  {
    id: 'mc-manager',
    name: 'Minecraft Bedrock & Paper Server',
    category: 'Game Engine Sentinel',
    domain: 'mine.faizal.uk',
    ingressPort: '19132 UDP / 25565 TCP',
    color: '#34d399', // emerald
    accentBg: 'rgba(52, 211, 153, 0.12)',
    accentBorder: 'rgba(52, 211, 153, 0.35)',
    icon: Gamepad2,
    dbSync: true,
    dbSyncProtocol: 'World Save Snapshots (Daily)',
    failoverStrategy: 'On-Demand GCP Engine Management',
    cascade: [
      {
        nodeId: 'pro',
        label: 'prometheus (pro)',
        ip: '35.208.86.56',
        internalIp: 'GCP e2-micro',
        port: 5000,
        role: 'Dedicated Compute Engine',
        priority: 1,
        status: 'active',
        latency: '14.8 ms',
        trafficShare: '100% Dedicated'
      }
    ]
  }
];

export default function ClusterNetworkVisualizer({ services = [] }) {
  const [selectedServiceId, setSelectedServiceId] = useState('personal-site-rust');
  const [simulationMode, setSimulationMode] = useState('nominal'); // 'nominal' | 'failover_cos' | 'double_pro'
  const [packetSpeed, setPacketSpeed] = useState(1); // 1 = normal, 2 = fast, 0.5 = slow

  const activeService = CLUSTER_SERVICES_REGISTRY.find((s) => s.id === selectedServiceId) || CLUSTER_SERVICES_REGISTRY[0];
  const IconComponent = activeService.icon;

  // Determine current active node based on simulation mode
  const getActiveTargetNode = () => {
    if (simulationMode === 'failover_cos') return 'cos';
    if (simulationMode === 'double_pro') return 'pro';
    return activeService.cascade[0]?.nodeId || 'my-mac';
  };

  const activeNodeId = getActiveTargetNode();

  // Packet animation variants
  const packetDuration = 2.4 / packetSpeed;

  return (
    <div
      className="rounded-3xl backdrop-blur-xl p-6 sm:p-8 relative overflow-hidden border transition-all"
      style={{
        backgroundColor: 'rgba(12, 13, 16, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0 16px 48px 0 rgba(0, 0, 0, 0.65)'
      }}
    >
      {/* Background Cyber Grid Accent */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. HEADER: REUSABLE SERVICE SELECTOR & CONTROLS */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-white/5 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeService.color }} />
            <span
              className="text-xs font-mono font-semibold tracking-widest uppercase"
              style={{ color: activeService.color }}
            >
              Extensible Ingress & Live Packet Mesh
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Live Traffic Routing & Failsafe Cascade</span>
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border"
              style={{
                backgroundColor: activeService.accentBg,
                borderColor: activeService.accentBorder,
                color: activeService.color
              }}
            >
              {activeService.domain}
            </span>
          </h3>
          <p className="text-xs font-mono text-neutral-400 mt-0.5 max-w-2xl">
            Real-time visual data packet streams routing from Cloudflare Anycast into edge proxies and cascading failsafe VM slots.
          </p>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setSimulationMode('nominal')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                simulationMode === 'nominal'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Nominal (Edge)</span>
            </button>
            <button
              onClick={() => setSimulationMode('failover_cos')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                simulationMode === 'failover_cos'
                  ? 'bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Simulate COS Failover</span>
            </button>
            <button
              onClick={() => setSimulationMode('double_pro')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                simulationMode === 'double_pro'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Simulate PRO Cascade</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. REUSABLE SERVICE TABS: SWITCH BETWEEN ANY CLUSTER APP */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="py-4 flex items-center gap-2 overflow-x-auto no-scrollbar relative z-10 border-b border-white/5">
        <span className="text-xs font-mono text-neutral-400 shrink-0 flex items-center gap-1.5 mr-2">
          <Layers className="w-3.5 h-3.5 text-neutral-400" />
          <span>Active Service:</span>
        </span>
        {CLUSTER_SERVICES_REGISTRY.map((srv) => {
          const SrvIcon = srv.icon;
          const isSelected = srv.id === selectedServiceId;
          return (
            <button
              key={srv.id}
              onClick={() => {
                setSelectedServiceId(srv.id);
                setSimulationMode('nominal');
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all shrink-0 cursor-pointer"
              style={{
                backgroundColor: isSelected ? srv.accentBg : 'rgba(255, 255, 255, 0.03)',
                border: isSelected ? `1px solid ${srv.accentBorder}` : '1px solid rgba(255, 255, 255, 0.06)',
                color: isSelected ? '#ffffff' : '#94a3b8'
              }}
            >
              <SrvIcon className="w-3.5 h-3.5" style={{ color: isSelected ? srv.color : '#94a3b8' }} />
              <span>{srv.name}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: srv.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. INTERACTIVE NETWORK FLOW CANVAS WITH REAL-TIME PACKETS */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="py-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          {/* Node 0: Internet & Cloudflare Anycast Edge */}
          <div
            className="rounded-2xl p-5 border flex flex-col items-center text-center relative"
            style={{
              backgroundColor: 'rgba(18, 19, 24, 0.9)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg relative"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <Globe className="w-6 h-6 text-white animate-spin-slow" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
            </div>
            <h4 className="text-sm font-bold text-white tracking-wide">Public Internet</h4>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">Cloudflare Anycast Proxy</p>
            <div className="mt-3 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono text-neutral-300">
              HTTPS :443 TLS 1.3
            </div>
          </div>

          {/* Node 1: Priority 1 (my-mac Active Edge) */}
          <motion.div
            animate={{
              scale: activeNodeId === 'my-mac' ? 1.02 : 1,
              borderColor: activeNodeId === 'my-mac' ? activeService.color : 'rgba(255, 255, 255, 0.1)'
            }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-5 border flex flex-col justify-between relative"
            style={{
              backgroundColor: activeNodeId === 'my-mac' ? activeService.accentBg : 'rgba(18, 19, 24, 0.75)',
              boxShadow: activeNodeId === 'my-mac' ? `0 0 25px -5px ${activeService.color}40` : 'none'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white">
                  PRIORITY 1
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeNodeId === 'my-mac' ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{ backgroundColor: activeService.color }}
                />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-white" />
                <h4 className="text-sm font-bold text-white">my-mac</h4>
              </div>
              <p className="text-[11px] font-mono text-neutral-400">68.233.115.138</p>
              <p className="text-[10px] font-mono text-neutral-400">VCN 10.0.0.86</p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono">
              <span className="text-neutral-400">Status: </span>
              <strong style={{ color: activeNodeId === 'my-mac' ? activeService.color : '#94a3b8' }}>
                {activeNodeId === 'my-mac' ? 'Active Ingress Core' : 'Standby Bypass'}
              </strong>
            </div>
          </motion.div>

          {/* Node 2: Priority 2 (cos Failsafe Slot 1) */}
          <motion.div
            animate={{
              scale: activeNodeId === 'cos' ? 1.02 : 1,
              borderColor: activeNodeId === 'cos' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'
            }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-5 border flex flex-col justify-between relative"
            style={{
              backgroundColor: activeNodeId === 'cos' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(18, 19, 24, 0.75)',
              boxShadow: activeNodeId === 'cos' ? '0 0 25px -5px rgba(56, 189, 248, 0.4)' : 'none'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/20 text-sky-400">
                  PRIORITY 2
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeNodeId === 'cos' ? 'bg-sky-400 animate-pulse' : 'bg-neutral-500'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-bold text-white">cos</h4>
              </div>
              <p className="text-[11px] font-mono text-neutral-400">129.154.32.125</p>
              <p className="text-[10px] font-mono text-neutral-400">VCN 10.0.0.195</p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono">
              <span className="text-neutral-400">Status: </span>
              <strong className={activeNodeId === 'cos' ? 'text-sky-400' : 'text-neutral-400'}>
                {activeNodeId === 'cos' ? 'Serving Fallover' : 'Warm Standby'}
              </strong>
            </div>
          </motion.div>

          {/* Node 3: Priority 3 (pro Failsafe Slot 2) */}
          <motion.div
            animate={{
              scale: activeNodeId === 'pro' ? 1.02 : 1,
              borderColor: activeNodeId === 'pro' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'
            }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-5 border flex flex-col justify-between relative"
            style={{
              backgroundColor: activeNodeId === 'pro' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(18, 19, 24, 0.75)',
              boxShadow: activeNodeId === 'pro' ? '0 0 25px -5px rgba(245, 158, 11, 0.4)' : 'none'
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-400">
                  PRIORITY 3
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeNodeId === 'pro' ? 'bg-amber-400 animate-pulse' : 'bg-neutral-500'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white">pro</h4>
              </div>
              <p className="text-[11px] font-mono text-neutral-400">35.208.86.56</p>
              <p className="text-[10px] font-mono text-neutral-400">GCP e2-micro</p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono">
              <span className="text-neutral-400">Status: </span>
              <strong className={activeNodeId === 'pro' ? 'text-amber-400' : 'text-neutral-400'}>
                {activeNodeId === 'pro' ? 'Serving Fallover' : 'Auxiliary Slot'}
              </strong>
            </div>
          </motion.div>
        </div>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* ANIMATED PACKET STREAM SVG OVERLAY */}
        {/* ──────────────────────────────────────────────────────────── */}
        <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400 mb-2">
            <span className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 animate-pulse" style={{ color: activeService.color }} />
              <span>Real-Time Packet Transmission // <strong>{activeService.domain}</strong></span>
            </span>
            <span>Edge Target: <code style={{ color: activeService.color }}>{activeNodeId}</code></span>
          </div>

          <svg className="w-full h-12 overflow-visible" viewBox="0 0 800 48" fill="none">
            {/* Background connection rails */}
            <path d="M 50 24 L 250 24" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M 250 24 L 500 24" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M 500 24 L 750 24" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" />

            {/* Active flowing gradient paths based on active node */}
            <path
              d={
                activeNodeId === 'my-mac'
                  ? 'M 50 24 L 250 24'
                  : activeNodeId === 'cos'
                  ? 'M 50 24 L 500 24'
                  : 'M 50 24 L 750 24'
              }
              stroke={activeService.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="opacity-70"
            />

            {/* Streaming Animated Data Packets (Internet -> Active Node) */}
            <circle r="4" fill={activeService.color} filter="drop-shadow(0 0 6px rgba(255,255,255,0.8))">
              <animateMotion
                path={
                  activeNodeId === 'my-mac'
                    ? 'M 50 24 L 250 24'
                    : activeNodeId === 'cos'
                    ? 'M 50 24 L 500 24'
                    : 'M 50 24 L 750 24'
                }
                dur={`${packetDuration}s`}
                repeatCount="indefinite"
              />
            </circle>

            <circle r="3" fill="#ffffff" opacity="0.9">
              <animateMotion
                path={
                  activeNodeId === 'my-mac'
                    ? 'M 50 24 L 250 24'
                    : activeNodeId === 'cos'
                    ? 'M 50 24 L 500 24'
                    : 'M 50 24 L 750 24'
                }
                dur={`${packetDuration}s`}
                begin={`${packetDuration * 0.33}s`}
                repeatCount="indefinite"
              />
            </circle>

            <circle r="3" fill={activeService.color} opacity="0.8">
              <animateMotion
                path={
                  activeNodeId === 'my-mac'
                    ? 'M 50 24 L 250 24'
                    : activeNodeId === 'cos'
                    ? 'M 50 24 L 500 24'
                    : 'M 50 24 L 750 24'
                }
                dur={`${packetDuration}s`}
                begin={`${packetDuration * 0.66}s`}
                repeatCount="indefinite"
              />
            </circle>

            {/* Nodes connection points */}
            <circle cx="50" cy="24" r="5" fill="#38bdf8" />
            <circle cx="250" cy="24" r="5" fill={activeNodeId === 'my-mac' ? activeService.color : '#64748b'} />
            <circle cx="500" cy="24" r="5" fill={activeNodeId === 'cos' ? '#38bdf8' : '#64748b'} />
            <circle cx="750" cy="24" r="5" fill={activeNodeId === 'pro' ? '#f59e0b' : '#64748b'} />
          </svg>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. ACTIVE SERVICE METADATA & REPLICATION PROTOCOL */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5 text-xs font-mono">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-neutral-400 text-[10px]">REPLICATION STRATEGY</div>
            <div className="text-white font-semibold">{activeService.dbSyncProtocol}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <div className="text-neutral-400 text-[10px]">INGRESS ROUTING RULE</div>
            <div className="text-white font-semibold truncate max-w-[200px]" title={activeService.failoverStrategy}>
              {activeService.failoverStrategy}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <Activity className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <div className="text-neutral-400 text-[10px]">INGRESS PROTOCOL</div>
            <div className="text-white font-semibold">{activeService.ingressPort} via {activeService.domain}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
