import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Download, Search, Check, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        (log.rcNo && log.rcNo.toLowerCase().includes(q))
      );
    }
    return true;
  });

  useEffect(() => {
    if (autoScroll && !isCollapsed) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isCollapsed]);

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const logText = logs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.rcNo ? `(RC: ${l.rcNo}) ` : ''}${l.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CG_RationCard_Batch_Log_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="bg-slate-950 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Extraction & Network Audit Log</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
            {logs.length} entries
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Level Filter */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                filterLevel === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterLevel('success')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                filterLevel === 'success' ? 'bg-emerald-950 text-emerald-300' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilterLevel('warn')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                filterLevel === 'warn' ? 'bg-amber-950 text-amber-300' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              Warn
            </button>
            <button
              onClick={() => setFilterLevel('error')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                filterLevel === 'error' ? 'bg-red-950 text-red-300' : 'text-slate-400 hover:text-red-300'
              }`}
            >
              Errors
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-28 sm:w-36"
            />
          </div>

          {/* Download & Clear */}
          <button
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-40"
            title="Download Log File (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800 transition disabled:opacity-40"
            title="Clear Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      {!isCollapsed && (
        <div className="bg-slate-950 p-3 h-48 sm:h-56 overflow-y-auto font-mono text-xs leading-relaxed space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic py-8 text-center text-[11px]">
              {logs.length === 0 ? 'No log events generated yet. Load ration cards and start batch processing.' : 'No logs match current filter criteria.'}
            </div>
          ) : (
            filteredLogs.map(log => {
              let colorClass = 'text-slate-300';
              let badge = 'INFO';
              if (log.level === 'success') {
                colorClass = 'text-emerald-400';
                badge = 'OK';
              } else if (log.level === 'warn') {
                colorClass = 'text-amber-300';
                badge = 'WARN';
              } else if (log.level === 'error') {
                colorClass = 'text-red-400';
                badge = 'ERR';
              }

              return (
                <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/40 p-0.5 rounded transition">
                  <span className="text-slate-600 select-none text-[10px]">{log.timestamp}</span>
                  <span className={`px-1 rounded text-[9px] font-bold ${
                    log.level === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                    log.level === 'warn' ? 'bg-amber-950 text-amber-300 border border-amber-900' :
                    log.level === 'error' ? 'bg-red-950 text-red-400 border border-red-900' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {badge}
                  </span>
                  {log.rcNo && (
                    <span className="text-teal-400 font-semibold text-[11px] shrink-0">[{log.rcNo}]</span>
                  )}
                  <span className={`break-all ${colorClass}`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
