import { extractRationCardDetails } from './scraperEngine.ts';
import { getDb } from '../db/index.ts';
import { cgFpsRcNumbers } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface BackgroundQueueItem {
  id: string;
  rcNo: string;
  fpsId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  durationMs?: number;
  completedAt?: string;
}

export interface BackgroundQueueLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface BackgroundQueueState {
  isRunning: boolean;
  isPaused: boolean;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  concurrency: number;
  delayMs: number;
  activeWorkers: number;
  startedAt: string | null;
  finishedAt: string | null;
  items: BackgroundQueueItem[];
  logs: BackgroundQueueLog[];
}

let queueState: BackgroundQueueState = {
  isRunning: false,
  isPaused: false,
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  concurrency: 2,
  delayMs: 600,
  activeWorkers: 0,
  startedAt: null,
  finishedAt: null,
  items: [],
  logs: []
};

function addLog(level: 'info' | 'success' | 'warning' | 'error', message: string) {
  const timestamp = new Date().toLocaleTimeString();
  queueState.logs.push({ timestamp, level, message });
  if (queueState.logs.length > 500) {
    queueState.logs = queueState.logs.slice(-500);
  }
}

export function getBackgroundQueueStatus(): BackgroundQueueState {
  return {
    ...queueState,
    // Return items without overloading JSON payload
    items: queueState.items.slice(0, 200)
  };
}

export function pauseBackgroundQueue(): { success: boolean; message: string } {
  if (!queueState.isRunning) {
    return { success: false, message: 'Queue is not running.' };
  }
  queueState.isPaused = true;
  addLog('warning', 'Autonomous background worker paused.');
  return { success: true, message: 'Queue paused.' };
}

export function resumeBackgroundQueue(): { success: boolean; message: string } {
  if (!queueState.isRunning) {
    return { success: false, message: 'Queue is not running.' };
  }
  queueState.isPaused = false;
  addLog('info', 'Autonomous background worker resumed.');
  processNext();
  return { success: true, message: 'Queue resumed.' };
}

export function stopBackgroundQueue(): { success: boolean; message: string } {
  queueState.isRunning = false;
  queueState.isPaused = false;
  queueState.activeWorkers = 0;
  queueState.finishedAt = new Date().toISOString();
  addLog('warning', 'Autonomous background worker stopped by user.');
  return { success: true, message: 'Queue stopped.' };
}

export async function startBackgroundQueue(options: {
  items?: { rcNo: string; fpsId: string }[];
  fpsId?: string;
  concurrency?: number;
  delayMs?: number;
}): Promise<{ success: boolean; message: string; total: number }> {
  if (queueState.isRunning && !queueState.isPaused) {
    return { success: false, message: 'Queue is already actively running.', total: queueState.total };
  }

  let rawItems: { rcNo: string; fpsId: string }[] = options.items || [];

  // If no items directly provided, load from RDBMS cg_fps_rc_numbers for the fpsId
  if (rawItems.length === 0 && options.fpsId) {
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(cgFpsRcNumbers)
          .where(and(eq(cgFpsRcNumbers.fpsId, options.fpsId), eq(cgFpsRcNumbers.status, 'pending')));
        rawItems = rows.map(r => ({ rcNo: r.rcNo, fpsId: r.fpsId }));
      } catch (err: any) {
        console.error('Failed to load pending cards from RDBMS:', err);
      }
    }
  }

  if (rawItems.length === 0) {
    return { success: false, message: 'No ration cards provided to process.', total: 0 };
  }

  const newItems: BackgroundQueueItem[] = rawItems.map((item, index) => ({
    id: `bg-${item.rcNo}-${index}`,
    rcNo: item.rcNo,
    fpsId: item.fpsId,
    status: 'queued'
  }));

  const concurrency = Math.max(1, Math.min(5, options.concurrency || 2));
  const delayMs = Math.max(200, options.delayMs || 600);

  queueState = {
    isRunning: true,
    isPaused: false,
    total: newItems.length,
    processed: 0,
    successful: 0,
    failed: 0,
    concurrency,
    delayMs,
    activeWorkers: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    items: newItems,
    logs: [
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        message: `Autonomous server queue initialized with ${newItems.length} ration cards (Workers: ${concurrency}, Delay: ${delayMs}ms).`
      }
    ]
  };

  // Launch initial concurrent workers
  for (let w = 0; w < concurrency; w++) {
    runWorker(w + 1);
  }

  return { success: true, message: `Started background queue with ${newItems.length} items.`, total: newItems.length };
}

async function runWorker(workerId: number) {
  if (!queueState.isRunning || queueState.isPaused) return;

  const nextItem = queueState.items.find(i => i.status === 'queued');
  if (!nextItem) {
    // Check if any other workers are still processing
    const stillActive = queueState.items.some(i => i.status === 'processing');
    if (!stillActive && queueState.isRunning) {
      queueState.isRunning = false;
      queueState.finishedAt = new Date().toISOString();
      addLog('success', `Autonomous server queue completed! Processed ${queueState.processed}/${queueState.total} (Success: ${queueState.successful}, Failed: ${queueState.failed}). Saved to PostgreSQL.`);
    }
    return;
  }

  nextItem.status = 'processing';
  queueState.activeWorkers += 1;
  const startTime = Date.now();

  try {
    const result = await extractRationCardDetails(nextItem.rcNo, nextItem.fpsId, true);
    const duration = Date.now() - startTime;

    if (result.httpStatus === 200 && result.data && result.data.status === 'success') {
      nextItem.status = 'completed';
      nextItem.durationMs = duration;
      nextItem.completedAt = new Date().toISOString();
      queueState.successful += 1;

      addLog('success', `[W${workerId}] Card ${nextItem.rcNo} (${result.data.headName}, ${result.data.totalMembers || 0} members) saved to RDBMS [${duration}ms]`);

      // Update RDBMS status if present in cgFpsRcNumbers
      try {
        const db = getDb();
        if (db) {
          await db
            .update(cgFpsRcNumbers)
            .set({ status: 'scraped', headName: result.data.headName })
            .where(eq(cgFpsRcNumbers.rcNo, nextItem.rcNo));
        }
      } catch {
        // Non-critical
      }
    } else {
      nextItem.status = 'failed';
      nextItem.error = result.data?.error || 'Extraction error';
      queueState.failed += 1;
      addLog('error', `[W${workerId}] Card ${nextItem.rcNo} extraction error: ${nextItem.error}`);
    }
  } catch (err: any) {
    nextItem.status = 'failed';
    nextItem.error = err.message;
    queueState.failed += 1;
    addLog('error', `[W${workerId}] Card ${nextItem.rcNo} failed: ${err.message}`);
  } finally {
    queueState.processed += 1;
    queueState.activeWorkers = Math.max(0, queueState.activeWorkers - 1);

    if (queueState.isRunning && !queueState.isPaused) {
      setTimeout(() => {
        runWorker(workerId);
      }, queueState.delayMs);
    }
  }
}

function processNext() {
  const idleWorkers = queueState.concurrency - queueState.activeWorkers;
  for (let i = 0; i < idleWorkers; i++) {
    runWorker(i + 1);
  }
}
