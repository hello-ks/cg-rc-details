export interface RationCardMember {
  sNo: number;
  name: string;
  gender: string;
  age: number | string;
  relation: string;
  aadhaarStatus: string;
  memberId?: string;
}

export interface ExtractedRationCardDetails {
  rcNo: string;
  fpsId: string;
  fpsName: string;
  headName: string;
  headNameHindi?: string;
  guardianName: string;
  cardType: string;
  district: string;
  block: string;
  gramPanchayat: string;
  village: string;
  totalMembers: number;
  gasConnection: string;
  bankAadhaarSeeded: string;
  members: RationCardMember[];
  extractedAt: string;
  status: 'success' | 'error' | 'not_found' | 'warning';
  errorMessage?: string;
  source: 'live' | 'fallback_mirror' | 'simulated';
}

export interface BatchJobItem {
  id: string;
  rcNo: string;
  fpsId?: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retrying';
  attempts: number;
  result?: ExtractedRationCardDetails;
  error?: string;
  durationMs?: number;
}

export interface BatchJobConfig {
  concurrency: number;
  delayMs: number;
  maxRetries: number;
  allowFallback: boolean;
}

export interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  currentSpeed?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  rcNo?: string;
}

export interface ApiKeyRecord {
  key: string;
  label: string;
  createdAt: string;
  lastUsed: string | null;
  requestCount: number;
}
