import React from 'react';
import { X, User, Users, ShieldCheck, MapPin, Building, Flame, CreditCard, ExternalLink, Copy, Check } from 'lucide-react';
import { ExtractedRationCardDetails } from '../types';

interface CardDetailModalProps {
  card: ExtractedRationCardDetails | null;
  onClose: () => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!card) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">{card.rcNo}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {card.cardType}
                </span>
              </div>
              <p className="text-xs text-slate-400">FPS Store ID: {card.fpsId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
              title="Copy JSON representation"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Primary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Head of Family */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" /> Head of Family Details (मुखिया जानकारी)
              </div>
              <div className="text-sm font-bold text-white font-sans">{card.headName}</div>
              <div className="text-xs text-slate-400">
                Father/Husband Name: <span className="text-slate-200 font-medium">{card.guardianName}</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
                <span>Gas Connection: <strong className="text-emerald-300">{card.gasConnection}</strong></span>
                <span>•</span>
                <span>Bank Seeded: <strong className="text-teal-300">{card.bankAadhaarSeeded}</strong></span>
              </div>
            </div>

            {/* Box 2: Location & FPS */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Location & FPS Shop (स्थान व दुकान)
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>District: <strong className="text-white">{card.district}</strong></div>
                <div>Block / ULB: <strong className="text-white">{card.block}</strong></div>
                <div>Gram Panchayat / Ward: <strong className="text-white">{card.gramPanchayat}</strong></div>
                <div>FPS Shop: <strong className="text-teal-300">{card.fpsName}</strong></div>
              </div>
            </div>
          </div>

          {/* Family Members Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Family Members List ({card.members.length} Registered Members)</span>
              </h4>
              <span className="text-[11px] text-slate-400">Source: {card.source}</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">S.No</th>
                    <th className="py-2.5 px-3">Member Name (नाम)</th>
                    <th className="py-2.5 px-3">Gender (लिंग)</th>
                    <th className="py-2.5 px-3">Age (आयु)</th>
                    <th className="py-2.5 px-3">Relation (संबंध)</th>
                    <th className="py-2.5 px-3">eKYC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {card.members.map((member) => (
                    <tr key={member.sNo} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 text-slate-500">{member.sNo}</td>
                      <td className="py-2.5 px-3 font-semibold text-white font-sans">{member.name}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">{member.gender}</td>
                      <td className="py-2.5 px-3 text-slate-300">{member.age} yrs</td>
                      <td className="py-2.5 px-3 text-teal-300 font-sans">{member.relation}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          member.aadhaarStatus.includes('Done') || member.aadhaarStatus.includes('Linked') || member.aadhaarStatus.includes('पूर्ण')
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-900'
                            : 'bg-amber-950 text-amber-300 border-amber-900'
                        }`}>
                          {member.aadhaarStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Extracted: {new Date(card.extractedAt).toLocaleString()}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
