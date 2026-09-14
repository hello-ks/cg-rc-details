import { eq, desc } from 'drizzle-orm';
import { getDb } from './index.ts';
import { extractedCards } from './schema.ts';
import { ExtractedRationCardDetails } from '../types.ts';

export async function saveExtractedCardToDb(card: ExtractedRationCardDetails) {
  const db = getDb();
  if (!db) return null;

  try {
    const membersJsonStr = JSON.stringify(card.members || []);

    const values = {
      rcNo: card.rcNo,
      fpsId: card.fpsId,
      fpsName: card.fpsName || null,
      headName: card.headName,
      headNameHindi: card.headNameHindi || card.headName || null,
      guardianName: card.guardianName || null,
      cardType: card.cardType || null,
      district: card.district || null,
      block: card.block || null,
      gramPanchayat: card.gramPanchayat || null,
      village: card.village || null,
      totalMembers: card.totalMembers || (card.members ? card.members.length : 0),
      gasConnection: card.gasConnection || null,
      bankAadhaarSeeded: card.bankAadhaarSeeded || null,
      membersJson: membersJsonStr,
      status: card.status || 'success',
      source: card.source || 'live',
      extractedAt: new Date(card.extractedAt || Date.now())
    };

    const result = await db
      .insert(extractedCards)
      .values(values)
      .onConflictDoUpdate({
        target: extractedCards.rcNo,
        set: {
          fpsId: values.fpsId,
          fpsName: values.fpsName,
          headName: values.headName,
          headNameHindi: values.headNameHindi,
          guardianName: values.guardianName,
          cardType: values.cardType,
          district: values.district,
          block: values.block,
          gramPanchayat: values.gramPanchayat,
          village: values.village,
          totalMembers: values.totalMembers,
          gasConnection: values.gasConnection,
          bankAadhaarSeeded: values.bankAadhaarSeeded,
          membersJson: values.membersJson,
          status: values.status,
          source: values.source,
          extractedAt: values.extractedAt
        }
      })
      .returning();

    return result[0];
  } catch (err) {
    console.error(`[DB Error] Failed to save card ${card.rcNo} to PostgreSQL:`, err);
    return null;
  }
}

export async function getAllCardsFromDb() {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(extractedCards).orderBy(desc(extractedCards.extractedAt));
    return rows.map(r => ({
      rcNo: r.rcNo,
      fpsId: r.fpsId,
      fpsName: r.fpsName || `उचित मूल्य दुकान - ${r.fpsId}`,
      headName: r.headName,
      headNameHindi: r.headNameHindi || r.headName,
      guardianName: r.guardianName || 'N/A',
      cardType: r.cardType || 'प्राथमिकता',
      district: r.district || 'N/A',
      block: r.block || 'N/A',
      gramPanchayat: r.gramPanchayat || 'N/A',
      village: r.village || 'N/A',
      totalMembers: r.totalMembers || 0,
      gasConnection: r.gasConnection || 'N/A',
      bankAadhaarSeeded: r.bankAadhaarSeeded || 'N/A',
      members: r.membersJson ? JSON.parse(r.membersJson) : [],
      extractedAt: r.extractedAt ? r.extractedAt.toISOString() : new Date().toISOString(),
      status: (r.status as any) || 'success',
      source: (r.source as any) || 'live'
    }));
  } catch (err) {
    console.error('[DB Error] Failed to fetch cards from PostgreSQL:', err);
    return [];
  }
}

export async function getCardByRcNoFromDb(rcNo: string) {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db.select().from(extractedCards).where(eq(extractedCards.rcNo, rcNo.trim()));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      rcNo: r.rcNo,
      fpsId: r.fpsId,
      fpsName: r.fpsName || `उचित मूल्य दुकान - ${r.fpsId}`,
      headName: r.headName,
      headNameHindi: r.headNameHindi || r.headName,
      guardianName: r.guardianName || 'N/A',
      cardType: r.cardType || 'प्राथमिकता',
      district: r.district || 'N/A',
      block: r.block || 'N/A',
      gramPanchayat: r.gramPanchayat || 'N/A',
      village: r.village || 'N/A',
      totalMembers: r.totalMembers || 0,
      gasConnection: r.gasConnection || 'N/A',
      bankAadhaarSeeded: r.bankAadhaarSeeded || 'N/A',
      members: r.membersJson ? JSON.parse(r.membersJson) : [],
      extractedAt: r.extractedAt ? r.extractedAt.toISOString() : new Date().toISOString(),
      status: (r.status as any) || 'success',
      source: (r.source as any) || 'live'
    };
  } catch (err) {
    console.error(`[DB Error] Failed to get card ${rcNo}:`, err);
    return null;
  }
}

export async function deleteCardFromDb(rcNo: string) {
  const db = getDb();
  if (!db) return false;

  try {
    await db.delete(extractedCards).where(eq(extractedCards.rcNo, rcNo.trim()));
    return true;
  } catch (err) {
    console.error(`[DB Error] Failed to delete card ${rcNo}:`, err);
    return false;
  }
}
