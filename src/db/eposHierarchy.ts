import { eq, and } from 'drizzle-orm';
import { getDb } from './index.ts';
import { cgDistricts, cgBlocks, cgFps, cgFpsRcNumbers } from './schema.ts';

export interface DistrictItem {
  distCode: string;
  distName: string;
}

export interface BlockItem {
  blockCode: string;
  blockName: string;
  distCode: string;
}

export interface FpsItem {
  fpsId: string;
  fpsName: string;
  distCode: string;
  blockCode: string;
  totalCards: number;
}

export interface RcNumberItem {
  rcNo: string;
  fpsId: string;
  distCode?: string;
  blockCode?: string;
  scheme?: string;
  headName?: string;
  status?: string;
}

// -------------------------------------------------------------
// DISTRICTS
// -------------------------------------------------------------
export async function saveDistrictsToDb(districts: DistrictItem[]) {
  const db = getDb();
  if (!db || districts.length === 0) return;

  try {
    for (const d of districts) {
      await db
        .insert(cgDistricts)
        .values({
          distCode: d.distCode,
          distName: d.distName,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: cgDistricts.distCode,
          set: {
            distName: d.distName,
            updatedAt: new Date()
          }
        });
    }
  } catch (err) {
    console.error('[DB Error] saveDistrictsToDb failed:', err);
  }
}

export async function getDistrictsFromDb(): Promise<DistrictItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(cgDistricts).orderBy(cgDistricts.distName);
    return rows.map(r => ({
      distCode: r.distCode,
      distName: r.distName
    }));
  } catch (err) {
    console.error('[DB Error] getDistrictsFromDb failed:', err);
    return [];
  }
}

// -------------------------------------------------------------
// BLOCKS / AFSO
// -------------------------------------------------------------
export async function saveBlocksToDb(distCode: string, blocks: BlockItem[]) {
  const db = getDb();
  if (!db || blocks.length === 0) return;

  try {
    // Delete existing blocks for this district to keep in sync
    await db.delete(cgBlocks).where(eq(cgBlocks.distCode, distCode));

    for (const b of blocks) {
      await db.insert(cgBlocks).values({
        blockCode: b.blockCode,
        blockName: b.blockName,
        distCode: b.distCode,
        updatedAt: new Date()
      });
    }
  } catch (err) {
    console.error('[DB Error] saveBlocksToDb failed:', err);
  }
}

export async function getBlocksFromDb(distCode: string): Promise<BlockItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(cgBlocks).where(eq(cgBlocks.distCode, distCode)).orderBy(cgBlocks.blockName);
    return rows.map(r => ({
      blockCode: r.blockCode,
      blockName: r.blockName,
      distCode: r.distCode
    }));
  } catch (err) {
    console.error('[DB Error] getBlocksFromDb failed:', err);
    return [];
  }
}

// -------------------------------------------------------------
// FAIR PRICE SHOPS (FPS)
// -------------------------------------------------------------
export async function saveFpsToDb(distCode: string, blockCode: string, fpsList: FpsItem[]) {
  const db = getDb();
  if (!db || fpsList.length === 0) return;

  try {
    // Delete existing FPS for this block to keep in sync
    await db.delete(cgFps).where(and(eq(cgFps.distCode, distCode), eq(cgFps.blockCode, blockCode)));

    for (const f of fpsList) {
      await db.insert(cgFps).values({
        fpsId: f.fpsId,
        fpsName: f.fpsName,
        distCode: f.distCode,
        blockCode: f.blockCode,
        totalCards: f.totalCards || 0,
        updatedAt: new Date()
      });
    }
  } catch (err) {
    console.error('[DB Error] saveFpsToDb failed:', err);
  }
}

export async function getFpsFromDb(distCode: string, blockCode: string): Promise<FpsItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(cgFps).where(and(eq(cgFps.distCode, distCode), eq(cgFps.blockCode, blockCode))).orderBy(cgFps.fpsName);
    return rows.map(r => ({
      fpsId: r.fpsId,
      fpsName: r.fpsName || r.fpsId,
      distCode: r.distCode,
      blockCode: r.blockCode,
      totalCards: r.totalCards || 0
    }));
  } catch (err) {
    console.error('[DB Error] getFpsFromDb failed:', err);
    return [];
  }
}

// -------------------------------------------------------------
// RC NUMBERS
// -------------------------------------------------------------
export async function saveRcNumbersToDb(fpsId: string, distCode: string, blockCode: string, rcList: RcNumberItem[]) {
  const db = getDb();
  if (!db || rcList.length === 0) return;

  try {
    // Clear previously stored pending/old RC list for this FPS to avoid duplicates
    await db.delete(cgFpsRcNumbers).where(eq(cgFpsRcNumbers.fpsId, fpsId));

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < rcList.length; i += batchSize) {
      const chunk = rcList.slice(i, i + batchSize).map(r => ({
        rcNo: r.rcNo,
        fpsId: fpsId,
        distCode: distCode || null,
        blockCode: blockCode || null,
        scheme: r.scheme || null,
        headName: r.headName || null,
        status: 'pending'
      }));
      await db.insert(cgFpsRcNumbers).values(chunk);
    }
  } catch (err) {
    console.error('[DB Error] saveRcNumbersToDb failed:', err);
  }
}

export async function getRcNumbersFromDb(fpsId: string): Promise<RcNumberItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(cgFpsRcNumbers).where(eq(cgFpsRcNumbers.fpsId, fpsId));
    return rows.map(r => ({
      rcNo: r.rcNo,
      fpsId: r.fpsId,
      distCode: r.distCode || undefined,
      blockCode: r.blockCode || undefined,
      scheme: r.scheme || undefined,
      headName: r.headName || undefined,
      status: r.status || 'pending'
    }));
  } catch (err) {
    console.error('[DB Error] getRcNumbersFromDb failed:', err);
    return [];
  }
}

export async function getHierarchyStats() {
  const db = getDb();
  if (!db) {
    return { districtsCount: 0, blocksCount: 0, fpsCount: 0, rcCount: 0 };
  }

  try {
    const districts = await db.select().from(cgDistricts);
    const blocks = await db.select().from(cgBlocks);
    const fps = await db.select().from(cgFps);
    const rc = await db.select().from(cgFpsRcNumbers);

    return {
      districtsCount: districts.length,
      blocksCount: blocks.length,
      fpsCount: fps.length,
      rcCount: rc.length
    };
  } catch (err) {
    console.error('[DB Error] getHierarchyStats failed:', err);
    return { districtsCount: 0, blocksCount: 0, fpsCount: 0, rcCount: 0 };
  }
}
