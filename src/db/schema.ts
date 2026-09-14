import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';

// Extracted Ration Cards Database Table
export const extractedCards = pgTable('extracted_cards', {
  id: serial('id').primaryKey(),
  rcNo: text('rc_no').notNull().unique(),
  fpsId: text('fps_id').notNull(),
  fpsName: text('fps_name'),
  headName: text('head_name').notNull(),
  headNameHindi: text('head_name_hindi'),
  guardianName: text('guardian_name'),
  cardType: text('card_type'),
  district: text('district'),
  block: text('block'),
  gramPanchayat: text('gram_panchayat'),
  village: text('village'),
  totalMembers: integer('total_members').default(0),
  gasConnection: text('gas_connection'),
  bankAadhaarSeeded: text('bank_aadhaar_seeded'),
  membersJson: text('members_json'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  status: text('status').default('success'),
  source: text('source').default('live')
});

// Remote API Keys Database Table
export const apiKeysTable = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsed: timestamp('last_used'),
  requestCount: integer('request_count').default(0)
});
