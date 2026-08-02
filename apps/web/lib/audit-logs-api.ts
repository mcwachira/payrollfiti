import { apiFetch } from './api-client';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actor: { email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAuditLogsFilters {
  entityType?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export function listAuditLogs(
  filters: ListAuditLogsFilters = {},
): Promise<PaginatedAuditLogs> {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.action) params.set('action', filters.action);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));
  return apiFetch<PaginatedAuditLogs>(`/audit-logs?${params.toString()}`);
}
