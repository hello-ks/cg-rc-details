import React, { useState, useEffect } from 'react';
import { Building2, Store, Users, RefreshCw, CheckCircle2, ArrowRight, Play, Database, Layers, ShieldCheck, Server, Sparkles, Square } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface District {
  distCode: string;
  distName: string;
}

interface Block {
  blockCode: string;
  blockName: string;
  distCode: string;
}

interface FpsShop {
  fpsId: string;
  fpsName: string;
  distCode: string;
  blockCode: string;
  totalCards: number;
}

interface RcItem {
  rcNo: string;
  fpsId: string;
  distCode?: string;
  blockCode?: string;
  scheme?: string;
  headName?: string;
}

interface CgPortalHierarchyPickerProps {
  onSupplyRcListToScraper: (items: { rcNo: string; fpsId: string }[], autoStart?: boolean) => void;
  isProcessing: boolean;
}

export const CgPortalHierarchyPicker: React.FC<CgPortalHierarchyPickerProps> = ({
  onSupplyRcListToScraper,
  isProcessing
}) => {
  // Dropdown States
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistCode, setSelectedDistCode] = useState<string>('');

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockCode, setSelectedBlockCode] = useState<string>('');

  const [fpsList, setFpsList] = useState<FpsShop[]>([]);
  const [selectedFpsId, setSelectedFpsId] = useState<string>('');

  // RC List State
  const [rcList, setRcList] = useState<RcItem[]>([]);
  const [limitCount, setLimitCount] = useState<number | 'all'>('all');

  // Loading & Status States
  const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(false);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState<boolean>(false);
  const [isLoadingFps, setIsLoadingFps] = useState<boolean>(false);
  const [isLoadingRcList, setIsLoadingRcList] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rdbmsSyncNotice, setRdbmsSyncNotice] = useState<string | null>(null);

  // Crawler Status State
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlStatus, setCrawlStatus] = useState<any>(null);

  // Server background queue trigger state
  const [isStartingServerQueue, setIsStartingServerQueue] = useState<boolean>(false);
  const [serverQueueStartedNotice, setServerQueueStartedNotice] = useState<string | null>(null);

  // 1. Initial Load: Fetch all CG Districts on mount
  useEffect(() => {
    fetchDistricts();
    checkCrawlStatus();
  }, []);

  const checkCrawlStatus = async () => {
    try {
      const res = await apiFetch('/api/epos/crawl-status');
      if (res.ok) {
        const data = await res.json();
        setCrawlStatus(data);
        if (data.isRunning) {
          setIsCrawling(true);
        }
      }
    } catch {
      // Ignore
    }
  };

  // Poll crawler if active
  useEffect(() => {
    if (!isCrawling) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/epos/crawl-status');
        if (res.ok) {
          const data = await res.json();
          setCrawlStatus(data);
          if (!data.isRunning) {
            setIsCrawling(false);
            fetchDistricts();
            setStatusMessage(`Sync completed! Stored ${data.completedDistricts || 0} districts, ${data.totalBlocksFound || 0} blocks, and ${data.totalFpsFound || 0} Fair Price Shops (FPS) in Cloud SQL.`);
          }
        }
      } catch {
        // Ignore
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [isCrawling]);

  const handleStartCrawler = async () => {
    setIsCrawling(true);
    setStatusMessage('Automated state-wide crawler started across all districts & blocks. Syncing Fair Price Shops (FPS) into Cloud SQL RDBMS...');
    try {
      const res = await apiFetch('/api/epos/crawl-hierarchy', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setIsCrawling(false);
        setStatusMessage(data.message || 'Crawler could not be started.');
      }
    } catch (err: any) {
      setIsCrawling(false);
      setStatusMessage(`Crawler error: ${err.message}`);
    }
  };

  const handleStopCrawler = async () => {
    try {
      await apiFetch('/api/epos/crawl-stop', { method: 'POST' });
      setStatusMessage('Stopping hierarchy crawler...');
    } catch (err: any) {
      console.error('Failed to stop crawler:', err);
    }
  };

  const fetchDistricts = async () => {
    setIsLoadingDistricts(true);
    setStatusMessage('Fetching Chhattisgarh District list from EPOS portal & syncing to Cloud SQL RDBMS...');
    try {
      const res = await apiFetch('/api/epos/districts');
      const data = await res.json();
      if (data.success && data.districts) {
        setDistricts(data.districts);
        setStatusMessage(`Loaded ${data.districts.length} Districts across Chhattisgarh. Select a District to proceed.`);
        setRdbmsSyncNotice(`Cloud SQL RDBMS updated with ${data.districts.length} districts.`);
      }
    } catch (err: any) {
      console.error('Failed to load districts:', err);
      setStatusMessage('Error loading districts. Please retry.');
    } finally {
      setIsLoadingDistricts(false);
    }
  };

  // 2. Cascade: When District changes, fetch Blocks
  useEffect(() => {
    if (!selectedDistCode) {
      setBlocks([]);
      setSelectedBlockCode('');
      setFpsList([]);
      setSelectedFpsId('');
      setRcList([]);
      return;
    }

    const fetchBlocks = async () => {
      setIsLoadingBlocks(true);
      setSelectedBlockCode('');
      setFpsList([]);
      setSelectedFpsId('');
      setRcList([]);
      setStatusMessage(`Fetching Blocks/AFSO for District (${selectedDistCode}) & syncing to RDBMS...`);

      try {
        const res = await apiFetch(`/api/epos/blocks?distCode=${selectedDistCode}`);
        const data = await res.json();
        if (data.success && data.blocks) {
          setBlocks(data.blocks);
          setStatusMessage(`Found ${data.blocks.length} Blocks in selected District. Please choose a Block.`);
          setRdbmsSyncNotice(`Cloud SQL RDBMS synced with ${data.blocks.length} blocks for district ${selectedDistCode}.`);
        }
      } catch (err) {
        console.error('Failed to load blocks:', err);
        setStatusMessage('Error loading blocks. Please retry.');
      } finally {
        setIsLoadingBlocks(false);
      }
    };

    fetchBlocks();
  }, [selectedDistCode]);

  // 3. Cascade: When Block changes, fetch FPS list
  useEffect(() => {
    if (!selectedDistCode || !selectedBlockCode) {
      setFpsList([]);
      setSelectedFpsId('');
      setRcList([]);
      return;
    }

    const fetchFps = async () => {
      setIsLoadingFps(true);
      setSelectedFpsId('');
      setRcList([]);
      setStatusMessage(`Fetching Fair Price Shops (FPS) for Block (${selectedBlockCode}) & syncing to RDBMS...`);

      try {
        const res = await apiFetch(`/api/epos/fps?distCode=${selectedDistCode}&blockCode=${selectedBlockCode}`);
        const data = await res.json();
        if (data.success && data.fpsList) {
          setFpsList(data.fpsList);
          setStatusMessage(`Found ${data.fpsList.length} Fair Price Shops. Please select an FPS.`);
          setRdbmsSyncNotice(`Cloud SQL RDBMS synced with ${data.fpsList.length} FPS shops.`);
        }
      } catch (err) {
        console.error('Failed to load FPS list:', err);
        setStatusMessage('Error loading FPS list. Please retry.');
      } finally {
        setIsLoadingFps(false);
      }
    };

    fetchFps();
  }, [selectedDistCode, selectedBlockCode]);

  // 4. Cascade: When FPS changes, fetch RC List
  useEffect(() => {
    if (!selectedDistCode || !selectedBlockCode || !selectedFpsId) {
      setRcList([]);
      return;
    }

    const fetchRcList = async () => {
      setIsLoadingRcList(true);
      setRcList([]);
      setStatusMessage(`Fetching Ration Card (RC) List for FPS (${selectedFpsId}) from CG Portal & saving to RDBMS...`);

      try {
        const res = await apiFetch(`/api/epos/rc-list?distCode=${selectedDistCode}&blockCode=${selectedBlockCode}&fpsId=${selectedFpsId}`);
        const data = await res.json();
        if (data.success && data.rcList) {
          setRcList(data.rcList);
          setStatusMessage(`Successfully fetched ${data.rcList.length} Ration Card Numbers! Saved to RDBMS.`);
          setRdbmsSyncNotice(`Cloud SQL RDBMS stored ${data.rcList.length} RC numbers in table "cg_fps_rc_numbers". Ready to supply to Scraper Engine.`);
        } else {
          setStatusMessage('No RC numbers returned for this shop in current active month.');
        }
      } catch (err) {
        console.error('Failed to load RC list:', err);
        setStatusMessage('Error retrieving RC list from portal.');
      } finally {
        setIsLoadingRcList(false);
      }
    };

    fetchRcList();
  }, [selectedDistCode, selectedBlockCode, selectedFpsId]);

  // Supply RC list to scraper engine
  const handleSupplyToScraper = (autoStart: boolean = false) => {
    if (rcList.length === 0) return;

    let itemsToSupply = rcList.map(item => ({
      rcNo: item.rcNo,
      fpsId: selectedFpsId
    }));

    if (limitCount !== 'all' && typeof limitCount === 'number') {
      itemsToSupply = itemsToSupply.slice(0, limitCount);
    }

    onSupplyRcListToScraper(itemsToSupply, autoStart);
  };

  // Supply RC list directly to server background worker
  const handleStartServerBackgroundQueue = async () => {
    if (rcList.length === 0) return;

    let itemsToSupply = rcList.map(item => ({
      rcNo: item.rcNo,
      fpsId: selectedFpsId
    }));

    if (limitCount !== 'all' && typeof limitCount === 'number') {
      itemsToSupply = itemsToSupply.slice(0, limitCount);
    }

    setIsStartingServerQueue(true);
    try {
      const res = await apiFetch('/api/background-queue/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSupply,
          fpsId: selectedFpsId,
          concurrency: 2,
          delayMs: 600
        })
      });
      const data = await res.json();
      if (data.success) {
        setServerQueueStartedNotice(`Autonomous server worker started with ${itemsToSupply.length} cards! It runs independently in the background on Cloud Run.`);
        setTimeout(() => setServerQueueStartedNotice(null), 10000);
      } else {
        setStatusMessage(`Server worker error: ${data.error || 'Failed to start server worker'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error starting server worker: ${err.message}`);
    } finally {
      setIsStartingServerQueue(false);
    }
  };

  // Group by scheme for nice chips
  const schemeSummary = rcList.reduce((acc, curr) => {
    const s = curr.scheme || 'OTHERS';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const selectedDistrictObj = districts.find(d => d.distCode === selectedDistCode);
  const selectedBlockObj = blocks.find(b => b.blockCode === selectedBlockCode);
  const selectedFpsObj = fpsList.find(f => f.fpsId === selectedFpsId);

  return (
    <div className="space-y-5">
      {/* Informational Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/40 border border-indigo-500/20 rounded-xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/30 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-white">CG State 3-Tier Drilldown (District → Block → FPS)</h4>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                Auto-fills Cloud SQL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any District, Block, and Fair Price Shop to auto-extract resident RC numbers and store in PostgreSQL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
          {/* 1-Click Automated FPS & Hierarchy Crawler */}
          <button
            onClick={handleStartCrawler}
            disabled={isCrawling || crawlStatus?.isRunning}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition flex-shrink-0 shadow-sm ${
              isCrawling || crawlStatus?.isRunning
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600/30 to-emerald-600/30 hover:from-indigo-600/50 hover:to-emerald-600/50 border-indigo-500/40 text-white cursor-pointer hover:border-indigo-400'
            }`}
            title="Automatically crawls and saves all 33 districts, blocks, and Fair Price Shops into Cloud SQL RDBMS"
          >
            {isCrawling || crawlStatus?.isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>
              {(isCrawling || crawlStatus?.isRunning) && crawlStatus
                ? `Syncing FPS (${crawlStatus.completedDistricts || 0}/33 Dist · ${crawlStatus.totalFpsFound || 0} FPS)`
                : 'Sync All FPS'}
            </span>
          </button>

          <button
            onClick={fetchDistricts}
            disabled={isLoadingDistricts}
            className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition flex-shrink-0"
            title="Refresh Hierarchy from Portal"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDistricts ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Crawler In-Progress Notice */}
      {(isCrawling || crawlStatus?.isRunning) && crawlStatus && (
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">Automated State Crawler Syncing FPS & Hierarchy</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-500/30">
                    Rate-Safe Mode
                  </span>
                </div>
                <p className="text-amber-300/80 text-[11px] mt-0.5">
                  Currently syncing: <strong className="text-white">{crawlStatus.currentDistrictName || 'Initializing...'}</strong>
                  {crawlStatus.currentBlockName && (
                    <span className="text-emerald-300 font-mono ml-1.5 font-medium">› {crawlStatus.currentBlockName}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <div className="font-mono font-bold text-amber-300 text-sm">
                  {crawlStatus.totalFpsFound || 0} FPS Synced
                </div>
                <div className="text-[10px] text-amber-400/80 font-mono">
                  {crawlStatus.completedDistricts || 0}/33 Districts · {crawlStatus.completedBlocks || crawlStatus.totalBlocksFound || 0} Blocks
                </div>
              </div>
              <button
                onClick={handleStopCrawler}
                className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 hover:text-white rounded-lg border border-red-700/60 flex items-center gap-1.5 transition font-semibold text-xs shadow-sm cursor-pointer"
                title="Stop syncing"
              >
                <Square className="w-3 h-3 fill-red-400 text-red-400" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-amber-500/20">
              <div
                className="bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 h-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((crawlStatus.completedDistricts || 0) /
                        Math.max(crawlStatus.totalDistricts || 33, 1)) *
                        100
                    )
                  )}%`
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-amber-400/70 font-mono">
              <span>Sync Progress</span>
              <span>
                {Math.min(
                  100,
                  Math.round(
                    ((crawlStatus.completedDistricts || 0) /
                      Math.max(crawlStatus.totalDistricts || 33, 1)) *
                      100
                  )
                )}
                % ({crawlStatus.completedDistricts || 0}/33 Districts)
              </span>
            </div>
          </div>

          {/* Real-time crawler log line */}
          {crawlStatus.logs && crawlStatus.logs.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-300 truncate">
              {crawlStatus.logs[crawlStatus.logs.length - 1]}
            </div>
          )}
        </div>
      )}

      {/* The 3 Dropdowns Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dropdown 1: District */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 focus-within:border-indigo-500/50 transition">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              1. Select District ({districts.length})
            </span>
            {isLoadingDistricts && (
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
            )}
          </label>
          <select
            value={selectedDistCode}
            onChange={(e) => setSelectedDistCode(e.target.value)}
            disabled={isLoadingDistricts || districts.length === 0}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 transition cursor-pointer"
          >
            <option value="">-- Choose Chhattisgarh District --</option>
            {districts.map((d) => (
              <option key={d.distCode} value={d.distCode}>
                {d.distName} ({d.distCode})
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{selectedDistrictObj ? `Selected: ${selectedDistrictObj.distName}` : '33 Districts in CG'}</span>
            <span className="text-indigo-400/80 font-mono">cg_districts</span>
          </div>
        </div>

        {/* Dropdown 2: Block / AFSO */}
        <div className={`bg-slate-950/80 border rounded-xl p-3.5 transition ${
          !selectedDistCode ? 'opacity-60 border-slate-850' : 'border-slate-800 focus-within:border-indigo-500/50'
        }`}>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              2. Select Block / AFSO ({blocks.length})
            </span>
            {isLoadingBlocks && (
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            )}
          </label>
          <select
            value={selectedBlockCode}
            onChange={(e) => setSelectedBlockCode(e.target.value)}
            disabled={!selectedDistCode || isLoadingBlocks || blocks.length === 0}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition cursor-pointer"
          >
            <option value="">
              {!selectedDistCode ? '-- First Select District --' : blocks.length === 0 && !isLoadingBlocks ? '-- No Blocks Found --' : '-- Choose Block / AFSO --'}
            </option>
            {blocks.map((b) => (
              <option key={b.blockCode} value={b.blockCode}>
                {b.blockName} ({b.blockCode})
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{selectedBlockObj ? `Selected: ${selectedBlockObj.blockName}` : 'Blocks in selected district'}</span>
            <span className="text-sky-400/80 font-mono">cg_blocks</span>
          </div>
        </div>

        {/* Dropdown 3: FPS (Fair Price Shop) */}
        <div className={`bg-slate-950/80 border rounded-xl p-3.5 transition ${
          !selectedBlockCode ? 'opacity-60 border-slate-850' : 'border-slate-800 focus-within:border-emerald-500/50'
        }`}>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              3. Select Fair Price Shop ({fpsList.length})
            </span>
            {isLoadingFps && (
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
            )}
          </label>
          <select
            value={selectedFpsId}
            onChange={(e) => setSelectedFpsId(e.target.value)}
            disabled={!selectedBlockCode || isLoadingFps || fpsList.length === 0}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 transition cursor-pointer"
          >
            <option value="">
              {!selectedBlockCode ? '-- First Select Block --' : fpsList.length === 0 && !isLoadingFps ? '-- No FPS Found --' : '-- Choose Fair Price Shop (FPS) --'}
            </option>
            {fpsList.map((f) => (
              <option key={f.fpsId} value={f.fpsId}>
                {f.fpsId} - {f.fpsName}
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{selectedFpsObj ? `ID: ${selectedFpsObj.fpsId}` : 'Ration distribution shops'}</span>
            <span className="text-emerald-400/80 font-mono">cg_fps</span>
          </div>
        </div>
      </div>

      {/* Status Notice & RDBMS Sync Indicator */}
      {(statusMessage || rdbmsSyncNotice) && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {isLoadingRcList || isLoadingFps || isLoadingBlocks || isLoadingDistricts ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
          {rdbmsSyncNotice && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex-shrink-0 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>RDBMS: Synced</span>
            </div>
          )}
        </div>
      )}

      {/* Result Section: When RC List is loaded for the selected FPS */}
      {selectedFpsId && (
        <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          {/* Glowing subtle top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-400" />

          {isLoadingRcList ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Extracting All Ration Cards from CG FCS Portal...</p>
                <p className="text-xs text-slate-400 mt-1">Connecting to FPS #{selectedFpsId} on Epos Spring backend and writing records to PostgreSQL RDBMS.</p>
              </div>
            </div>
          ) : rcList.length > 0 ? (
            <div className="space-y-4">
              {/* Header with FPS info & RC Count */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg">
                      FPS ID: {selectedFpsId}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {selectedFpsObj?.fpsName || `Shop #${selectedFpsId}`}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>District: <strong className="text-slate-200">{selectedDistrictObj?.distName}</strong></span>
                    <span>•</span>
                    <span>Block: <strong className="text-slate-200">{selectedBlockObj?.blockName}</strong></span>
                    <span>•</span>
                    <span>Stored in RDBMS: <strong className="text-emerald-400">cg_fps_rc_numbers ({rcList.length} rows)</strong></span>
                  </p>
                </div>

                {/* Big Count Badge */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-400 font-mono leading-none">
                      {rcList.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                      Ration Cards Found
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheme Distribution Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Category Breakdown:
                </span>
                {Object.entries(schemeSummary).map(([scheme, count]) => (
                  <span
                    key={scheme}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-1.5"
                  >
                    <span className="font-semibold text-emerald-400">{count}</span>
                    <span className="text-slate-400">{scheme}</span>
                  </span>
                ))}
              </div>

              {/* Action Buttons to Supply to Scraper Engine */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-300 whitespace-nowrap">
                    Batch Size to Feed:
                  </label>
                  <select
                    value={limitCount}
                    onChange={(e) => setLimitCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">All {rcList.length} Cards</option>
                    {rcList.length > 50 && <option value={50}>First 50 Cards</option>}
                    {rcList.length > 100 && <option value={100}>First 100 Cards</option>}
                    {rcList.length > 200 && <option value={200}>First 200 Cards</option>}
                  </select>
                  <span className="text-[11px] text-slate-400">
                    (Target: Cloud SQL PostgreSQL RDBMS)
                  </span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Button 1: Load to Queue without auto-starting */}
                  <button
                    onClick={() => handleSupplyToScraper(false)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 border border-slate-700 transition shadow-sm hover:text-white"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Load {limitCount === 'all' ? rcList.length : limitCount} to Browser Queue</span>
                  </button>

                  {/* Button 2: Load to Queue & Immediately Start Browser Scraper Engine */}
                  <button
                    onClick={() => handleSupplyToScraper(true)}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 font-medium text-xs flex items-center gap-1.5 border border-emerald-500/30 transition shadow-sm hover:text-emerald-200"
                  >
                    <Play className="w-3.5 h-3.5 fill-emerald-400" />
                    <span>Scrape in Browser</span>
                  </button>

                  {/* Button 3: Autonomous Server Background Queue (Runs on Server) */}
                  <button
                    onClick={handleStartServerBackgroundQueue}
                    disabled={isStartingServerQueue}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-950 transition border border-indigo-400/30"
                    title="Processes cards in server background independent of the browser"
                  >
                    <Server className="w-3.5 h-3.5 text-indigo-200" />
                    <span>{isStartingServerQueue ? 'Enqueuing on Server...' : 'Run Autonomous Server Worker'}</span>
                  </button>
                </div>
              </div>

              {/* Server Background Queue Notification Banner */}
              {serverQueueStartedNotice && (
                <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-xl p-3 text-xs text-indigo-200 flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-400 flex-shrink-0 animate-pulse" />
                    <span>{serverQueueStartedNotice}</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-mono">
                    Cloud SQL Live Sync
                  </span>
                </div>
              )}

              {/* Quick Preview Chips of Ration Cards */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Preview of RC Numbers in this FPS (First 24 shown):</span>
                  <span className="font-mono text-emerald-400">100% Genuine CG State Numbers</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {rcList.slice(0, 24).map((rc, i) => (
                    <div
                      key={rc.rcNo + i}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 flex items-center justify-between shadow-sm"
                      title={`Scheme: ${rc.scheme || 'N/A'}`}
                    >
                      <span className="text-emerald-400">{rc.rcNo}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">{rc.scheme || 'RC'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No Ration Cards recorded for this shop in the current active allotment cycle.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
