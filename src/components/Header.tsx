import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, Database, RefreshCw, Info, FileSpreadsheet, Server, Cpu, Key, LogOut, UserCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  totalItems: number;
  completedItems: number;
  isBackendConnected: boolean;
  onOpenApiKeyModal?: () => void;
  onOpenDatabaseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ totalItems, completedItems, isBackendConnected, onOpenApiKeyModal, onOpenDatabaseModal }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">CG Ration Card Extractor</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v2.4 Secure
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

          {/* Right Status & Auth Controls */}
          <div className="flex items-center flex-wrap gap-2.5 text-xs">
            {/* Server Connection Status */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              isBackendConnected 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                : 'bg-amber-950/60 border-amber-800 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <Server className="w-3 h-3 opacity-70" />
              <span>{isBackendConnected ? 'Engine Ready' : 'Connecting...'}</span>
            </div>

            {/* Quick Counter */}
            <div className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300 font-mono">
              {completedItems} / {totalItems} Loaded
            </div>

            {/* RDBMS Database Storage Button */}
            {onOpenDatabaseModal && (
              <button
                onClick={onOpenDatabaseModal}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition border border-indigo-400/30 cursor-pointer"
                title="Inspect & Export Cloud SQL PostgreSQL Database"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Cloud SQL</span>
              </button>
            )}

            {/* API Key Access Button */}
            {onOpenApiKeyModal && (
              <button
                onClick={onOpenApiKeyModal}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Manage API Keys & Integration Snippets"
              >
                <Key className="w-3.5 h-3.5" />
                <span>API Keys</span>
              </button>
            )}

            {/* User Profile Badge & Security Dropdown */}
            {user && (
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg p-1">
                <div className="flex items-center gap-1 px-1.5 py-0.5 text-slate-300 font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono text-[11px] text-emerald-300">{user.username}</span>
                </div>

                {/* Change Password Button */}
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                  title="Change Admin Password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>

                {/* Logout Button */}
                <button
                  id="btn-logout"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50 transition cursor-pointer flex items-center gap-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium hidden sm:inline pr-1">Logout</span>
                </button>
              </div>
            )}

            {/* Info Button */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl text-slate-100">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>
            
            <h3 className="text-base font-semibold text-white mb-1.5">Sign Out of FCS Extractor</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to end your active administrator session? You will need to enter your password to sign back in.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-cancel-logout"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-logout"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-500 text-white transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isLoggingOut ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Confirm Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

