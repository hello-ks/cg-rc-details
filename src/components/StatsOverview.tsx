import React from 'react';
import { Users, FileCheck, Layers, Award, Sparkles, Building2 } from 'lucide-react';
import { BatchJobItem } from '../types';

interface StatsOverviewProps {
  items: BatchJobItem[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ items }) => {
  const successfulItems = items
    .filter(i => i.status === 'success' && i.result)
    .map(i => i.result!);

  const totalCards = items.length;
  const successCards = successfulItems.length;
  const totalFamilyMembers = successfulItems.reduce((acc, c) => acc + c.totalMembers, 0);

  // Scheme / Card Type counts
  const schemeCounts: Record<string, number> = {};
  successfulItems.forEach(card => {
    const type = card.cardType || 'प्राथमिकता';
    schemeCounts[type] = (schemeCounts[type] || 0) + 1;
  });

  const avgFamilySize = successCards > 0 ? (totalFamilyMembers / successCards).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Stat 1 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-3 right-3 p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
          <FileCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400 font-medium">Extracted Cards</div>
        <div className="text-2xl font-bold text-white mt-1 font-mono">{successCards} <span className="text-xs font-normal text-slate-500">/ {totalCards}</span></div>
        <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>{totalCards > 0 ? Math.round((successCards / totalCards) * 100) : 0}% success rate</span>
        </div>
      </div>

      {/* Stat 2 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-3 right-3 p-2 bg-teal-500/10 rounded-xl text-teal-400">
          <Users className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400 font-medium font-sans">Total Family Members</div>
        <div className="text-2xl font-bold text-teal-300 mt-1 font-mono">{totalFamilyMembers}</div>
        <div className="text-[11px] text-slate-400 mt-1">
          Avg. <strong className="text-teal-300">{avgFamilySize} members</strong> per ration card
        </div>
      </div>

      {/* Stat 3 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-3 right-3 p-2 bg-sky-500/10 rounded-xl text-sky-400">
          <Layers className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400 font-medium">Card Schemes (योजना)</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.keys(schemeCounts).length === 0 ? (
            <span className="text-xs text-slate-500 italic">No scheme data yet</span>
          ) : (
            Object.entries(schemeCounts).map(([scheme, count]) => (
              <span key={scheme} className="px-2 py-0.5 bg-slate-800 text-sky-300 text-[10px] rounded-md font-semibold border border-slate-700">
                {scheme.split(' ')[0]}: {count}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Stat 4 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-3 right-3 p-2 bg-purple-500/10 rounded-xl text-purple-400">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400 font-medium">FPS Fair Price Store</div>
        <div className="text-sm font-bold text-purple-300 mt-1 font-mono">ID: 412001080</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          Chhattisgarh FCS Portal
        </div>
      </div>
    </div>
  );
};
