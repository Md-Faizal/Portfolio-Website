import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Layers, Cpu, RefreshCw, CheckCircle2 } from 'lucide-react';
import ServiceCard from '../components/ServiceCard';

export default function ServicesTab({ services, onServiceAction, onRefresh, refreshing }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'docker' | 'systemctl'

  const filteredServices = services.filter((s) => {
    if (filter === 'docker') return s.type === 'docker';
    if (filter === 'systemctl') return s.type === 'systemctl';
    return true;
  });

  const onlineCount = services.filter((s) => s.status === 'running' || s.status === 'online').length;

  return (
    <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header bar */}
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
              Microservices & Daemons
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Container & System Orchestration
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Managing <strong className="text-white">{onlineCount} of {services.length}</strong> services healthy across nodes.
          </p>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#89ff00]/15 text-[#89ff00] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({services.length})
            </button>
            <button
              onClick={() => setFilter('docker')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'docker'
                  ? 'bg-[#89ff00]/15 text-[#89ff00] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Docker
            </button>
            <button
              onClick={() => setFilter('systemctl')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'systemctl'
                  ? 'bg-[#89ff00]/15 text-[#89ff00] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Systemd
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#89ff00]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onAction={onServiceAction}
          />
        ))}
      </div>
    </div>
  );
}
