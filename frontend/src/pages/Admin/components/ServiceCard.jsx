import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Square, Play, Layers, Cpu } from 'lucide-react';

export default function ServiceCard({ service, onAction }) {
  const [loadingAction, setLoadingAction] = useState(null);

  const handleAction = async (action) => {
    setLoadingAction(action);
    try {
      await onAction(service.id, action);
    } finally {
      setLoadingAction(null);
    }
  };

  const isRunning = service.status === 'running' || service.status === 'online';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border flex flex-col justify-between transition-all"
      style={{
        padding: '24px',
        minHeight: '210px',
        backgroundColor: 'rgba(18, 19, 22, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.09)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        boxSizing: 'border-box'
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {service.type === 'docker' ? (
                <Layers className="w-4 h-4 text-sky-400" />
              ) : (
                <Cpu className="w-4 h-4 text-neutral-400" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white truncate leading-snug">
                {service.name}
              </h4>
              <p className="text-xs font-mono text-neutral-400 truncate mt-0.5">
                {service.id}
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border shrink-0 ${
              isRunning
                ? 'text-[#89ff00] bg-[#89ff00]/15 border-[#89ff00]/30'
                : 'text-[#ff3366] bg-[#ff3366]/15 border-[#ff3366]/30'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isRunning ? 'bg-[#89ff00] animate-pulse' : 'bg-[#ff3366]'
              }`}
            />
            {service.status?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>

        {/* Metadata Tags */}
        <div
          className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 text-xs font-mono"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <span
            className="px-2.5 py-1 rounded-md text-neutral-300"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)'
            }}
          >
            Node: <strong className="text-white">{service.node}</strong>
          </span>
          {service.port && (
            <span
              className="px-2.5 py-1 rounded-md text-neutral-300"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)'
              }}
            >
              Port: <strong className="text-[#89ff00]">:{service.port}</strong>
            </span>
          )}
          <span
            className="px-2 py-1 rounded-md text-neutral-400 uppercase text-[10px]"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)'
            }}
          >
            {service.type}
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div
        className="flex items-center gap-2 mt-5 pt-3.5"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <button
          onClick={() => handleAction('restart')}
          disabled={Boolean(loadingAction)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-mono font-medium text-white transition-all cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          title="Restart service"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 text-neutral-300 ${
              loadingAction === 'restart' ? 'animate-spin text-[#89ff00]' : ''
            }`}
          />
          <span>{loadingAction === 'restart' ? 'Restarting...' : 'Restart'}</span>
        </button>

        {isRunning ? (
          <button
            onClick={() => handleAction('stop')}
            disabled={Boolean(loadingAction)}
            className="flex items-center justify-center p-2 rounded-xl text-[#ff3366] transition-all cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'rgba(255, 51, 102, 0.12)',
              border: '1px solid rgba(255, 51, 102, 0.25)'
            }}
            title="Stop service"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => handleAction('start')}
            disabled={Boolean(loadingAction)}
            className="flex items-center justify-center p-2 rounded-xl text-[#89ff00] transition-all cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'rgba(137, 255, 0, 0.12)',
              border: '1px solid rgba(137, 255, 0, 0.25)'
            }}
            title="Start service"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
