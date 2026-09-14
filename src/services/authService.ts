import crypto from 'node:crypto';
import { getDb, isDbConfigured, createPool } from '../db/index.ts';
import { usersTable, sessionsTable } from '../db/schema.ts';
import { eq, and, gt } from 'drizzle-orm';

export interface UserPublic {
  id?: number;
  username: string;
  name: string;
  role: string;
  lastLogin?: string | null;
}

interface InMemoryUser {
  id: number;
  username: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: string;
  createdAt: string;
  lastLogin: string | null;
}

interface InMemorySession {
  token: string;
  username: string;
  expiresAt: number; // timestamp ms
  createdAt: string;
}

// Default Admin configuration from environment or secure defaults
const DEFAULT_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim();
const DEFAULT_PASSWORD = (process.env.ADMIN_PASSWORD || 'Admin@CGPDS2026#').trim();

// Security hashing helpers
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// In-Memory Storage Fallback
const defaultSalt = generateSalt();
const memoryUsers: InMemoryUser[] = [
  {
    id: 1,
    username: DEFAULT_USERNAME,
    passwordHash: hashPassword(DEFAULT_PASSWORD, defaultSalt),
    salt: defaultSalt,
    name: 'State Administrator',
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLogin: null
  }
];

const memorySessions: Map<string, InMemorySession> = new Map();

// Rate limiting & Brute-force protection
interface LoginAttemptRecord {
  count: number;
  firstAttemptTime: number;
  lockedUntil?: number;
}
const loginAttempts: Map<string, LoginAttemptRecord> = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// Ensure database tables exist if Cloud SQL is configured
let isDbTablesEnsured = false;
async function ensureDbAuthTables() {
  if (isDbTablesEnsured || !isDbConfigured()) return;
  try {
    const pool = createPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT DEFAULT 'Administrator',
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS app_users_username_idx ON app_users(username);

      CREATE TABLE IF NOT EXISTS app_sessions (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS app_sessions_token_idx ON app_sessions(token);
    `);

    // Ensure default admin user in Cloud SQL
    const db = getDb();
    if (db) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.username, DEFAULT_USERNAME)).limit(1);
      if (existing.length === 0) {
        const salt = generateSalt();
        const hash = hashPassword(DEFAULT_PASSWORD, salt);
        await db.insert(usersTable).values({
          username: DEFAULT_USERNAME,
          passwordHash: hash,
          salt,
          name: 'State Administrator',
          role: 'admin'
        });
        console.log(`[Auth] Seeded initial admin account (${DEFAULT_USERNAME}) into Cloud SQL`);
      }
    }
    isDbTablesEnsured = true;
  } catch (err: any) {
    console.warn('[Auth] Note: Auth DB tables init skipped or error:', err.message);
  }
}

// Trigger initial check asynchronously
ensureDbAuthTables().catch(() => {});

// Login user and create session
export async function loginUser(
  usernameInput: string,
  passwordInput: string,
  clientIp: string = 'unknown'
): Promise<{ success: boolean; token?: string; user?: UserPublic; error?: string; lockedUntil?: number }> {
  await ensureDbAuthTables();

  const username = usernameInput.trim();
  const password = passwordInput;
  const attemptKey = `${clientIp}_${username.toLowerCase()}`;
  const now = Date.now();

  // Check brute force lockout
  const attemptRecord = loginAttempts.get(attemptKey);
  if (attemptRecord) {
    if (attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
      const remainingSec = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      return {
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${remainingSec} seconds.`,
        lockedUntil: attemptRecord.lockedUntil
      };
    }
    // Reset window if expired
    if (now - attemptRecord.firstAttemptTime > ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(attemptKey);
    }
  }

  // 1. Try checking Cloud SQL DB
  let matchedUser: { id?: number; username: string; passwordHash: string; salt: string; name: string; role: string } | null = null;

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const results = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
        if (results.length > 0) {
          const u = results[0];
          matchedUser = {
            id: u.id,
            username: u.username,
            passwordHash: u.passwordHash,
            salt: u.salt,
            name: u.name || 'Administrator',
            role: u.role || 'admin'
          };
        }
      }
    } catch (err: any) {
      console.error('[Auth] Error querying user from DB:', err.message);
    }
  }

  // 2. Fallback to In-Memory users if not found in DB
  if (!matchedUser) {
    const mem = memoryUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (mem) {
      matchedUser = mem;
    }
  }

  // 3. Verify password
  if (!matchedUser) {
    recordFailedAttempt(attemptKey);
    return { success: false, error: 'Invalid username or password.' };
  }

  const computedHash = hashPassword(password, matchedUser.salt);
  if (computedHash !== matchedUser.passwordHash) {
    recordFailedAttempt(attemptKey);
    return { success: false, error: 'Invalid username or password.' };
  }

  // Clear failed attempts on successful login
  loginAttempts.delete(attemptKey);

  // Generate Session Token (Valid for 7 days)
  const token = generateToken();
  const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAtMs = now + sessionDurationMs;
  const expiresAtDate = new Date(expiresAtMs);

  // Store Session in Cloud SQL if available
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(sessionsTable).values({
          token,
          username: matchedUser.username,
          expiresAt: expiresAtDate
        });
        // Update last login
        await db.update(usersTable)
          .set({ lastLogin: new Date() })
          .where(eq(usersTable.username, matchedUser.username));
      }
    } catch (err: any) {
      console.error('[Auth] Error writing session to DB:', err.message);
    }
  }

  // Also cache in memory for fast lookup
  memorySessions.set(token, {
    token,
    username: matchedUser.username,
    expiresAt: expiresAtMs,
    createdAt: new Date().toISOString()
  });

  const publicUser: UserPublic = {
    id: matchedUser.id,
    username: matchedUser.username,
    name: matchedUser.name,
    role: matchedUser.role,
    lastLogin: new Date().toISOString()
  };

  return {
    success: true,
    token,
    user: publicUser
  };
}

function recordFailedAttempt(attemptKey: string) {
  const now = Date.now();
  const record = loginAttempts.get(attemptKey) || { count: 0, firstAttemptTime: now };
  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[Auth Security] Rate-limit lockout triggered for ${attemptKey}`);
  }
  loginAttempts.set(attemptKey, record);
}

// Verify session token
export async function verifySessionToken(token: string | undefined): Promise<UserPublic | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  const now = Date.now();

  // 1. Check memory sessions first (fastest)
  const memSession = memorySessions.get(cleanToken);
  if (memSession) {
    if (memSession.expiresAt < now) {
      memorySessions.delete(cleanToken);
      return null;
    }
    const memUser = memoryUsers.find(u => u.username === memSession.username);
    return {
      username: memSession.username,
      name: memUser?.name || 'Administrator',
      role: memUser?.role || 'admin',
      lastLogin: memUser?.lastLogin || null
    };
  }

  // 2. Check Cloud SQL DB
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const results = await db.select().from(sessionsTable)
          .where(and(eq(sessionsTable.token, cleanToken), gt(sessionsTable.expiresAt, new Date())))
          .limit(1);

        if (results.length > 0) {
          const s = results[0];
          // Get user details
          const uResults = await db.select().from(usersTable).where(eq(usersTable.username, s.username)).limit(1);
          const u = uResults[0];

          const userPublic: UserPublic = {
            id: u?.id,
            username: s.username,
            name: u?.name || 'Administrator',
            role: u?.role || 'admin',
            lastLogin: u?.lastLogin ? u.lastLogin.toISOString() : null
          };

          // Cache in memory
          memorySessions.set(cleanToken, {
            token: cleanToken,
            username: s.username,
            expiresAt: s.expiresAt.getTime(),
            createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString()
          });

          return userPublic;
        }
      }
    } catch (err: any) {
      console.error('[Auth] Error checking session from DB:', err.message);
    }
  }

  return null;
}

// Revoke/Logout Session
export async function logoutUser(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const cleanToken = token.trim();
  memorySessions.delete(cleanToken);

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.delete(sessionsTable).where(eq(sessionsTable.token, cleanToken));
      }
    } catch (err: any) {
      console.error('[Auth] Error deleting session from DB:', err.message);
    }
  }
  return true;
}

// Change Password
export async function changeUserPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  let foundUser: { id?: number; username: string; passwordHash: string; salt: string } | null = null;

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const results = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
        if (results.length > 0) {
          foundUser = results[0];
        }
      }
    } catch (err: any) {
      console.error('[Auth] Error querying user for password change:', err.message);
    }
  }

  if (!foundUser) {
    const mem = memoryUsers.find(u => u.username === username);
    if (mem) foundUser = mem;
  }

  if (!foundUser) {
    return { success: false, error: 'User not found.' };
  }

  // Verify current password
  const currentHash = hashPassword(currentPassword, foundUser.salt);
  if (currentHash !== foundUser.passwordHash) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // Generate new salt and hash
  const newSalt = generateSalt();
  const newHash = hashPassword(newPassword, newSalt);

  // Update in DB
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.update(usersTable)
          .set({ passwordHash: newHash, salt: newSalt })
          .where(eq(usersTable.username, username));
      }
    } catch (err: any) {
      console.error('[Auth] Error updating password in DB:', err.message);
    }
  }

  // Update in memory
  const memIndex = memoryUsers.findIndex(u => u.username === username);
  if (memIndex !== -1) {
    memoryUsers[memIndex].passwordHash = newHash;
    memoryUsers[memIndex].salt = newSalt;
  }

  return { success: true };
}

export function getDefaultAdminHint() {
  return {
    defaultUsername: DEFAULT_USERNAME,
    defaultPassword: DEFAULT_PASSWORD
  };
}
