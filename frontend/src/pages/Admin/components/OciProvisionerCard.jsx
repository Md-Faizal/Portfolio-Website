import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, CheckCircle2, AlertTriangle, Clock, Layers } from 'lucide-react';

export default function OciProvisionerCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      // Priority 1: Direct public assets state file
      let res = await fetch('/assets/oci_state.json?t=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoading(false);
        return;
      }
      // Priority 2: API route fallback
      res = await fetch('/api/oci-allocator/status?t=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignored if file doesn't exist yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) return null;
  if (!data || data.status === 'NOT_CONFIGURED') return null;

  const isAllocated = data.status === 'ALLOCATED';
  const isAuthError = data.status === 'AUTH_ERROR';
  const isInProgress = data.status === 'JOB_IN_PROGRESS';

  const badgeColor = isAllocated
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : isAuthError
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : isInProgress
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  const statusLabel = isAllocated
    ? 'ALLOCATED ✅'
    : isAuthError
    ? 'AUTH REQUIRED ⚠️'
    : isInProgress
    ? 'APPLY IN PROGRESS'
    : 'SEARCHING CAPACITY';

  return (
    <div
      className="rounded-2xl backdrop-blur-xl border transition-all"
      style={{
        padding: '20px 24px',
        backgroundColor: 'rgba(15, 17, 21, 0.85)',
        borderColor: isAllocated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 text-amber-400">
            <Radio className={`w-4 h-4 ${!isAllocated ? 'animate-pulse text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                OCI Resource Manager Provisioner
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                [{data.region || 'ap-hyderabad-1'}]
              </span>
            </div>
            <p className="text-[11px] font-mono text-neutral-500 mt-0.5 truncate max-w-md">
              Stack: {data.stack_ocid ? `${data.stack_ocid.slice(0, 18)}...${data.stack_ocid.slice(-8)}` : 'Active'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${badgeColor}`}>
            {statusLabel}
          </span>
          <button
            onClick={fetchStatus}
            title="Refresh status"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-1">
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500">Today Attempts</span>
          <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">
            {data.attempts_today ?? 0}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500">Total Retries</span>
          <div className="text-sm font-mono font-bold text-white mt-0.5">
            {data.total_attempts ?? 0}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500">Last Attempt</span>
          <div className="text-[11px] font-mono text-neutral-300 mt-0.5 truncate" title={data.last_attempt_at || 'Waiting'}>
            {data.last_attempt_at ? data.last_attempt_at.split(' ')[1] || data.last_attempt_at : 'Pending'}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500">Latest Status</span>
          <div className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate" title={data.last_message || ''}>
            {data.last_message ? (data.last_message.length > 28 ? data.last_message.slice(0, 28) + '...' : data.last_message) : 'Ready'}
          </div>
        </div>
      </div>
    </div>
  );
}
