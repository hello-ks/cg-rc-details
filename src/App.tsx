import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { ProgressBar } from './components/ProgressBar';
import { StatsOverview } from './components/StatsOverview';
import { ResultsTable } from './components/ResultsTable';
import { LogViewer } from './components/LogViewer';
import { CardDetailModal } from './components/CardDetailModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { DatabaseModal } from './components/DatabaseModal';
import { ServerBackgroundQueueWidget } from './components/ServerBackgroundQueueWidget';
import { LoginGate } from './components/LoginGate';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './utils/api';
import { ATTACHED_RATION_CARDS } from './data/attachedList';
import { BatchJobItem, BatchJobConfig, BatchProgress, LogEntry, ExtractedRationCardDetails } from './types';

function Dashboard() {
  const [queue, setQueue] = useState<BatchJobItem[]>([]);
  const [config, setConfig] = useState<BatchJobConfig>({
    concurrency: 2,
    delayMs: 500,
    maxRetries: 2,
    allowFallback: true
  });

  const [progress, setProgress] = useState<BatchProgress>({
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    status: 'idle',
    currentSpeed: 0
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCard, setSelectedCard] = useState<ExtractedRationCardDetails | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  // Refs for queue processing control
  const statusRef = useRef<'idle' | 'running' | 'paused' | 'completed' | 'cancelled'>('idle');
  const queueRef = useRef<BatchJobItem[]>([]);
  const configRef = useRef<BatchJobConfig>(config);
  const startTimeRef = useRef<number | null>(null);
  const completedCountRef = useRef<number>(0);

  useEffect(() => {
    statusRef.current = progress.status;
  }, [progress.status]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Check Backend Health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await apiFetch('/api/health');
        if (res.ok) {
          setIsBackendConnected(true);
        }
      } catch {
        setIsBackendConnected(false);
      }
    };
    checkHealth();
  }, []);

  // Pre-load initial attached list on first visit for convenience
  useEffect(() => {
    const initialItems: BatchJobItem[] = ATTACHED_RATION_CARDS.map(item => ({
      id: `job-${item.rcNo}-${Math.random().toString(36).substring(2, 7)}`,
      rcNo: item.rcNo,
      fpsId: item.fpsId,
      status: 'pending',
      attempts: 0
    }));

    setQueue(initialItems);
    setProgress({
      total: initialItems.length,
      completed: 0,
      successful: 0,
      failed: 0,
      status: 'idle',
      currentSpeed: 0
    });

    addLog('info', `Pre-loaded attached dataset with ${initialItems.length} Chhattisgarh ration card numbers (FPS ID: 412001080).`);
  }, []);

  const addLog = (level: 'info' | 'success' | 'warn' | 'error', message: string, rcNo?: string) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      rcNo
    };
    setLogs(prev => [...prev.slice(-300), newLog]); // Keep last 300 logs
  };

  const handleLoadItems = (items: { rcNo: string; fpsId: string }[], autoStart: boolean = false) => {
    const newJobs: BatchJobItem[] = items.map(item => ({
      id: `job-${item.rcNo}-${Math.random().toString(36).substring(2, 7)}`,
      rcNo: item.rcNo,
      fpsId: item.fpsId || '412001080',
      status: 'pending',
      attempts: 0
    }));

    setQueue(newJobs);
    completedCountRef.current = 0;
    startTimeRef.current = null;

    setProgress({
      total: newJobs.length,
      completed: 0,
      successful: 0,
      failed: 0,
      status: 'idle',
      currentSpeed: 0
    });

    addLog('info', `Loaded ${newJobs.length} ration cards into extraction queue.`);

    if (autoStart && newJobs.length > 0) {
      setTimeout(() => {
        startExtractionBatch();
      }, 100);
    }
  };

  const handleUpdateConfig = (newConfig: Partial<BatchJobConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      addLog('info', `Updated settings: Concurrency=${updated.concurrency}, Delay=${updated.delayMs}ms, MaxRetries=${updated.maxRetries}, Fallback=${updated.allowFallback ? 'On' : 'Off'}`);
      return updated;
    });
  };

  // Main Extraction Runner Loop
  const startExtractionBatch = async () => {
    if (progress.status === 'running') return;

    statusRef.current = 'running';
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    setProgress(prev => ({ ...prev, status: 'running' }));
    addLog('info', `Started batch extraction for target https://fcs.cg.gov.in/rcmodule/RptRationCardSearch.aspx...`);

    // Worker pool loop
    const activeWorkers: Promise<void>[] = [];
    const concurrency = configRef.current.concurrency;

    for (let i = 0; i < concurrency; i++) {
      activeWorkers.push(runWorker(i + 1));
    }

    await Promise.all(activeWorkers);

    // Batch completed check
    if (statusRef.current === 'running') {
      const finalQueue = queueRef.current;
      const succ = finalQueue.filter(q => q.status === 'success').length;
      const fail = finalQueue.filter(q => q.status === 'failed').length;

      setProgress(prev => ({
        ...prev,
        status: 'completed',
        currentSpeed: 0
      }));

      addLog('success', `Batch extraction finished. Total: ${finalQueue.length}, Successful: ${succ}, Failed: ${fail}.`);
    }
  };

  const runWorker = async (workerId: number) => {
    while (statusRef.current === 'running') {
      // Find next pending or retrying item
      const currentQueue = queueRef.current;
      const targetItem = currentQueue.find(
        item => item.status === 'pending' || (item.status === 'retrying' && item.attempts < configRef.current.maxRetries)
      );

      if (!targetItem) {
        // No more work left
        break;
      }

      // Mark item as processing
      const jobId = targetItem.id;
      const rcNo = targetItem.rcNo;
      const fpsId = targetItem.fpsId || '412001080';

      setQueue(prev =>
        prev.map(item => (item.id === jobId ? { ...item, status: 'processing', attempts: item.attempts + 1 } : item))
      );

      addLog('info', `Worker #${workerId} requesting details for Ration Card`, rcNo);

      try {
        const response = await apiFetch('/api/extract-ration-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rcNo,
            fpsId,
            allowFallback: configRef.current.allowFallback
          })
        });

        if (response.ok) {
          const data: ExtractedRationCardDetails = await response.json();
          setQueue(prev =>
            prev.map(item =>
              item.id === jobId
                ? {
                    ...item,
                    status: 'success',
                    result: data,
                    durationMs: data.extractedAt ? 150 : 300
                  }
                : item
            )
          );

          completedCountRef.current += 1;
          const msg = `Extracted Head: "${data.headName}" (${data.cardType}), Members: ${data.totalMembers}, District: ${data.district} [Source: ${data.source}]`;
          addLog('success', msg, rcNo);
        } else {
          const errData = await response.json().catch(() => ({ error: 'HTTP error ' + response.status }));
          const errMsg = errData.error || `HTTP ${response.status} failed`;

          setQueue(prev =>
            prev.map(item => {
              if (item.id === jobId) {
                const nextAttempts = item.attempts;
                const canRetry = nextAttempts < configRef.current.maxRetries;
                return {
                  ...item,
                  status: canRetry ? 'retrying' : 'failed',
                  error: errMsg
                };
              }
              return item;
            })
          );

          addLog('error', `Extraction error: ${errMsg}`, rcNo);
        }
      } catch (err: any) {
        setQueue(prev =>
          prev.map(item => {
            if (item.id === jobId) {
              const canRetry = item.attempts < configRef.current.maxRetries;
              return {
                ...item,
                status: canRetry ? 'retrying' : 'failed',
                error: err.message || 'Network request failed'
              };
            }
            return item;
          })
        );
        addLog('error', `Connection error: ${err.message || 'Fetch failed'}`, rcNo);
      }

      // Update progress stats & speed
      updateProgressStats();

      // Delay between requests
      if (configRef.current.delayMs > 0 && statusRef.current === 'running') {
        await new Promise(resolve => setTimeout(resolve, configRef.current.delayMs));
      }
    }
  };

  const updateProgressStats = () => {
    const q = queueRef.current;
    const total = q.length;
    const completed = q.filter(i => i.status === 'success' || i.status === 'failed').length;
    const successful = q.filter(i => i.status === 'success').length;
    const failed = q.filter(i => i.status === 'failed').length;

    let speed = 0;
    if (startTimeRef.current && completed > 0) {
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      if (elapsedSec > 0) {
        speed = completed / elapsedSec;
      }
    }

    setProgress(prev => ({
      ...prev,
      total,
      completed,
      successful,
      failed,
      currentSpeed: speed
    }));
  };

  const handlePause = () => {
    statusRef.current = 'paused';
    setProgress(prev => ({ ...prev, status: 'paused', currentSpeed: 0 }));
    addLog('warn', 'Batch extraction paused by user.');
  };

  const handleStop = () => {
    statusRef.current = 'cancelled';
    setProgress(prev => ({ ...prev, status: 'cancelled', currentSpeed: 0 }));
    addLog('warn', 'Batch extraction stopped by user.');
  };

  const handleReset = () => {
    statusRef.current = 'idle';
    setQueue([]);
    setProgress({
      total: 0,
      completed: 0,
      successful: 0,
      failed: 0,
      status: 'idle',
      currentSpeed: 0
    });
    addLog('info', 'Queue reset.');
  };

  const handleRetryFailed = () => {
    setQueue(prev =>
      prev.map(item =>
        item.status === 'failed' ? { ...item, status: 'pending', attempts: 0, error: undefined } : item
      )
    );
    addLog('info', 'Reset failed ration cards back to pending status.');
    setTimeout(() => {
      startExtractionBatch();
    }, 100);
  };

  const handleRetrySingle = (rcNo: string, fpsId = '412001080') => {
    setQueue(prev =>
      prev.map(item =>
        item.rcNo === rcNo ? { ...item, status: 'pending', attempts: 0, error: undefined } : item
      )
    );
    addLog('info', `Queued single re-scrape for card ${rcNo}`);
    if (statusRef.current !== 'running') {
      setTimeout(() => startExtractionBatch(), 100);
    }
  };

  const handleRemoveItem = (id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
    updateProgressStats();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-16">
      {/* Header */}
      <Header
        totalItems={progress.total}
        completedItems={progress.completed}
        isBackendConnected={isBackendConnected}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Input & Source Selector */}
        <InputSection
          onLoadItems={handleLoadItems}
          config={config}
          onUpdateConfig={handleUpdateConfig}
          isProcessing={progress.status === 'running'}
          currentQueueCount={queue.length}
        />

        {/* Autonomous Server Background Queue Live Widget (Visible when active or jobs enqueued) */}
        <ServerBackgroundQueueWidget />

        {/* Analytical Stats Bar */}
        <StatsOverview items={queue} />

        {/* Progress Bar & Batch Controls */}
        <ProgressBar
          progress={progress}
          onStart={startExtractionBatch}
          onPause={handlePause}
          onStop={handleStop}
          onReset={handleReset}
          onRetryFailed={handleRetryFailed}
        />

        {/* Results Table & Export Controls */}
        <ResultsTable
          items={queue}
          onViewDetails={(card) => setSelectedCard(card)}
          onRetrySingle={handleRetrySingle}
          onRemoveItem={handleRemoveItem}
          onClearAll={handleReset}
        />

        {/* Terminal Audit Log Viewer */}
        <LogViewer logs={logs} onClearLogs={() => setLogs([])} />
      </main>

      {/* Member Inspection Modal */}
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />

      {/* Remote API Keys & Documentation Modal */}
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />

      {/* Cloud SQL PostgreSQL Database Inspector Modal */}
      <DatabaseModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        onViewDetails={(card) => setSelectedCard(card)}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Verifying credentials & session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginGate />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

