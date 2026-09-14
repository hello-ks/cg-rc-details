import React, { useState, useEffect } from 'react';
import { Server, Play, Pause, Square, RefreshCw, CheckCircle2, AlertCircle, Database, ShieldCheck, Terminal, Cpu } from 'lucide-react';
import { apiFetch } from '../utils/api';

export interface ServerQueueStatus {
  isRunning: boolean;
  isPaused: boolean;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  concurrency: number;
  delayMs: number;
  activeWorkers: number;
  startedAt: string | null;
  finishedAt: string | null;
  items: any[];
  logs: { timestamp: string; level: 'info' | 'success' | 'warning' | 'error'; message: string }[];
}

export const ServerBackgroundQueueWidget: React.FC = () => {
  const [status, setStatus] = useState<ServerQueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/background-queue/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Silently ignore transient network blips
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  const handlePause = async () => {
    setIsLoading(true);
    try {
      await apiFetch('/api/background-queue/pause', { method: 'POST' });
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await apiFetch('/api/background-queue/resume', { method: 'POST' });
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await apiFetch('/api/background-queue/stop', { method: 'POST' });
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  if (!status || (status.total === 0 && !status.isRunning)) {
    return null; // Do not show when no background server job has been launched
  }

  const progressPercent = status.total > 0 ? Math.min(100, Math.round((status.processed / status.total) * 100)) : 0;

  return (
    <div className="bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -right-16 -top-16 w-52 h-52 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400" />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Server-Side Worker
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                status.isRunning && !status.isPaused
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : status.isPaused
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {status.isRunning && !status.isPaused ? 'Active in Background' : status.isPaused ? 'Paused' : 'Completed'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Runs continuously on server. Safe to close or refresh this tab.</span>
            </p>
          </div>
        </div>

        {/* Worker Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {status.isRunning && !status.isPaused && (
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 transition"
              title="Pause Server Worker"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {status.isRunning && status.isPaused && (
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 transition"
              title="Resume Server Worker"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          )}

          {status.isRunning && (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition"
              title="Stop Worker"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${
              showLogs
                ? 'bg-indigo-500/30 border-indigo-500/60 text-indigo-200'
                : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showLogs ? 'Hide Logs' : 'Logs'}</span>
          </button>
        </div>
      </div>

      {/* Progress & Metrics */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-300 font-medium">
              Progress: <strong className="text-white font-mono">{status.processed}</strong> / {status.total} cards
            </span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status.successful} Saved to Cloud SQL</span>
            </span>
            {status.failed > 0 && (
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{status.failed} Failed</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
              <Cpu className="w-3 h-3 text-indigo-400" />
              {status.activeWorkers} active / {status.concurrency} workers ({status.delayMs}ms delay)
            </span>
            <span className="font-bold text-indigo-300 font-mono text-sm">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Live Server Logs Panel */}
      {showLogs && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Server Process Telemetry Log ({status.logs.length} events):</span>
            <span className="text-[11px] text-emerald-400">PostgreSQL Auto-Commit: ON</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-44 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin">
            {status.logs.length === 0 ? (
              <div className="text-slate-500 text-center py-4">Waiting for worker events...</div>
            ) : (
              status.logs.slice(-100).map((log, index) => (
                <div
                  key={index}
                  className={`leading-relaxed text-[11px] ${
                    log.level === 'success'
                      ? 'text-emerald-400'
                      : log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warning'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
