import dns from 'node:dns';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { isDbConfigured } from './src/db/index.ts';
import { saveExtractedCardToDb, getAllCardsFromDb, getCardByRcNoFromDb, deleteCardFromDb } from './src/db/cards.ts';
import { getAllApiKeysFromDb, createApiKeyInDb, deleteApiKeyFromDb, validateAndRecordApiKeyInDb } from './src/db/keys.ts';
import {
  getEposDistricts,
  getEposBlocks,
  getEposFps,
  getEposRcList,
  startHierarchyCrawl,
  getHierarchyCrawlStatus,
  stopHierarchyCrawl
} from './src/services/eposService.ts';
import {
  startBackgroundQueue,
  pauseBackgroundQueue,
  resumeBackgroundQueue,
  stopBackgroundQueue,
  getBackgroundQueueStatus
} from './src/services/backgroundQueue.ts';
import { extractRationCardDetails } from './src/services/scraperEngine.ts';
import { getHierarchyStats } from './src/db/eposHierarchy.ts';
import {
  loginUser,
  verifySessionToken,
  logoutUser,
  changeUserPassword,
  getDefaultAdminHint
} from './src/services/authService.ts';

// Enforce IPv4 resolution first to prevent 15-20s IPv6 timeouts on government portals (.gov.in)
dns.setDefaultResultOrder('ipv4first');

// Allow HTTPS government certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory fallback for API Keys
export interface ApiKeyRecord {
  key: string;
  label: string;
  createdAt: string;
  lastUsed: string | null;
  requestCount: number;
}

const memoryApiKeys: ApiKeyRecord[] = [
  {
    key: 'cg_rc_live_key_9f8a7b6c',
    label: 'Default Remote Integration Key',
    createdAt: new Date().toISOString(),
    lastUsed: null,
    requestCount: 0
  }
];

async function validateAndRecordApiKey(req: express.Request): Promise<ApiKeyRecord | null> {
  let rawKey: string | undefined = req.headers['x-api-key'] as string;
  if (!rawKey && req.headers.authorization) {
    const auth = req.headers.authorization;
    if (auth.startsWith('Bearer ') && auth.slice(7).startsWith('cg_rc_')) {
      rawKey = auth.slice(7).trim();
    }
  }
  if (!rawKey && req.query.apiKey) {
    rawKey = String(req.query.apiKey).trim();
  }

  if (!rawKey) return null;

  if (isDbConfigured()) {
    const dbKey = await validateAndRecordApiKeyInDb(rawKey);
    if (dbKey) return dbKey;
  }

  const record = memoryApiKeys.find(k => k.key === rawKey);
  if (record) {
    record.lastUsed = new Date().toISOString();
    record.requestCount += 1;
    return record;
  }
  return null;
}

function extractSessionToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (!token.startsWith('cg_rc_')) {
      return token;
    }
  }
  if (req.headers['x-session-token']) {
    return String(req.headers['x-session-token']).trim();
  }
  if (req.query.sessionToken) {
    return String(req.query.sessionToken).trim();
  }
  return undefined;
}

// Security Middleware: Requires Valid Login Session OR Authorized API Key
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractSessionToken(req);
  if (token) {
    const user = await verifySessionToken(token);
    if (user) {
      (req as any).user = user;
      return next();
    }
  }

  // Also check if valid API key is supplied
  const apiKeyRecord = await validateAndRecordApiKey(req);
  if (apiKeyRecord) {
    (req as any).apiKey = apiKeyRecord;
    return next();
  }

  return res.status(401).json({
    error: 'Access Denied: Secure login required to access Chhattisgarh FCS portal tools.',
    authRequired: true,
    status: 'unauthorized'
  });
}

// -------------------------------------------------------------
// SECURE AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// User Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client');
  const result = await loginUser(username, password, clientIp);

  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Current User Profile Verification
app.get('/api/auth/me', async (req, res) => {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No active session token' });
  }

  const user = await verifySessionToken(token);
  if (user) {
    res.json({ authenticated: true, user });
  } else {
    res.status(401).json({ authenticated: false, error: 'Session expired or invalid' });
  }
});

// User Logout Endpoint
app.post('/api/auth/logout', async (req, res) => {
  const token = extractSessionToken(req);
  await logoutUser(token);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Change Password Endpoint (Protected)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Session required to change password' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current password and new password are required' });
  }

  const result = await changeUserPassword(user.username, currentPassword, newPassword);
  if (result.success) {
    res.json({ success: true, message: 'Password updated successfully.' });
  } else {
    res.status(400).json(result);
  }
});

// Initial Setup & Credentials Hint Endpoint
app.get('/api/auth/hint', (req, res) => {
  const hint = getDefaultAdminHint();
  res.json({
    hasAdmin: true,
    defaultUsername: hint.defaultUsername,
    defaultPassword: hint.defaultPassword
  });
});


// -------------------------------------------------------------
// AUTONOMOUS SERVER-SIDE BACKGROUND QUEUE ENDPOINTS
// -------------------------------------------------------------

// Start or enqueue items into server background worker
app.post('/api/background-queue/start', requireAuth, async (req, res) => {
  try {
    const { items, fpsId, concurrency, delayMs } = req.body;
    const result = await startBackgroundQueue({ items, fpsId, concurrency, delayMs });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pause server background worker
app.post('/api/background-queue/pause', requireAuth, (req, res) => {
  const result = pauseBackgroundQueue();
  res.json(result);
});

// Resume server background worker
app.post('/api/background-queue/resume', requireAuth, (req, res) => {
  const result = resumeBackgroundQueue();
  res.json(result);
});

// Stop server background worker
app.post('/api/background-queue/stop', requireAuth, (req, res) => {
  const result = stopBackgroundQueue();
  res.json(result);
});

// Get real-time status of server background worker
app.get('/api/background-queue/status', requireAuth, (req, res) => {
  const status = getBackgroundQueueStatus();
  res.json(status);
});

// -------------------------------------------------------------
// AUTOMATED HIERARCHY CRAWLER ENDPOINTS
// -------------------------------------------------------------

// Start crawler across all 33 districts & blocks
app.post('/api/epos/crawl-hierarchy', requireAuth, async (req, res) => {
  const result = await startHierarchyCrawl();
  res.json(result);
});

// Stop crawler
app.post('/api/epos/crawl-stop', requireAuth, (req, res) => {
  const result = stopHierarchyCrawl();
  res.json(result);
});

// Get crawler status & live logs
app.get('/api/epos/crawl-status', requireAuth, (req, res) => {
  const status = getHierarchyCrawlStatus();
  res.json(status);
});

// -------------------------------------------------------------
// RDBMS CLOUD SQL DATABASE ENDPOINTS
// -------------------------------------------------------------

// Fetch all stored records from PostgreSQL
app.get('/api/db/cards', requireAuth, async (req, res) => {
  const cards = await getAllCardsFromDb();
  res.json({
    dbConfigured: isDbConfigured(),
    count: cards.length,
    cards
  });
});

// Fetch single record from PostgreSQL
app.get('/api/db/cards/:rcNo', requireAuth, async (req, res) => {
  const card = await getCardByRcNoFromDb(req.params.rcNo);
  if (!card) {
    return res.status(404).json({ error: 'Card not found in database', status: 'not_found' });
  }
  res.json({ card });
});

// Delete single record from PostgreSQL
app.delete('/api/db/cards/:rcNo', requireAuth, async (req, res) => {
  const success = await deleteCardFromDb(req.params.rcNo);
  res.json({ success });
});

// Bulk Sync records into PostgreSQL
app.post('/api/db/sync', requireAuth, async (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Body field "cards" must be an array', status: 'bad_request' });
  }

  let syncedCount = 0;
  for (const card of cards) {
    const saved = await saveExtractedCardToDb(card);
    if (saved) syncedCount++;
  }

  res.json({ success: true, syncedCount, totalProvided: cards.length });
});

// Database summary stats
app.get('/api/db/stats', requireAuth, async (req, res) => {
  const cards = await getAllCardsFromDb();
  const totalMembers = cards.reduce((acc, c) => acc + (c.totalMembers || 0), 0);
  const districts = Array.from(new Set(cards.map(c => c.district))).filter(Boolean);
  const hierarchyStats = await getHierarchyStats();

  res.json({
    dbEngine: 'Cloud SQL PostgreSQL',
    dbConfigured: isDbConfigured(),
    host: process.env.SQL_HOST || 'Connected',
    database: process.env.SQL_DB_NAME || 'postgres',
    totalCardsSaved: cards.length,
    totalMembersSaved: totalMembers,
    uniqueDistricts: districts.length,
    hierarchy: hierarchyStats
  });
});

// -------------------------------------------------------------
// EPOS CHHATTISGARH STATE DIRECT SEARCH & DRILLDOWN ENDPOINTS
// -------------------------------------------------------------

// 1. Get list of Districts (cached in RDBMS)
app.get('/api/epos/districts', requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const districts = await getEposDistricts(forceRefresh);
    res.json({ success: true, count: districts.length, districts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get list of Blocks for a District (cached in RDBMS)
app.get('/api/epos/blocks', requireAuth, async (req, res) => {
  try {
    const distCode = String(req.query.distCode || '').trim();
    const forceRefresh = req.query.refresh === 'true';
    if (!distCode) {
      return res.status(400).json({ success: false, error: 'distCode is required' });
    }
    const blocks = await getEposBlocks(distCode, forceRefresh);
    res.json({ success: true, distCode, count: blocks.length, blocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get list of FPS (Fair Price Shops) for a Block (cached in RDBMS)
app.get('/api/epos/fps', requireAuth, async (req, res) => {
  try {
    const distCode = String(req.query.distCode || '').trim();
    const blockCode = String(req.query.blockCode || '').trim();
    const forceRefresh = req.query.refresh === 'true';
    if (!distCode || !blockCode) {
      return res.status(400).json({ success: false, error: 'distCode and blockCode are required' });
    }
    const fpsList = await getEposFps(distCode, blockCode, forceRefresh);
    res.json({ success: true, distCode, blockCode, count: fpsList.length, fpsList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get RC list for selected FPS (cached in RDBMS)
app.get('/api/epos/rc-list', requireAuth, async (req, res) => {
  try {
    const distCode = String(req.query.distCode || '').trim();
    const blockCode = String(req.query.blockCode || '').trim();
    const fpsId = String(req.query.fpsId || '').trim();
    const month = req.query.month ? Number(req.query.month) : 9;
    const year = req.query.year ? Number(req.query.year) : 2026;
    const forceRefresh = req.query.refresh === 'true';

    if (!distCode || !blockCode || !fpsId) {
      return res.status(400).json({ success: false, error: 'distCode, blockCode, and fpsId are required' });
    }

    const rcList = await getEposRcList(distCode, blockCode, fpsId, month, year, forceRefresh);
    res.json({
      success: true,
      distCode,
      blockCode,
      fpsId,
      count: rcList.length,
      rcList
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// API KEY MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// List API Keys
app.get('/api/keys', requireAuth, async (req, res) => {
  if (isDbConfigured()) {
    const dbKeys = await getAllApiKeysFromDb();
    if (dbKeys.length > 0) {
      return res.json({ keys: dbKeys });
    }
  }
  res.json({ keys: memoryApiKeys });
});

// Create New API Key
app.post('/api/keys', requireAuth, async (req, res) => {
  const { label } = req.body;
  const keyLabel = (label && typeof label === 'string' && label.trim()) ? label.trim() : 'Remote Integration App';
  
  if (isDbConfigured()) {
    const created = await createApiKeyInDb(keyLabel);
    if (created) {
      return res.status(201).json({ success: true, keyRecord: created });
    }
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(3, 7);
  const newKey = `cg_rc_key_${randomSuffix}`;

  const keyRecord: ApiKeyRecord = {
    key: newKey,
    label: keyLabel,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    requestCount: 0
  };

  memoryApiKeys.push(keyRecord);
  res.status(201).json({ success: true, keyRecord });
});

// Revoke API Key
app.delete('/api/keys/:key', requireAuth, async (req, res) => {
  const targetKey = req.params.key;

  if (isDbConfigured()) {
    await deleteApiKeyFromDb(targetKey);
  }

  const index = memoryApiKeys.findIndex(k => k.key === targetKey);
  if (index !== -1) {
    memoryApiKeys.splice(index, 1);
  }

  res.json({ success: true, message: 'API Key revoked successfully' });
});

// -------------------------------------------------------------
// REMOTE PUBLIC REST API ENDPOINTS (PROTECTED BY API KEY)
// -------------------------------------------------------------

// Remote GET Endpoint: /api/v1/extract?rcNo=223868315896&fpsId=412001080
app.get('/api/v1/extract', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({
      error: 'Unauthorized: Valid API Key is required. Pass key via "X-API-Key" header, "Authorization: Bearer <key>", or "?apiKey=<key>" query param.',
      status: 'unauthorized',
      docsUrl: '/api/keys'
    });
  }

  const rcNo = req.query.rcNo as string;
  const fpsId = (req.query.fpsId as string) || '412001080';
  const allowFallback = req.query.allowFallback !== 'false';

  if (!rcNo || typeof rcNo !== 'string') {
    return res.status(400).json({ error: 'Query parameter "rcNo" is required.', status: 'bad_request' });
  }

  const result = await extractRationCardDetails(rcNo, fpsId, allowFallback);
  return res.status(result.httpStatus).json(result.data);
});

// Remote GET Endpoint: /api/v1/card/:rcNo
app.get('/api/v1/card/:rcNo', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({
      error: 'Unauthorized: Valid API Key is required. Pass key via "X-API-Key" header, "Authorization: Bearer <key>", or "?apiKey=<key>" query param.',
      status: 'unauthorized'
    });
  }

  const rcNo = req.params.rcNo;
  const fpsId = (req.query.fpsId as string) || '412001080';
  const allowFallback = req.query.allowFallback !== 'false';

  const result = await extractRationCardDetails(rcNo, fpsId, allowFallback);
  return res.status(result.httpStatus).json(result.data);
});

// Remote POST Endpoint: /api/v1/extract
app.post('/api/v1/extract', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({
      error: 'Unauthorized: Valid API Key is required. Pass key via "X-API-Key" header, "Authorization: Bearer <key>", or "?apiKey=<key>" query param.',
      status: 'unauthorized'
    });
  }

  const { rcNo, fpsId = '412001080', allowFallback = true } = req.body;
  if (!rcNo || typeof rcNo !== 'string') {
    return res.status(400).json({ error: 'Field "rcNo" is required in JSON body.', status: 'bad_request' });
  }

  const result = await extractRationCardDetails(rcNo, fpsId, allowFallback);
  return res.status(result.httpStatus).json(result.data);
});

// Remote GET Endpoint: /api/v1/epos/districts
app.get('/api/v1/epos/districts', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  try {
    const forceRefresh = req.query.refresh === 'true';
    const districts = await getEposDistricts(forceRefresh);
    res.json({ success: true, count: districts.length, districts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remote GET Endpoint: /api/v1/epos/blocks?distCode=...
app.get('/api/v1/epos/blocks', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  try {
    const distCode = String(req.query.distCode || '').trim();
    const forceRefresh = req.query.refresh === 'true';
    if (!distCode) return res.status(400).json({ error: 'Query param "distCode" is required.' });
    const blocks = await getEposBlocks(distCode, forceRefresh);
    res.json({ success: true, distCode, count: blocks.length, blocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remote GET Endpoint: /api/v1/epos/fps?distCode=...&blockCode=...
app.get('/api/v1/epos/fps', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  try {
    const distCode = String(req.query.distCode || '').trim();
    const blockCode = String(req.query.blockCode || '').trim();
    const forceRefresh = req.query.refresh === 'true';
    if (!distCode || !blockCode) {
      return res.status(400).json({ error: 'Query params "distCode" and "blockCode" are required.' });
    }
    const fpsList = await getEposFps(distCode, blockCode, forceRefresh);
    res.json({ success: true, distCode, blockCode, count: fpsList.length, fpsList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remote GET Endpoint: /api/v1/epos/fps/:fpsId/cards?distCode=...&blockCode=...
app.get('/api/v1/epos/fps/:fpsId/cards', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  try {
    const fpsId = req.params.fpsId;
    const distCode = String(req.query.distCode || '').trim();
    const blockCode = String(req.query.blockCode || '').trim();
    const month = req.query.month ? Number(req.query.month) : 9;
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!distCode || !blockCode) {
      return res.status(400).json({ error: 'Query params "distCode" and "blockCode" are required.' });
    }

    const rcList = await getEposRcList(distCode, blockCode, fpsId, month, year);
    res.json({ success: true, fpsId, count: rcList.length, cards: rcList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remote GET Endpoint: /api/v1/cards (stored in PostgreSQL)
app.get('/api/v1/cards', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  try {
    let cards = await getAllCardsFromDb();
    const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
    const district = req.query.district ? String(req.query.district).toLowerCase().trim() : '';
    const fpsId = req.query.fpsId ? String(req.query.fpsId).trim() : '';

    if (district) {
      cards = cards.filter(c => (c.district || '').toLowerCase().includes(district));
    }
    if (fpsId) {
      cards = cards.filter(c => c.fpsId === fpsId);
    }
    if (q) {
      cards = cards.filter(c => 
        c.rcNo.includes(q) || 
        (c.headName || '').toLowerCase().includes(q) ||
        (c.village || '').toLowerCase().includes(q)
      );
    }

    const limit = Math.min(100, Math.max(1, req.query.limit ? Number(req.query.limit) : 50));
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1);
    const total = cards.length;
    const paginated = cards.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      cards: paginated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remote GET Endpoint: /api/v1/cards/:rcNo
app.get('/api/v1/cards/:rcNo', async (req, res) => {
  const keyRecord = await validateAndRecordApiKey(req);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Unauthorized: Valid API Key is required.', status: 'unauthorized' });
  }
  const card = await getCardByRcNoFromDb(req.params.rcNo);
  if (!card) {
    return res.status(404).json({ error: 'Card not found in database', status: 'not_found' });
  }
  res.json({ success: true, card });
});


// Web Application Extraction Route (Used by Browser UI - Protected by Login / API Key)
app.post('/api/extract-ration-card', requireAuth, async (req, res) => {
  const { rcNo, fpsId = '412001080', allowFallback = true } = req.body;

  if (!rcNo || typeof rcNo !== 'string') {
    return res.status(400).json({
      error: 'Ration card number (rcNo) is required.',
      status: 'error'
    });
  }

  const result = await extractRationCardDetails(rcNo, fpsId, allowFallback);
  return res.status(result.httpStatus).json(result.data);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    portalUrl: 'https://fcs.cg.gov.in/rcmodule/RptRationCardSearch.aspx',
    database: {
      engine: 'Cloud SQL PostgreSQL',
      configured: isDbConfigured(),
      host: process.env.SQL_HOST || null,
      name: process.env.SQL_DB_NAME || null
    },
    timestamp: new Date().toISOString()
  });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] CG Ration Card Extractor with Cloud SQL running on http://0.0.0.0:${PORT}`);
  });
}

start();
