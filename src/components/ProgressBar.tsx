import React from 'react';
import { Play, Pause, Square, RotateCcw, AlertTriangle, CheckCircle2, Clock, Zap, Activity } from 'lucide-react';
import { BatchProgress } from '../types';

interface ProgressBarProps {
  progress: BatchProgress;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  onRetryFailed: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  onStart,
  onPause,
  onStop,
  onReset,
  onRetryFailed
}) => {
  const { total, completed, successful, failed, status, startTime, currentSpeed = 0 } = progress;

  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  // Calculate ETA (Estimated Time Remaining)
  let etaSeconds = 0;
  if (status === 'running' && currentSpeed > 0 && total > completed) {
    etaSeconds = Math.ceil((total - completed) / currentSpeed);
  }

  const formatEta = (sec: number) => {
    if (sec <= 0) return '--';
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (mins > 0) return `${mins}m ${remainingSec}s`;
    return `${remainingSec}s`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl mb-6">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Batch Processing Control</h2>
            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              status === 'running' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' :
              status === 'paused' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
              status === 'completed' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {status === 'running' ? 'RUNNING BATCH' :
               status === 'paused' ? 'PAUSED' :
               status === 'completed' ? 'BATCH COMPLETE' : 'IDLE / READY'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {completed} of {total} ration cards processed ({percentage}%)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {status !== 'running' ? (
            <button
              onClick={onStart}
              disabled={total === 0 || completed === total}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{status === 'paused' ? 'Resume Batch' : 'Start Extraction Batch'}</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>Pause</span>
            </button>
          )}

          {status === 'running' && (
            <button
              onClick={onStop}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
            >
              <Square className="w-3.5 h-3.5 fill-slate-300" />
              <span>Stop</span>
            </button>
          )}

          {failed > 0 && status !== 'running' && (
            <button
              onClick={onRetryFailed}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed ({failed})</span>
            </button>
          )}

          {status !== 'running' && (
            <button
              onClick={onReset}
              disabled={total === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition disabled:opacity-30"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="relative w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-4">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-300 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          {status === 'running' && (
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[stripes_1s_linear_infinite]" />
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-center">
          <div className="text-slate-400 text-[11px] mb-0.5">Total Queue</div>
          <div className="text-base font-bold text-white font-mono">{total}</div>
        </div>

        <div className="bg-slate-950/60 border border-emerald-950 p-2.5 rounded-xl text-center">
          <div className="text-emerald-400 text-[11px] mb-0.5 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Successful
          </div>
          <div className="text-base font-bold text-emerald-400 font-mono">{successful}</div>
        </div>

        <div className="bg-slate-950/60 border border-red-950 p-2.5 rounded-xl text-center">
          <div className="text-red-400 text-[11px] mb-0.5 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Failed
          </div>
          <div className="text-base font-bold text-red-400 font-mono">{failed}</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-center">
          <div className="text-teal-400 text-[11px] mb-0.5 flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" /> Speed
          </div>
          <div className="text-base font-bold text-teal-300 font-mono">
            {currentSpeed > 0 ? `${currentSpeed.toFixed(1)}/s` : '--'}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-center col-span-2 sm:col-span-1">
          <div className="text-slate-400 text-[11px] mb-0.5 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" /> Est. Remaining
          </div>
          <div className="text-base font-bold text-sky-300 font-mono">
            {formatEta(etaSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};
