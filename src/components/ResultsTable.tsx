import React, { useState } from 'react';
import { Search, FileSpreadsheet, Download, Eye, RotateCw, Trash2, CheckCircle2, AlertTriangle, Clock, Filter, ArrowUpDown } from 'lucide-react';
import { BatchJobItem, ExtractedRationCardDetails } from '../types';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';

interface ResultsTableProps {
  items: BatchJobItem[];
  onViewDetails: (card: ExtractedRationCardDetails) => void;
  onRetrySingle: (rcNo: string, fpsId?: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  items,
  onViewDetails,
  onRetrySingle,
  onRemoveItem,
  onClearAll
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'processing'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'success' && item.status !== 'success') return false;
      if (statusFilter === 'failed' && item.status !== 'failed') return false;
      if (statusFilter === 'processing' && (item.status !== 'processing' && item.status !== 'pending' && item.status !== 'retrying')) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const card = item.result;
      return (
        item.rcNo.toLowerCase().includes(q) ||
        (item.fpsId && item.fpsId.toLowerCase().includes(q)) ||
        (card && card.headName.toLowerCase().includes(q)) ||
        (card && card.district.toLowerCase().includes(q)) ||
        (card && card.cardType.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const successfulCount = items.filter(i => i.status === 'success').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
      {/* Table Header Controls */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search RC No, Name, District..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'success' ? 'bg-emerald-950 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Extracted ({successfulCount})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'failed' ? 'bg-red-950 text-red-300 font-semibold' : 'text-slate-400 hover:text-red-300'
              }`}
            >
              Failed ({items.filter(i => i.status === 'failed').length})
            </button>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportToExcel(items, 'CG_RationCards_Batch')}
            disabled={successfulCount === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition disabled:opacity-40"
            title="Export full batch results to Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportToCSV(items, 'summary')}
            disabled={successfulCount === 0}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
            title="Export CSV Summary"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportToCSV(items, 'detailed_members')}
            disabled={successfulCount === 0}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
            title="Export Detailed Family Members breakdown CSV"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export Members CSV</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={items.length === 0}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition disabled:opacity-30"
            title="Clear Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Ration Card No</th>
              <th className="py-3 px-4">FPS ID</th>
              <th className="py-3 px-4">Head of Family</th>
              <th className="py-3 px-4">Card Type / Scheme</th>
              <th className="py-3 px-4">District / Block</th>
              <th className="py-3 px-4 text-center">Members</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 font-sans italic">
                  {items.length === 0 ? 'No ration cards loaded in queue. Select or paste ration card numbers above.' : 'No items match the current search or status filter.'}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                const card = item.result;

                return (
                  <tr key={item.id} className="hover:bg-slate-950/50 transition">
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">{globalIdx}</td>
                    
                    {/* Ration Card No */}
                    <td className="py-3 px-4 font-bold text-white font-mono">
                      {item.rcNo}
                    </td>

                    {/* FPS ID */}
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {item.fpsId || '412001080'}
                    </td>

                    {/* Head of Family */}
                    <td className="py-3 px-4 font-sans">
                      {card ? (
                        <div>
                          <div className="font-semibold text-slate-100">{card.headName}</div>
                          <div className="text-[10px] text-slate-400">Pati/Pita: {card.guardianName}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Pending extraction</span>
                      )}
                    </td>

                    {/* Card Type */}
                    <td className="py-3 px-4 font-sans">
                      {card ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {card.cardType}
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* District & Block */}
                    <td className="py-3 px-4 font-sans">
                      {card ? (
                        <div>
                          <div className="text-slate-200">{card.district}</div>
                          <div className="text-[10px] text-slate-400">{card.block} • {card.gramPanchayat}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Members Count */}
                    <td className="py-3 px-4 text-center font-bold text-white font-mono">
                      {card ? card.totalMembers : '--'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 font-sans">
                      {item.status === 'success' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Extracted</span>
                        </span>
                      )}

                      {item.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-semibold border border-sky-500/30 animate-pulse">
                          <RotateCw className="w-3 h-3 animate-spin text-sky-400" />
                          <span>Fetching...</span>
                        </span>
                      )}

                      {item.status === 'retrying' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                          <RotateCw className="w-3 h-3 text-amber-400" />
                          <span>Retry #{item.attempts}</span>
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-[10px] font-semibold border border-red-500/30" title={item.error}>
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span>Failed</span>
                        </span>
                      )}

                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>Queued</span>
                        </span>
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {card && (
                          <button
                            onClick={() => onViewDetails(card)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                            title="Inspect Family Members & Full Record"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onRetrySingle(item.rcNo, item.fpsId)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Re-scrape Ration Card"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition"
                          title="Remove from List"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filteredItems.length > 0 && (
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-white">{Math.min(currentPage * pageSize, filteredItems.length)}</strong> of{' '}
            <strong className="text-white">{filteredItems.length}</strong> items
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition"
            >
              Prev
            </button>
            <span className="font-mono text-slate-300 px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
