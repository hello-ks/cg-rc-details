import dns from 'node:dns';
try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {}

import {
  DistrictItem,
  BlockItem,
  FpsItem,
  RcNumberItem,
  saveDistrictsToDb,
  getDistrictsFromDb,
  saveBlocksToDb,
  getBlocksFromDb,
  saveFpsToDb,
  getFpsFromDb,
  saveRcNumbersToDb,
  getRcNumbersFromDb
} from '../db/eposHierarchy.ts';

const EPOS_BASE = 'https://epos.cg.gov.in';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://epos.cg.gov.in/KeyRegCards_Interface'
};

// Parse HTML <option> tags with deduplication
function parseOptions(html: string): { code: string; name: string }[] {
  const list: { code: string; name: string }[] = [];
  const seen = new Set<string>();
  const regex = /<option\s+value=[\x27"]([^\x27"]*)[\x27"][^>]*>([^<]+)<\/option>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const code = match[1].trim();
    const name = match[2].trim();
    if (code && !code.toLowerCase().includes('select') && !name.toLowerCase().includes('select') && !seen.has(code)) {
      seen.add(code);
      list.push({ code, name });
    }
  }
  return list;
}

// Resilient fetch helper with retry and timeout
async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retries = 2,
  delayMs = 400
): Promise<Response> {
  const timeoutMs = options.timeoutMs || 10000;
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...DEFAULT_HEADERS,
          ...options.headers
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return res;
      }

      if (attempt < retries && (res.status >= 500 || res.status === 429)) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

// 33 Canonical Official Districts of Chhattisgarh State
export const CHHATTISGARH_DISTRICTS: DistrictItem[] = [
  { distCode: '646', distName: 'BALOD' },
  { distCode: '644', distName: 'BALODABAZAR' },
  { distCode: '649', distName: 'BALRAMPUR' },
  { distCode: '374', distName: 'BASTAR' },
  { distCode: '650', distName: 'BEMETARA' },
  { distCode: '636', distName: 'BIJAPUR' },
  { distCode: '375', distName: 'BILASPUR' },
  { distCode: '376', distName: 'DANTEWADA' },
  { distCode: '377', distName: 'DHAMTARI' },
  { distCode: '378', distName: 'DURG' },
  { distCode: '645', distName: 'GARIYABAND' },
  { distCode: '734', distName: 'GAURELA-PENDRA-MARWAHI' },
  { distCode: '379', distName: 'JANJGIR' },
  { distCode: '380', distName: 'JASHPUR' },
  { distCode: '381', distName: 'KANKER' },
  { distCode: '382', distName: 'KAWARDHA' },
  { distCode: '759', distName: 'KHAIRGARH CHHUIKHADAN GANDAI' },
  { distCode: '643', distName: 'KONDAGAON' },
  { distCode: '383', distName: 'KORBA' },
  { distCode: '384', distName: 'KORIA' },
  { distCode: '385', distName: 'MAHASAMUND' },
  { distCode: '760', distName: 'MANENDRAGARH CHIRIMIRI BHARATPUR' },
  { distCode: '761', distName: 'MOHLA MANPUR AMBAGARHCHOUKI' },
  { distCode: '647', distName: 'MUNGELI' },
  { distCode: '637', distName: 'NARAYANPUR' },
  { distCode: '386', distName: 'RAIGARH' },
  { distCode: '387', distName: 'RAIPUR' },
  { distCode: '388', distName: 'RAJNANDGAON' },
  { distCode: '762', distName: 'SAKTI' },
  { distCode: '763', distName: 'SARANGARH BILAIGARH' },
  { distCode: '389', distName: 'SARGUJA' },
  { distCode: '642', distName: 'SUKMA' },
  { distCode: '648', distName: 'SURAJPUR' }
];

// -------------------------------------------------------------
// 1. GET DISTRICTS
// -------------------------------------------------------------
export async function getEposDistricts(forceRefresh: boolean = false): Promise<DistrictItem[]> {
  // 1. If not forcing refresh, serve from Cloud SQL PostgreSQL cache for zero-latency, error-free loading
  if (!forceRefresh) {
    try {
      const fromDb = await getDistrictsFromDb();
      if (fromDb.length >= 25) {
        return fromDb;
      }
    } catch {
      // Continue to live fetch if db read encounters error
    }
  }

  // 2. Fetch live from EPOS portal with retry
  try {
    const res = await fetchWithRetry(`${EPOS_BASE}/Epos_Spring/Common/getDistricts`, {
      headers: DEFAULT_HEADERS,
      timeoutMs: 8000
    }, 2, 400);

    if (res.ok) {
      const html = await res.text();
      const parsed = parseOptions(html);
      if (parsed.length > 0) {
        const districts: DistrictItem[] = parsed.map(d => ({
          distCode: d.code,
          distName: d.name
        }));
        // Cache to PostgreSQL RDBMS in background
        saveDistrictsToDb(districts).catch(() => {});
        return districts;
      }
    }
  } catch (err: any) {
    console.info(`[Epos Service] Live district fetch unavailable (${err?.message || 'deferred'}), serving from database cache.`);
  }

  // 3. Fallback to database
  try {
    const fromDb = await getDistrictsFromDb();
    if (fromDb.length > 0) return fromDb;
  } catch {
    // Proceed to static canonical list
  }

  // 4. Guaranteed fallback defaults
  return CHHATTISGARH_DISTRICTS;
}

// -------------------------------------------------------------
// 2. GET BLOCKS / AFSO
// -------------------------------------------------------------
export async function getEposBlocks(distCode: string, forceRefresh: boolean = false): Promise<BlockItem[]> {
  // 1. Check DB first if not forcing refresh
  if (!forceRefresh) {
    try {
      const fromDb = await getBlocksFromDb(distCode);
      if (fromDb.length > 0) {
        return fromDb;
      }
    } catch {
      // Continue to live fetch
    }
  }

  // 2. Fetch live from EPOS portal with retry
  try {
    const res = await fetchWithRetry(`${EPOS_BASE}/Epos_Spring/Common/getAfso?dist_code=${distCode}`, {
      headers: DEFAULT_HEADERS,
      timeoutMs: 10000
    }, 2, 400);

    if (res.ok) {
      const html = await res.text();
      const parsed = parseOptions(html);
      if (parsed.length > 0) {
        const blocks: BlockItem[] = parsed.map(b => ({
          blockCode: b.code,
          blockName: b.name,
          distCode
        }));
        // Cache to PostgreSQL RDBMS in background
        saveBlocksToDb(distCode, blocks).catch(() => {});
        return blocks;
      }
    }
  } catch (err: any) {
    console.info(`[Epos Service] Live blocks fetch for ${distCode} unavailable (${err?.message || 'deferred'}), serving from database cache.`);
  }

  // 3. Fallback to database
  return await getBlocksFromDb(distCode);
}

// -------------------------------------------------------------
// 3. GET FAIR PRICE SHOPS (FPS)
// -------------------------------------------------------------
export async function getEposFps(distCode: string, blockCode: string, forceRefresh: boolean = false): Promise<FpsItem[]> {
  // 1. Check DB first if not forcing refresh
  if (!forceRefresh) {
    try {
      const fromDb = await getFpsFromDb(distCode, blockCode);
      if (fromDb.length > 0) {
        return fromDb;
      }
    } catch {
      // Continue to live fetch
    }
  }

  // 2. Fetch live from EPOS portal
  try {
    const res = await fetchWithRetry(`${EPOS_BASE}/Epos_Spring/Common/getFPSs?dist_code=${distCode}&afso_code=${blockCode}`, {
      headers: DEFAULT_HEADERS,
      timeoutMs: 12000
    }, 2, 500);

    if (res.ok) {
      const html = await res.text();
      const parsed = parseOptions(html);
      if (parsed.length > 0) {
        const fpsList: FpsItem[] = parsed.map(f => {
          let name = f.name;
          const m = f.name.match(/\((.*?)\)/);
          if (m && m[1]) {
            name = m[1].trim();
          }
          return {
            fpsId: f.code,
            fpsName: name,
            distCode,
            blockCode,
            totalCards: 0
          };
        });

        // Cache to PostgreSQL RDBMS in background
        saveFpsToDb(distCode, blockCode, fpsList).catch(() => {});
        return fpsList;
      }
    }
  } catch (err: any) {
    console.info(`[Epos Service] Live FPS fetch for dist ${distCode}, block ${blockCode} deferred (${err?.message || 'offline'}), serving from database cache.`);
  }

  // Fallback to database
  return await getFpsFromDb(distCode, blockCode);
}

// -------------------------------------------------------------
// 4. GET RC LIST FOR FPS
// -------------------------------------------------------------
export async function getEposRcList(
  distCode: string,
  blockCode: string,
  fpsId: string,
  month: number = 9,
  year: number = 2026,
  forceRefresh: boolean = false
): Promise<RcNumberItem[]> {
  // 1. Check DB first if not forcing refresh
  if (!forceRefresh) {
    try {
      const fromDb = await getRcNumbersFromDb(fpsId);
      if (fromDb.length > 0) {
        return fromDb;
      }
    } catch {
      // Continue to live fetch
    }
  }

  // 2. Fetch live from EPOS
  try {
    // Check active month/year first
    try {
      const actRes = await fetchWithRetry(`${EPOS_BASE}/Epos_Spring/api/fps/activeMonthYear`, {
        headers: DEFAULT_HEADERS,
        timeoutMs: 4000
      }, 1, 300);
      if (actRes.ok) {
        const actData = await actRes.json();
        if (actData.month && actData.year) {
          month = Number(actData.month);
          year = Number(actData.year);
        }
      }
    } catch {
      // Keep defaults
    }

    const payload = {
      month: String(month),
      year: String(year),
      dist_code: String(distCode),
      afso_code: String(blockCode),
      fps_id: String(fpsId)
    };

    const res = await fetchWithRetry(`${EPOS_BASE}/Epos_Spring/KeyRegister/getfpsKeyRegisterCardsList`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
        'Origin': EPOS_BASE
      },
      body: JSON.stringify(payload),
      timeoutMs: 25000
    }, 1, 600);

    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        const rcItems: RcNumberItem[] = json.data
          .filter((item: any) => item.rc_id && String(item.rc_id).trim())
          .map((item: any) => ({
            rcNo: String(item.rc_id).trim(),
            fpsId: String(fpsId),
            distCode: String(distCode),
            blockCode: String(blockCode),
            scheme: item.scheme_name_en || item.scheme_name || undefined,
            headName: item.family_head || undefined,
            status: 'pending'
          }));

        // Cache all RC numbers into PostgreSQL RDBMS in background
        saveRcNumbersToDb(fpsId, distCode, blockCode, rcItems).catch(() => {});
        return rcItems;
      }
    }
  } catch (err: any) {
    console.info(`[Epos Service] Live RC list fetch for FPS ${fpsId} deferred (${err?.message || 'offline'}), checking database.`);
  }

  // Fallback to database
  return await getRcNumbersFromDb(fpsId);
}

// -------------------------------------------------------------
// 5. AUTOMATED HIERARCHY CRAWLER (All 33 Districts -> All Blocks)
// -------------------------------------------------------------
export interface HierarchyCrawlStatus {
  isRunning: boolean;
  totalDistricts: number;
  completedDistricts: number;
  totalBlocksFound: number;
  completedBlocks: number;
  totalFpsFound: number;
  currentDistrictName: string;
  currentBlockName: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  logs: string[];
}

let hierarchyCrawlState: HierarchyCrawlStatus = {
  isRunning: false,
  totalDistricts: 0,
  completedDistricts: 0,
  totalBlocksFound: 0,
  completedBlocks: 0,
  totalFpsFound: 0,
  currentDistrictName: '',
  currentBlockName: '',
  startedAt: null,
  finishedAt: null,
  error: null,
  logs: []
};

export function getHierarchyCrawlStatus(): HierarchyCrawlStatus {
  return hierarchyCrawlState;
}

export async function startHierarchyCrawl(): Promise<{ success: boolean; message: string }> {
  if (hierarchyCrawlState.isRunning) {
    return { success: false, message: 'Hierarchy and FPS crawl is already running in background.' };
  }

  // Start background task
  (async () => {
    try {
      hierarchyCrawlState = {
        isRunning: true,
        totalDistricts: 0,
        completedDistricts: 0,
        totalBlocksFound: 0,
        completedBlocks: 0,
        totalFpsFound: 0,
        currentDistrictName: 'Initiating crawler...',
        currentBlockName: '',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        logs: [`[${new Date().toLocaleTimeString()}] Starting Automated Chhattisgarh State Hierarchy & FPS Crawler.`]
      };

      const districts = await getEposDistricts(true);
      hierarchyCrawlState.totalDistricts = districts.length;
      hierarchyCrawlState.logs.push(`[${new Date().toLocaleTimeString()}] Found ${districts.length} districts in Chhattisgarh. Beginning Block & FPS synchronization...`);

      for (let i = 0; i < districts.length; i++) {
        if (!hierarchyCrawlState.isRunning) {
          hierarchyCrawlState.logs.push(`[${new Date().toLocaleTimeString()}] Crawler paused or stopped by user.`);
          break;
        }

        const d = districts[i];
        hierarchyCrawlState.currentDistrictName = `${d.distName} (${i + 1}/${districts.length})`;
        
        try {
          // 1. Fetch & save all blocks for this district
          const blocks = await getEposBlocks(d.distCode, true);
          hierarchyCrawlState.totalBlocksFound += blocks.length;
          hierarchyCrawlState.completedDistricts = i + 1;
          
          hierarchyCrawlState.logs.push(
            `[${new Date().toLocaleTimeString()}] District ${d.distName} (${d.distCode}): Saved ${blocks.length} blocks. Syncing FPS shops...`
          );
          if (hierarchyCrawlState.logs.length > 80) hierarchyCrawlState.logs.shift();

          // 2. Fetch & save FPS for each block in this district
          for (let j = 0; j < blocks.length; j++) {
            if (!hierarchyCrawlState.isRunning) break;

            const b = blocks[j];
            hierarchyCrawlState.currentBlockName = `${b.blockName} (${j + 1}/${blocks.length})`;

            try {
              const fpsList = await getEposFps(d.distCode, b.blockCode, true);
              hierarchyCrawlState.totalFpsFound += fpsList.length;
              hierarchyCrawlState.completedBlocks += 1;

              hierarchyCrawlState.logs.push(
                `[${new Date().toLocaleTimeString()}] [${d.distName}] ${b.blockName}: Synced ${fpsList.length} FPS shops to Cloud SQL.`
              );
              if (hierarchyCrawlState.logs.length > 80) hierarchyCrawlState.logs.shift();
            } catch (fpsErr: any) {
              hierarchyCrawlState.completedBlocks += 1;
              hierarchyCrawlState.logs.push(
                `[${new Date().toLocaleTimeString()}] [${d.distName}] Warning syncing FPS for ${b.blockName}: ${fpsErr.message}`
              );
              if (hierarchyCrawlState.logs.length > 80) hierarchyCrawlState.logs.shift();
            }

            // Polite delay between block FPS requests
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } catch (err: any) {
          hierarchyCrawlState.logs.push(
            `[${new Date().toLocaleTimeString()}] Warning syncing district ${d.distName}: ${err.message}`
          );
          if (hierarchyCrawlState.logs.length > 80) hierarchyCrawlState.logs.shift();
        }

        // Delay between districts
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      hierarchyCrawlState.isRunning = false;
      hierarchyCrawlState.finishedAt = new Date().toISOString();
      hierarchyCrawlState.currentDistrictName = 'Completed';
      hierarchyCrawlState.currentBlockName = 'All FPS Synchronized';
      hierarchyCrawlState.logs.push(
        `[${new Date().toLocaleTimeString()}] Completed! Successfully synced ${hierarchyCrawlState.completedDistricts} districts, ${hierarchyCrawlState.totalBlocksFound} blocks, and ${hierarchyCrawlState.totalFpsFound} Fair Price Shops into Cloud SQL RDBMS.`
      );
      if (hierarchyCrawlState.logs.length > 80) hierarchyCrawlState.logs.shift();
    } catch (err: any) {
      hierarchyCrawlState.isRunning = false;
      hierarchyCrawlState.error = err.message;
      hierarchyCrawlState.finishedAt = new Date().toISOString();
      hierarchyCrawlState.logs.push(`[${new Date().toLocaleTimeString()}] Fatal error during crawl: ${err.message}`);
    }
  })();

  return { success: true, message: 'Automated hierarchy & FPS crawler started in server background.' };
}

export function stopHierarchyCrawl(): { success: boolean; message: string } {
  if (!hierarchyCrawlState.isRunning) {
    return { success: false, message: 'Crawler is not running.' };
  }
  hierarchyCrawlState.isRunning = false;
  hierarchyCrawlState.currentDistrictName = 'Stopped by user';
  hierarchyCrawlState.currentBlockName = '';
  hierarchyCrawlState.logs.push(`[${new Date().toLocaleTimeString()}] Crawler stopped by user.`);
  return { success: true, message: 'Crawler stopped successfully.' };
}
