import React, { useState } from 'react';
import { Upload, FileText, ListOrdered, Search, Settings, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Zap } from 'lucide-react';
import { ATTACHED_RATION_CARDS } from '../data/attachedList';
import { parseUploadedFileContent } from '../utils/exportUtils';
import { BatchJobConfig } from '../types';

interface InputSectionProps {
  onLoadItems: (items: { rcNo: string; fpsId: string }[]) => void;
  config: BatchJobConfig;
  onUpdateConfig: (newConfig: Partial<BatchJobConfig>) => void;
  isProcessing: boolean;
  currentQueueCount: number;
}

export const InputSection: React.FC<InputSectionProps> = ({
  onLoadItems,
  config,
  onUpdateConfig,
  isProcessing,
  currentQueueCount
}) => {
  const [activeTab, setActiveTab] = useState<'attached' | 'paste' | 'upload' | 'single'>('attached');
  const [pastedText, setPastedText] = useState('');
  const [singleRcNo, setSingleRcNo] = useState('');
  const [singleFpsId, setSingleFpsId] = useState('412001080');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Quick stats for attached list
  const attachedCount = ATTACHED_RATION_CARDS.length;

  const handleLoadAttached = () => {
    const items = ATTACHED_RATION_CARDS.map(item => ({
      rcNo: item.rcNo,
      fpsId: item.fpsId
    }));
    onLoadItems(items);
  };

  const handleParsePasted = () => {
    if (!pastedText.trim()) return;
    const items = parseUploadedFileContent(pastedText);
    if (items.length === 0) {
      alert('No valid ration card numbers found in text. Enter 12-digit ration card numbers line by line.');
      return;
    }
    onLoadItems(items);
  };

  const handleSingleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleRcNo.trim()) return;
    onLoadItems([{
      rcNo: singleRcNo.trim(),
      fpsId: singleFpsId.trim() || '412001080'
    }]);
    setSingleRcNo('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const items = parseUploadedFileContent(text);
        if (items.length > 0) {
          onLoadItems(items);
          setUploadMessage(`Successfully parsed ${items.length} ration cards from ${file.name}`);
        } else {
          setUploadMessage(`Error: No valid 12-digit ration card numbers detected in ${file.name}`);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-6">
      {/* Tab Navigation */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('attached')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              activeTab === 'attached'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ListOrdered className="w-4 h-4 text-emerald-400" />
            <span>Attached List ({attachedCount} items)</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-emerald-500/20 text-emerald-300 rounded">Attached</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              activeTab === 'paste'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4 text-teal-400" />
            <span>Paste / Manual Input</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              activeTab === 'upload'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>Upload File (.csv / .txt)</span>
          </button>

          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              activeTab === 'single'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-4 h-4 text-purple-400" />
            <span>Single Lookup</span>
          </button>
        </div>

        {/* Quick Settings toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-1.5 px-3 py-1.5 mb-2 rounded-lg text-xs font-medium transition border ${
            showSettings
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Extraction Settings</span>
        </button>
      </div>

      {/* Settings Drawer (if toggled) */}
      {showSettings && (
        <div className="bg-slate-950/60 border-b border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Parallel Workers (Concurrency)</label>
            <select
              value={config.concurrency}
              onChange={(e) => onUpdateConfig({ concurrency: Number(e.target.value) })}
              disabled={isProcessing}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Worker (Gentle / Rate Limit Safe)</option>
              <option value={2}>2 Workers (Recommended)</option>
              <option value={3}>3 Workers (Fast)</option>
              <option value={5}>5 Workers (Maximum Speed)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Delay Between Requests</label>
            <select
              value={config.delayMs}
              onChange={(e) => onUpdateConfig({ delayMs: Number(e.target.value) })}
              disabled={isProcessing}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={200}>200ms (Fastest)</option>
              <option value={500}>500ms (Balanced)</option>
              <option value={1000}>1000ms (1 sec)</option>
              <option value={2000}>2000ms (Safe Mode)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Auto-Retry Max Attempts</label>
            <select
              value={config.maxRetries}
              onChange={(e) => onUpdateConfig({ maxRetries: Number(e.target.value) })}
              disabled={isProcessing}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Retry</option>
              <option value={2}>2 Retries</option>
              <option value={3}>3 Retries</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Portal Firewall Fallback Mode</label>
            <button
              onClick={() => onUpdateConfig({ allowFallback: !config.allowFallback })}
              disabled={isProcessing}
              className={`w-full px-2.5 py-1.5 rounded-lg border font-medium flex items-center justify-between transition ${
                config.allowFallback
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span>{config.allowFallback ? 'Auto Schema Enabled' : 'Live Only'}</span>
              <span className={`w-2 h-2 rounded-full ${config.allowFallback ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content Body */}
      <div className="p-5">
        {/* Tab 1: Attached List */}
        {activeTab === 'attached' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">Pre-loaded Attached List Ready</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Contains all <strong>{attachedCount} ration cards</strong> from the user prompt file (Ration Card Numbers + FPS ID: 412001080).
                Click below to load all 498 items into the extraction queue.
              </p>
            </div>

            <button
              onClick={handleLoadAttached}
              disabled={isProcessing}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Load All {attachedCount} Cards</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 2: Paste List */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Paste Ration Card Numbers (one per line, or comma separated):
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Format: 223860008007, 412001080</span>
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`223860008007, 412001080\n223860309159, 412001080\n223860474673, 412001080`}
              rows={4}
              disabled={isProcessing}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end">
              <button
                onClick={handleParsePasted}
                disabled={isProcessing || !pastedText.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Parse & Add to Queue</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Upload File */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-slate-950/40 transition">
              <Upload className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
              <p className="text-xs text-slate-300 font-medium">Select a CSV or TXT file containing Ration Card Numbers</p>
              <p className="text-[11px] text-slate-500 mt-1">Supports columns: Serial No, Ration Card Number, FPS ID</p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="mt-3 text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30 cursor-pointer"
              />
            </div>
            {uploadMessage && (
              <div className="text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Single Lookup */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs text-slate-400 mb-1 font-medium">Ration Card Number (12 digits)</label>
              <input
                type="text"
                value={singleRcNo}
                onChange={(e) => setSingleRcNo(e.target.value)}
                placeholder="223860008007"
                required
                disabled={isProcessing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs text-slate-400 mb-1 font-medium">FPS ID (Optional)</label>
              <input
                type="text"
                value={singleFpsId}
                onChange={(e) => setSingleFpsId(e.target.value)}
                placeholder="412001080"
                disabled={isProcessing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={isProcessing || !singleRcNo.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Add Single Card</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
