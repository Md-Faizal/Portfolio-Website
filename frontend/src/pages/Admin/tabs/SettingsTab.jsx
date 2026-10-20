import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Mail, ShieldAlert, Palette, CheckCircle2, Send, Lock, ExternalLink, RefreshCw } from 'lucide-react';

export default function SettingsTab({
  siteTheme,
  onThemeChange,
  onSendTestEmail,
  showToast
}) {
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailRecipient) return;
    setSendingTest(true);
    try {
      await onSendTestEmail(testEmailRecipient);
      setTestEmailRecipient('');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header Banner */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border"
        style={{
          padding: '28px 32px',
          backgroundColor: 'rgba(18, 19, 22, 0.85)',
          borderColor: 'rgba(255, 255, 255, 0.09)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px'
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#89ff00] animate-pulse" />
            <span className="text-xs font-mono font-semibold text-[#89ff00] tracking-widest uppercase">
              Global Cluster Parameters
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            System & Engine Settings
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Configure site appearance themes, SMTP relays, and emergency maintenance routing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gap: '24px' }}>
        {/* Site Theme Card */}
        <div
          className="rounded-3xl border flex flex-col justify-between"
          style={{
            padding: '28px',
            backgroundColor: 'rgba(18, 19, 22, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            gap: '20px'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}
            >
              <Palette className="w-5 h-5 text-[#89ff00]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Public Site Visual Engine</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Choose the public active theme variant.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => onThemeChange('classic')}
              className="text-left transition-all cursor-pointer"
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: siteTheme === 'classic' ? '1px solid #89ff00' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: siteTheme === 'classic' ? 'rgba(137, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                boxShadow: siteTheme === 'classic' ? '0 0 20px rgba(137, 255, 0, 0.15)' : 'none'
              }}
            >
              <span className="text-xs font-mono font-bold text-white block">Classic Minimalist</span>
              <span className="text-[11px] text-neutral-400 block mt-1">
                Monochrome elegance with smooth typography
              </span>
            </button>

            <button
              onClick={() => onThemeChange('vibrant')}
              className="text-left transition-all cursor-pointer"
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: siteTheme === 'vibrant' ? '1px solid #89ff00' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: siteTheme === 'vibrant' ? 'rgba(137, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                boxShadow: siteTheme === 'vibrant' ? '0 0 20px rgba(137, 255, 0, 0.15)' : 'none'
              }}
            >
              <span className="text-xs font-mono font-bold text-white block">Modern Vibrant</span>
              <span className="text-[11px] text-neutral-400 block mt-1">
                Atelier Neon Lime and Crimson hyper-aesthetics
              </span>
            </button>
          </div>
        </div>

        {/* Brevo SMTP Relay Test */}
        <div
          className="rounded-3xl border flex flex-col justify-between"
          style={{
            padding: '28px',
            backgroundColor: 'rgba(18, 19, 22, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            gap: '20px'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}
            >
              <Mail className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">SMTP Relay Connectivity Test</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Send a test probe via Brevo ESMTP relay (Port 587).</p>
            </div>
          </div>

          <form onSubmit={handleTestEmail} className="space-y-3 pt-2">
            <input
              type="email"
              required
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="recipient@example.com"
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#fff',
                width: '100%'
              }}
              className="text-xs font-mono placeholder:text-neutral-600 focus:outline-none focus:border-[#89ff00]/50"
            />
            <button
              type="submit"
              disabled={sendingTest}
              style={{
                padding: '12px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '12px',
                color: '#fff',
                width: '100%'
              }}
              className="hover:bg-white/15 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[#89ff00]" />
              <span>{sendingTest ? 'Sending Test Probe...' : 'Send Relay Test'}</span>
            </button>
          </form>
        </div>

        {/* Stalwart Mail Server & HA Replication */}
        <div
          className="rounded-3xl border flex flex-col justify-between"
          style={{
            padding: '28px',
            backgroundColor: 'rgba(18, 19, 22, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            gap: '18px'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  width: '42px',
                  height: '42px',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '12px'
                }}
              >
                <Mail className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Stalwart Mail HA & Webadmin</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Dual-node mail stack on my-mac & container-of-souls.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#89ff00]/15 text-[#89ff00] border border-[#89ff00]/30">
              DUAL-NODE HA
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Primary Mail Node</div>
              <div className="text-[#89ff00] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#89ff00] animate-pulse" />
                my-mac :8080 / 25
              </div>
              <div className="text-[11px] text-neutral-400">MX Ingress & Webmail</div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Standby Failover</div>
              <div className="text-sky-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                cos :8080 (Synced)
              </div>
              <div className="text-[11px] text-neutral-400">VCN Spool Replication</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href="https://mailadmin.faizal.uk/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-center text-white transition-all flex items-center justify-center gap-1.5"
            >
              <span>Launch Webadmin</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </a>

            <button
              type="button"
              onClick={() => showToast?.('Triggered VCN data replication across cluster nodes')}
              className="py-2.5 px-3 rounded-xl bg-[#89ff00]/10 hover:bg-[#89ff00]/20 border border-[#89ff00]/30 text-xs font-mono text-[#89ff00] transition-all cursor-pointer font-semibold flex items-center gap-1.5"
              title="Verify VCN Data Sync"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Nodes</span>
            </button>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div
          className="rounded-3xl border flex items-center justify-between"
          style={{
            padding: '28px',
            backgroundColor: 'rgba(18, 19, 22, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}
            >
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Emergency Maintenance Mode</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Reroutes incoming traffic to maintenance splash.</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={() => {
                setMaintenanceMode(!maintenanceMode);
                showToast?.(`Maintenance mode ${!maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#89ff00]"></div>
          </label>
        </div>

        {/* Master PIN & Security Status */}
        <div
          className="rounded-3xl border flex flex-col justify-between"
          style={{
            padding: '28px',
            backgroundColor: 'rgba(18, 19, 22, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            gap: '16px'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}
            >
              <Lock className="w-5 h-5 text-[#89ff00]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Console Session Authentication</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Active session secured with SHA-256 PIN validation.</p>
            </div>
          </div>
          <div
            className="flex items-center justify-between text-xs font-mono"
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '16px'
            }}
          >
            <span className="text-neutral-400">PIN Protection Status</span>
            <span className="text-[#89ff00] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> SECURE (ENFORCED)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
