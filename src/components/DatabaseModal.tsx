import React, { useState, useEffect } from 'react';
import { Database, Search, Download, Trash2, RefreshCw, X, HardDrive, CheckCircle2, ShieldCheck, FileSpreadsheet, Layers, UserCheck } from 'lucide-react';
import { ExtractedRationCardDetails } from '../types';
import * as XLSX from 'xlsx';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (card: ExtractedRationCardDetails) => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, onViewDetails }) => {
  const [dbStats, setDbStats] = useState<{
    dbEngine: string;
    dbConfigured: boolean;
    host: string;
    database: string;
    totalCardsSaved: number;
    totalMembersSaved: number;
    uniqueDistricts: number;
  } | null>(null);

  const [cards, setCards] = useState<ExtractedRationCardDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchDbData = async () => {
    setLoading(true);
    try {
      const [statsRes, cardsRes] = await Promise.all([
        fetch('/api/db/stats'),
        fetch('/api/db/cards')
      ]);

      if (statsRes.ok) {
        setDbStats(await statsRes.json());
      }

      if (cardsRes.ok) {
        const data = await cardsRes.json();
        setCards(data.cards || []);
      }
    } catch (err) {
      console.error('Failed to load DB details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCards = cards.filter(c =>
    c.rcNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.headName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.district && c.district.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.block && c.block.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteCard = async (rcNo: string) => {
    if (!confirm(`Are you sure you want to delete Ration Card ${rcNo} from the PostgreSQL database?`)) return;
    try {
      await fetch(`/api/db/cards/${rcNo}`, { method: 'DELETE' });
      setCards(prev => prev.filter(c => c.rcNo !== rcNo));
      fetchDbData();
    } catch (err) {
      alert('Failed to delete card from database');
    }
  };

  const exportDbToExcel = () => {
    if (cards.length === 0) return;

    const flattened = cards.map(c => ({
      'Ration Card No (राशन कार्ड क्र.)': c.rcNo,
      'Head of Family (मुखिया का नाम)': c.headName,
      'Guardian / Husband Name (पिता/पति का नाम)': c.guardianName,
      'Card Scheme (कार्ड प्रकार)': c.cardType,
      'FPS ID (दुकान कोड)': c.fpsId,
      'FPS Name (दुकान नाम)': c.fpsName,
      'District (जिला)': c.district,
      'Block / Tehsil (विकासखंड)': c.block,
      'Gram Panchayat / Ward (ग्राम पंचायत)': c.gramPanchayat,
      'Village (गांव/शहर)': c.village,
      'Total Members (कुल सदस्य)': c.totalMembers,
      'Gas Connection (गैस कनेक्शन)': c.gasConnection,
      'Bank & Aadhaar Seeded (बैंक/आधारी सीलिंग)': c.bankAadhaarSeeded,
      'Extraction Timestamp': c.extractedAt,
      'Data Source': c.source
    }));

    const worksheet = XLSX.utils.json_to_sheet(flattened);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PostgreSQL Ration Cards');
    XLSX.writeFile(workbook, `CG_Ration_Cards_CloudSQL_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportDbToCSV = () => {
    if (cards.length === 0) return;

    const headers = ['RationCardNo', 'HeadName', 'GuardianName', 'CardType', 'FPSId', 'District', 'Block', 'GramPanchayat', 'Village', 'TotalMembers', 'ExtractedAt'];
    const rows = cards.map(c => [
      `"${c.rcNo}"`,
      `"${c.headName}"`,
      `"${c.guardianName}"`,
      `"${c.cardType}"`,
      `"${c.fpsId}"`,
      `"${c.district}"`,
      `"${c.block}"`,
      `"${c.gramPanchayat}"`,
      `"${c.village}"`,
      c.totalMembers,
      `"${c.extractedAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CG_Ration_Cards_CloudSQL_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-950/40">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Cloud SQL PostgreSQL Database RDBMS
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                  LIVE CONNECTED
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Extracted ration card records automatically persist in relational Cloud SQL storage.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Connection Specs Header */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 mb-0.5 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Database Engine
            </div>
            <div className="font-semibold text-white truncate">{dbStats?.dbEngine || 'Cloud SQL PostgreSQL'}</div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 mb-0.5 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Total Saved Cards
            </div>
            <div className="font-semibold text-emerald-400 font-mono text-sm">{dbStats?.totalCardsSaved || cards.length} Cards</div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 mb-0.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Total Saved Members
            </div>
            <div className="font-semibold text-sky-400 font-mono text-sm">{dbStats?.totalMembersSaved || 0} Members</div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 mb-0.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Unique Districts
            </div>
            <div className="font-semibold text-purple-300 font-mono text-sm">{dbStats?.uniqueDistricts || 0} Districts</div>
          </div>
        </div>

        {/* Search & Export Toolbar */}
        <div className="px-6 py-3 bg-slate-850 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by RC No, Name, District..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={fetchDbData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh RDBMS</span>
            </button>

            <button
              onClick={exportDbToCSV}
              disabled={cards.length === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium flex items-center gap-1.5 border border-slate-700 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={exportDbToExcel}
              disabled={cards.length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export RDBMS Excel</span>
            </button>
          </div>
        </div>

        {/* Database Table View */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-400" />
              <p>Querying Cloud SQL PostgreSQL database...</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <Database className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-400" />
              <p className="font-medium text-slate-300 mb-1">No Ration Cards Found in Database</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm ? 'No records match your search query.' : 'Cards extracted via the batch runner or API will automatically store into PostgreSQL.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Ration Card No.</th>
                    <th className="px-3 py-2.5">Head of Family</th>
                    <th className="px-3 py-2.5">Card Scheme</th>
                    <th className="px-3 py-2.5">District / Block</th>
                    <th className="px-3 py-2.5">Members</th>
                    <th className="px-3 py-2.5">Saved Time</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                  {filteredCards.map((card) => (
                    <tr key={card.rcNo} className="hover:bg-slate-850/60 transition">
                      <td className="px-3 py-2.5 font-semibold text-emerald-400">
                        {card.rcNo}
                      </td>
                      <td className="px-3 py-2.5 text-slate-100 font-sans">
                        {card.headName}
                      </td>
                      <td className="px-3 py-2.5 font-sans">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                          {card.cardType || 'प्राथमिकता'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-400">
                        <div>{card.district}</div>
                        <div className="text-[10px] text-slate-500">{card.block}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sky-400">
                        {card.totalMembers} Members
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px]">
                        {new Date(card.extractedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-sans space-x-2">
                        <button
                          onClick={() => onViewDetails(card)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs transition"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.rcNo)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete record from PostgreSQL"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cloud SQL PostgreSQL connection active & synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
