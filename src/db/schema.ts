import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

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
}, (table) => ({
  fpsIdIdx: index('extracted_cards_fps_id_idx').on(table.fpsId),
  districtIdx: index('extracted_cards_dist_idx').on(table.district),
  statusIdx: index('extracted_cards_status_idx').on(table.status)
}));

// Remote API Keys Database Table
export const apiKeysTable = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsed: timestamp('last_used'),
  requestCount: integer('request_count').default(0)
}, (table) => ({
  keyIdx: index('api_keys_key_idx').on(table.key)
}));

// CG Districts Table
export const cgDistricts = pgTable('cg_districts', {
  id: serial('id').primaryKey(),
  distCode: text('dist_code').notNull().unique(),
  distName: text('dist_name').notNull(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// CG Blocks / AFSO Table
export const cgBlocks = pgTable('cg_blocks', {
  id: serial('id').primaryKey(),
  blockCode: text('block_code').notNull(),
  blockName: text('block_name').notNull(),
  distCode: text('dist_code').notNull(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  distCodeIdx: index('cg_blocks_dist_code_idx').on(table.distCode),
  distBlockIdx: index('cg_blocks_dist_block_idx').on(table.distCode, table.blockCode)
}));

// CG Fair Price Shops Table
export const cgFps = pgTable('cg_fps', {
  id: serial('id').primaryKey(),
  fpsId: text('fps_id').notNull(),
  fpsName: text('fps_name'),
  distCode: text('dist_code').notNull(),
  blockCode: text('block_code').notNull(),
  totalCards: integer('total_cards').default(0),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  distBlockFpsIdx: index('cg_fps_dist_block_idx').on(table.distCode, table.blockCode),
  fpsIdIdx: index('cg_fps_fps_id_idx').on(table.fpsId)
}));

// CG FPS Ration Card Numbers Table
export const cgFpsRcNumbers = pgTable('cg_fps_rc_numbers', {
  id: serial('id').primaryKey(),
  rcNo: text('rc_no').notNull(),
  fpsId: text('fps_id').notNull(),
  distCode: text('dist_code'),
  blockCode: text('block_code'),
  scheme: text('scheme'),
  headName: text('head_name'),
  status: text('status').default('pending'), // 'pending' | 'scraped' | 'failed'
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  fpsIdIdx: index('cg_fps_rc_fps_id_idx').on(table.fpsId),
  rcNoIdx: index('cg_fps_rc_rc_no_idx').on(table.rcNo),
  fpsRcIdx: index('cg_fps_rc_composite_idx').on(table.fpsId, table.rcNo),
  statusIdx: index('cg_fps_rc_status_idx').on(table.status)
}));

// Application Users Table
export const usersTable = pgTable('app_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  name: text('name').default('Administrator'),
  role: text('role').default('admin'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login')
}, (table) => ({
  usernameIdx: index('app_users_username_idx').on(table.username)
}));

// User Active Sessions Table
export const sessionsTable = pgTable('app_sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  username: text('username').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  tokenIdx: index('app_sessions_token_idx').on(table.token)
}));

