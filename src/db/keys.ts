import { eq, desc } from 'drizzle-orm';
import { getDb } from './index.ts';
import { apiKeysTable } from './schema.ts';
import { ApiKeyRecord } from '../types.ts';

export async function getAllApiKeysFromDb(): Promise<ApiKeyRecord[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
    return rows.map(r => ({
      key: r.key,
      label: r.label,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      lastUsed: r.lastUsed ? r.lastUsed.toISOString() : null,
      requestCount: r.requestCount || 0
    }));
  } catch (err) {
    console.error('[DB Error] Failed to fetch API keys:', err);
    return [];
  }
}

export async function createApiKeyInDb(label: string): Promise<ApiKeyRecord | null> {
  const db = getDb();
  const randomSuffix = Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(3, 7);
  const keyStr = `cg_rc_key_${randomSuffix}`;

  const record: ApiKeyRecord = {
    key: keyStr,
    label: label.trim() || 'Remote Integration Client',
    createdAt: new Date().toISOString(),
    lastUsed: null,
    requestCount: 0
  };

  if (!db) {
    return record;
  }

  try {
    const inserted = await db
      .insert(apiKeysTable)
      .values({
        key: record.key,
        label: record.label,
        createdAt: new Date(record.createdAt),
        lastUsed: null,
        requestCount: 0
      })
      .returning();

    const r = inserted[0];
    return {
      key: r.key,
      label: r.label,
      createdAt: r.createdAt ? r.createdAt.toISOString() : record.createdAt,
      lastUsed: null,
      requestCount: 0
    };
  } catch (err) {
    console.error('[DB Error] Failed to create API key in PostgreSQL:', err);
    return record;
  }
}

export async function deleteApiKeyFromDb(key: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true;

  try {
    await db.delete(apiKeysTable).where(eq(apiKeysTable.key, key));
    return true;
  } catch (err) {
    console.error(`[DB Error] Failed to delete key ${key}:`, err);
    return false;
  }
}

export async function validateAndRecordApiKeyInDb(rawKey: string): Promise<ApiKeyRecord | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, rawKey));
    if (rows.length === 0) return null;

    const r = rows[0];
    const newCount = (r.requestCount || 0) + 1;
    const now = new Date();

    await db
      .update(apiKeysTable)
      .set({
        lastUsed: now,
        requestCount: newCount
      })
      .where(eq(apiKeysTable.key, rawKey));

    return {
      key: r.key,
      label: r.label,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      lastUsed: now.toISOString(),
      requestCount: newCount
    };
  } catch (err) {
    console.error(`[DB Error] Failed to validate key ${rawKey}:`, err);
    return null;
  }
}
