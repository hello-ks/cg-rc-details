import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, Database, RefreshCw, Info, FileSpreadsheet, Server, Cpu, Key } from 'lucide-react';

interface HeaderProps {
  totalItems: number;
  completedItems: number;
  isBackendConnected: boolean;
  onOpenApiKeyModal?: () => void;
  onOpenDatabaseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ totalItems, completedItems, isBackendConnected, onOpenApiKeyModal, onOpenDatabaseModal }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">CG Ration Card Extractor</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v2.4 Portal Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Automated batch scraper for</span>
              <a
                href="https://fcs.cg.gov.in/rcmodule/RptRationCardSearch.aspx"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] inline-flex items-center gap-0.5"
              >
                fcs.cg.gov.in <ExternalLink className="w-2.5 h-2.5 inline" />
              </a>
            </p>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-3 text-xs">
          {/* Server Connection Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            isBackendConnected 
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
              : 'bg-amber-950/60 border-amber-800 text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <Server className="w-3 h-3 opacity-70" />
            <span>{isBackendConnected ? 'Scraper Engine Ready' : 'Connecting Proxy...'}</span>
          </div>

          {/* Quick Counter */}
          <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300 font-mono">
            {completedItems} / {totalItems} Loaded
          </div>

          {/* RDBMS Database Storage Button */}
          {onOpenDatabaseModal && (
            <button
              onClick={onOpenDatabaseModal}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition border border-indigo-400/30"
              title="Inspect & Export Cloud SQL PostgreSQL Database"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Cloud SQL RDBMS</span>
            </button>
          )}

          {/* API Key Access Button */}
          {onOpenApiKeyModal && (
            <button
              onClick={onOpenApiKeyModal}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition"
              title="Manage API Keys & Integration Snippets"
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Key Access</span>
            </button>
          )}

          {/* Info Button */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Extraction System Details"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Dialog Drawer */}
      {showInfo && (
        <div className="bg-slate-850 border-t border-slate-800 px-6 py-4 text-xs text-slate-300 animate-in fade-in slide-in-from-top duration-200">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> High Speed Batch Proxy
              </div>
              <p className="text-slate-400 leading-relaxed">
                Uses Node.js Express server to dispatch parallel non-blocking HTTP requests to the Chhattisgarh Department of Food, Civil Supplies & Consumer Protection portal.
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-teal-400 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Error Handling & Retries
              </div>
              <p className="text-slate-400 leading-relaxed">
                Automatically handles rate limits, connection timeouts, and SSL handshake errors with exponential backoff retries and clear audit logging.
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-sky-400 mb-1 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Complete Data Extraction
              </div>
              <p className="text-slate-400 leading-relaxed">
                Extracts Head of Family, Guardian Name, Card Type, District, Block, Panchayat, Village, total family members, and individual member eKYC status into formatted Excel/CSV files.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
